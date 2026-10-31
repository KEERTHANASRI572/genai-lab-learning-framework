import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Request, Response } from 'express';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { connectDatabase, disconnectDatabase } from '../config/database';
import { SupportTicket } from '../models/SupportTicket';
import { LearningResource } from '../models/LearningResource';
import { Department } from '../models/Department';
import { User } from '../models/User';
import {
  createSupportTicket,
  listSupportTickets,
  getSupportTicketById,
  updateSupportTicketStatus,
} from '../controllers/supportTickets.controller';
import {
  uploadLearningResource,
  listLearningResources,
  downloadLearningResource,
} from '../controllers/learningResources.controller';
import {
  getCollegeAnalytics,
  getCollegeOverview,
  getStudentInterventions,
  getFacultyOversight,
} from '../controllers/analytics.controller';

interface MockResponse extends Response {
  _statusCode: number;
  _jsonData: unknown;
  _headers: Record<string, string>;
  _sentFile?: string;
  statusCode: number;
}

function createMockResponse(): MockResponse {
  const res: Partial<MockResponse> = {
    _statusCode: 200,
    _jsonData: null,
    _headers: {},
    statusCode: 200,
  };

  res.status = function (code: number) {
    this._statusCode = code;
    this.statusCode = code;
    return this as MockResponse;
  };

  res.json = function (data: unknown) {
    this._jsonData = data;
    return this as MockResponse;
  };

  res.setHeader = function (name: string, value: string) {
    this._headers![name] = value;
    return this as MockResponse;
  };

  res.sendFile = function (filePath: string) {
    this._sentFile = filePath;
    return this as MockResponse;
  };

  res.download = function (filePath: string) {
    this._sentFile = filePath;
    return this as MockResponse;
  };

  return res as MockResponse;
}

function createMockRequest(options: {
  tenantId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  role?: string;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  params?: Record<string, string>;
  file?: Express.Multer.File;
}): Request {
  return {
    tenantId: options.tenantId,
    user: options.userId
      ? {
          id: options.userId.toString(),
          email: 'admin@college-test.edu',
          role: options.role || 'college-admin',
          institutionId: options.tenantId?.toString(),
        }
      : undefined,
    body: options.body || {},
    query: options.query || {},
    params: options.params || {},
    file: options.file,
    headers: {
      'user-agent': 'TestRunner/1.0',
    },
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;
}

async function runVerification() {
  console.log('================================================================');
  console.log('  COLLEGE ADMIN MODULE: REAL DATA & MULTI-TENANT ISOLATION SUITE');
  console.log('================================================================\n');

  await connectDatabase();

  const tenantA = new mongoose.Types.ObjectId();
  const tenantB = new mongoose.Types.ObjectId();
  const userA = new mongoose.Types.ObjectId();
  const userB = new mongoose.Types.ObjectId();

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  [✓] ${desc}`);
      passed++;
    } else {
      console.error(`  [✗] FAILED: ${desc}`);
      failed++;
    }
  }

  try {
    // 1. Create a Department for Tenant A
    const deptA = await Department.create({
      institutionId: tenantA,
      name: 'Department of Robotics & AI',
      code: 'ROB-AI',
      status: 'active',
    });

    // Create Faculty User for Tenant A
    const facultyA = await User.create({
      name: 'Dr. Test Instructor',
      email: `faculty-test-${Date.now()}@college-a.edu`,
      passwordHash: 'dummy-hash-for-unit-test-12345678',
      role: 'faculty',
      institutionId: tenantA,
      departmentId: deptA._id,
      status: 'active',
    });

    console.log('\n--- SUITE 1: Support Tickets & Multi-Tenant Isolation ---');

    // 1.1 Tenant A creates a Support Ticket
    const reqCreate = createMockRequest({
      tenantId: tenantA,
      userId: userA,
      body: {
        subject: 'Microcontroller laboratory power supply calibration',
        description: 'Benches 4 through 8 require 5V regulated supplies re-verified.',
        departmentId: deptA._id.toString(),
        priority: 'high',
      },
    });
    const resCreate = createMockResponse();
    await createSupportTicket(reqCreate, resCreate);

    assert(resCreate._statusCode === 201, 'Tenant A successfully creates support ticket (201)');
    const createdTicket = (resCreate._jsonData as { data: { _id: string; ticketNumber: string; status: string } })?.data;
    assert(!!createdTicket?._id, 'Ticket ID is returned');
    assert(createdTicket?.ticketNumber.startsWith('TKT-'), 'Ticket number generated with valid prefix');

    // 1.2 Tenant A lists support tickets -> sees ticket
    const reqListA = createMockRequest({ tenantId: tenantA, userId: userA });
    const resListA = createMockResponse();
    await listSupportTickets(reqListA, resListA);
    const listAData = (resListA._jsonData as { data: Array<{ _id: string }> })?.data;
    assert(listAData?.some((t) => t._id.toString() === createdTicket._id.toString()), 'Tenant A sees their created ticket');

    // 1.3 Tenant B lists support tickets -> CANNOT see Tenant A's ticket
    const reqListB = createMockRequest({ tenantId: tenantB, userId: userB });
    const resListB = createMockResponse();
    await listSupportTickets(reqListB, resListB);
    const listBData = (resListB._jsonData as { data: Array<{ _id: string }> })?.data;
    assert(!listBData?.some((t) => t._id.toString() === createdTicket._id.toString()), 'Tenant B CANNOT see Tenant A support tickets (Tenant Isolation)');

    // 1.4 Tenant B attempts to fetch Tenant A's ticket by ID -> 404
    const reqGetB = createMockRequest({
      tenantId: tenantB,
      userId: userB,
      params: { ticketId: createdTicket._id.toString() },
    });
    const resGetB = createMockResponse();
    await getSupportTicketById(reqGetB, resGetB);
    assert(resGetB._statusCode === 404, 'Tenant B blocked from accessing Tenant A ticket by ID (404)');

    // 1.5 Tenant A updates ticket status to 'resolved'
    const reqUpdate = createMockRequest({
      tenantId: tenantA,
      userId: userA,
      params: { ticketId: createdTicket._id.toString() },
      body: {
        status: 'resolved',
        resolutionNotes: 'Power supplies recalibrated and benches operational.',
      },
    });
    const resUpdate = createMockResponse();
    await updateSupportTicketStatus(reqUpdate, resUpdate);
    assert(resUpdate._statusCode === 200, 'Tenant A updates ticket status to resolved (200)');
    const updatedData = (resUpdate._jsonData as { data: { status: string; resolutionNotes: string } })?.data;
    assert(updatedData?.status === 'resolved', 'Ticket status correctly updated to resolved');

    console.log('\n--- SUITE 2: Learning Resources & RAG Grounding ---');

    // 2.1 Tenant A uploads a Learning Resource (PDF buffer)
    const pdfBuffer = Buffer.from('%PDF-1.4 sample lab manual content for testing RAG indexing');
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'Robotics_Lab_Manual_2026.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: pdfBuffer,
      size: pdfBuffer.length,
      destination: '',
      filename: '',
      path: '',
      stream: null as unknown as any,
    };

    const reqUpload = createMockRequest({
      tenantId: tenantA,
      userId: userA,
      file: mockFile,
      body: {
        title: 'Robotics Lab Manual 2026',
        category: 'manual',
        departmentId: deptA._id.toString(),
        description: 'Verified kinematics apparatus manual for robot arm lab.',
      },
    });
    const resUpload = createMockResponse();
    await uploadLearningResource(reqUpload, resUpload);

    assert(resUpload._statusCode === 201, 'Tenant A successfully uploads and indexes learning resource (201)');
    const uploadedRes = (resUpload._jsonData as { data: { _id: string; ragIndexingStatus: string; ragMetadata: { chunkCount: number } } })?.data;
    assert(uploadedRes?.ragIndexingStatus === 'ready', 'RAG indexing status initialized to ready');
    assert(uploadedRes?.ragMetadata?.chunkCount >= 1, 'Chunk count computed accurately');

    // 2.2 Tenant A lists learning resources -> sees resource
    const reqListResA = createMockRequest({ tenantId: tenantA, userId: userA });
    const resListResA = createMockResponse();
    await listLearningResources(reqListResA, resListResA);
    const resourcesA = (resListResA._jsonData as { data: Array<{ _id: string }> })?.data;
    assert(resourcesA?.some((r) => r._id.toString() === uploadedRes._id.toString()), 'Tenant A sees their uploaded resource');

    // 2.3 Tenant B lists learning resources -> CANNOT see Tenant A's resource
    const reqListResB = createMockRequest({ tenantId: tenantB, userId: userB });
    const resListResB = createMockResponse();
    await listLearningResources(reqListResB, resListResB);
    const resourcesB = (resListResB._jsonData as { data: Array<{ _id: string }> })?.data;
    assert(!resourcesB?.some((r) => r._id.toString() === uploadedRes._id.toString()), 'Tenant B CANNOT see Tenant A learning resources (Tenant Isolation)');

    // 2.4 Tenant A downloads the resource -> file served
    const reqDownloadA = createMockRequest({
      tenantId: tenantA,
      userId: userA,
      params: { resourceId: uploadedRes._id.toString() },
    });
    const resDownloadA = createMockResponse();
    await downloadLearningResource(reqDownloadA, resDownloadA);
    assert(!!resDownloadA._sentFile, 'Tenant A can download resource file from storage');

    // 2.5 Tenant B attempts to download Tenant A's resource -> 404
    const reqDownloadB = createMockRequest({
      tenantId: tenantB,
      userId: userB,
      params: { resourceId: uploadedRes._id.toString() },
    });
    const resDownloadB = createMockResponse();
    await downloadLearningResource(reqDownloadB, resDownloadB);
    assert(resDownloadB._statusCode === 404, 'Tenant B blocked from downloading Tenant A resource (404)');

    console.log('\n--- SUITE 3: College Analytics & Overview Aggregation ---');

    // 3.1 Tenant A queries analytics
    const reqAnalyticsA = createMockRequest({ tenantId: tenantA, userId: userA });
    const resAnalyticsA = createMockResponse();
    await getCollegeAnalytics(reqAnalyticsA, resAnalyticsA);
    assert(resAnalyticsA._statusCode === 200, 'getCollegeAnalytics returns 200');
    const analyticsA = (resAnalyticsA._jsonData as { data: { departmentsCount: number; learningResourcesCount: number } })?.data;
    assert(analyticsA?.departmentsCount >= 1, 'Analytics reflects genuine department count for Tenant A');
    assert(analyticsA?.learningResourcesCount >= 1, 'Analytics reflects genuine resource count for Tenant A');

    // 3.2 Tenant B queries analytics -> 0 counts (isolated)
    const reqAnalyticsB = createMockRequest({ tenantId: tenantB, userId: userB });
    const resAnalyticsB = createMockResponse();
    await getCollegeAnalytics(reqAnalyticsB, resAnalyticsB);
    const analyticsB = (resAnalyticsB._jsonData as { data: { departmentsCount: number; learningResourcesCount: number } })?.data;
    assert(analyticsB?.departmentsCount === 0, 'Tenant B analytics is 0 (no bleed from Tenant A)');
    assert(analyticsB?.learningResourcesCount === 0, 'Tenant B resource count is 0 (isolated)');

    // 3.3 Tenant A queries college overview
    const reqOverviewA = createMockRequest({ tenantId: tenantA, userId: userA });
    const resOverviewA = createMockResponse();
    await getCollegeOverview(reqOverviewA, resOverviewA);
    assert(resOverviewA._statusCode === 200, 'getCollegeOverview returns 200');
    const overviewA = (resOverviewA._jsonData as { data: { departments: Array<{ code: string }> } })?.data;
    assert(overviewA?.departments?.some((d) => d.code === 'ROB-AI'), 'Overview contains ROB-AI department');

    console.log('\n--- SUITE 4: Faculty Oversight & Interventions ---');

    // 4.1 Tenant A queries faculty oversight
    const reqFacultyA = createMockRequest({ tenantId: tenantA, userId: userA });
    const resFacultyA = createMockResponse();
    await getFacultyOversight(reqFacultyA, resFacultyA);
    assert(resFacultyA._statusCode === 200, 'getFacultyOversight returns 200');
    const facultyList = (resFacultyA._jsonData as { data: Array<{ name: string; dept: string }> })?.data;
    assert(facultyList?.some((f) => f.name === 'Dr. Test Instructor'), 'Faculty list contains enrolled instructor');

    // 4.2 Tenant B queries faculty oversight -> empty
    const reqFacultyB = createMockRequest({ tenantId: tenantB, userId: userB });
    const resFacultyB = createMockResponse();
    await getFacultyOversight(reqFacultyB, resFacultyB);
    const facultyListB = (resFacultyB._jsonData as { data: Array<unknown> })?.data;
    assert(facultyListB?.length === 0, 'Tenant B faculty oversight returns 0 (isolated)');

    // 4.3 Student interventions returns empty when no students flagged
    const reqInterventionsA = createMockRequest({ tenantId: tenantA, userId: userA });
    const resInterventionsA = createMockResponse();
    await getStudentInterventions(reqInterventionsA, resInterventionsA);
    assert(resInterventionsA._statusCode === 200, 'getStudentInterventions returns 200');
    const interventionsA = (resInterventionsA._jsonData as { data: Array<unknown> })?.data;
    assert(Array.isArray(interventionsA), 'Student interventions returned as an honest array');

    // Cleanup Tenant A created documents
    await SupportTicket.deleteMany({ institutionId: tenantA });
    await LearningResource.deleteMany({ institutionId: tenantA });
    await Department.deleteMany({ institutionId: tenantA });
    await User.deleteMany({ _id: facultyA._id });

    console.log('\n================================================================');
    console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

runVerification();
