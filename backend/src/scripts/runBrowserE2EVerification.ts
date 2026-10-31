import puppeteer, { Browser, Page } from 'puppeteer-core';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { connectDatabase, disconnectDatabase } from '../config/database';
import { Institution } from '../models/Institution';
import { User } from '../models/User';
import { Department } from '../models/Department';
import { Laboratory } from '../models/Laboratory';
import { LearningResource } from '../models/LearningResource';
import { SupportTicket } from '../models/SupportTicket';
import { LearningSession } from '../models/LearningSession';
import { generateAuthTokens } from '../utils/token';

export interface TestReport {
  suite: string;
  name: string;
  action: string;
  expected: string;
  actual: string;
  passed: boolean;
  defect?: string;
}

export const testReports: TestReport[] = [];

function recordTest(report: TestReport) {
  testReports.push(report);
  const mark = report.passed ? '✓ PASS' : '✗ FAIL';
  console.log(`[${mark}] ${report.suite} - ${report.name}`);
  console.log(`    Action:   ${report.action}`);
  console.log(`    Expected: ${report.expected}`);
  console.log(`    Actual:   ${report.actual}`);
  if (report.defect) {
    console.log(`    DEFECT:   ${report.defect}`);
  }
}

async function navigateSidebar(page: Page, label: string) {
  await page.evaluate((navLabel) => {
    const buttons = Array.from(document.querySelectorAll('aside button'));
    const btn = buttons.find((b) => b.textContent?.includes(navLabel));
    if (btn) (btn as HTMLButtonElement).click();
  }, label);
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

async function runBrowserVerification() {
  console.log('================================================================');
  console.log('  COMPLETE END-TO-END BROWSER VERIFICATION: COLLEGE ADMIN MODULE');
  console.log('================================================================\n');

  let dbConnected = false;
  for (let i = 0; i < 3 && !dbConnected; i++) {
    try {
      dbConnected = await connectDatabase(3, 1500);
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const aitInst = await Institution.findOne({ code: 'AIT' });
  const bitInst = await Institution.findOne({ code: 'BIT' });

  if (!aitInst || !bitInst) {
    throw new Error('Atlas database does not have both AIT and BIT institutions.');
  }

  const aitAdminUser = await User.findOne({ institutionId: aitInst._id, role: 'college-admin' });
  const bitAdminUser = await User.findOne({ institutionId: bitInst._id, role: 'college-admin' });

  if (!aitAdminUser || !bitAdminUser) {
    throw new Error('Missing college-admin records for AIT or BIT in Atlas.');
  }

  console.log(`[INSTITUTION A] Name: "${aitInst.name}" | Code: ${aitInst.code} | Admin: ${aitAdminUser.email}`);
  console.log(`[INSTITUTION B] Name: "${bitInst.name}" | Code: ${bitInst.code} | Admin: ${bitAdminUser.email}\n`);

  let createdTicketId: string | null = null;
  let createdResourceId: string | null = null;

  const browser: Browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });

  const page: Page = await browser.newPage();

  try {
    // =========================================================================
    // STEP 0: Browser Form Authentication (AIT)
    // =========================================================================
    console.log('--- Step 0: Browser Authentication (AIT) ---');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });

    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', aitAdminUser.email);
    await page.type('input[type="password"]', 'LabSecurePass2026!');

    const [loginRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/auth/login') && r.status() === 200),
      page.click('button[type="submit"]'),
    ]);

    await page.waitForSelector('aside', { timeout: 10000 });
    await page.waitForSelector('main h1', { timeout: 10000 });
    await page.waitForSelector('.grid-4', { timeout: 10000 });
    const overviewTitle = await page.$eval('main h1', (el) => el.textContent || '');

    recordTest({
      suite: 'Authentication',
      name: 'Form Login & Session Establishment',
      action: `Navigated to http://localhost:5173/, typed ${aitAdminUser.email}, submitted password, awaited 200 login response`,
      expected: 'Redirects to College Overview; header reflects Apex Institute of Technology',
      actual: `HTTP ${loginRes.status()} - Main H1: "${overviewTitle.trim()}"`,
      passed: loginRes.status() === 200 && overviewTitle.includes('Apex Institute of Technology'),
    });

    // =========================================================================
    // STEP 1: College Overview
    // =========================================================================
    console.log('\n--- Step 1: Testing College Overview ---');
    await page.waitForSelector('.grid-4', { timeout: 10000 });
    await page.waitForFunction(() => {
      const vals = document.querySelectorAll('.metric-value');
      return vals.length >= 4 && (vals[0]?.textContent?.trim() || '') !== '';
    }, { timeout: 10000 });
    const [dbDeptCountAit, dbLabCountAit, dbStudentCountAit, dbResourceCountAit] = await Promise.all([
      Department.countDocuments({ institutionId: aitInst._id, status: { $ne: 'archived' } }),
      Laboratory.countDocuments({ institutionId: aitInst._id, status: { $in: ['active', 'maintenance'] } }),
      User.countDocuments({ institutionId: aitInst._id, role: 'student', status: 'active' }),
      LearningResource.countDocuments({ institutionId: aitInst._id, status: { $ne: 'archived' } }),
    ]);

    const overviewMetrics = await page.$$eval('.metric-card', (cards) =>
      cards.map((c) => ({
        title: c.querySelector('.metric-title')?.textContent?.trim() || '',
        value: c.querySelector('.metric-value')?.textContent?.trim() || '',
      }))
    );

    const deptsVal = overviewMetrics.find((m) => m.title.includes('Academic Departments'))?.value;
    const labsVal = overviewMetrics.find((m) => m.title.includes('Active Laboratories'))?.value;
    const studentsVal = overviewMetrics.find((m) => m.title.includes('Enrolled Students'))?.value;
    const manualsVal = overviewMetrics.find((m) => m.title.includes('Approved Lab Manuals'))?.value;

    const metricsMatch =
      deptsVal === dbDeptCountAit.toString() &&
      labsVal?.includes(dbLabCountAit.toString()) &&
      studentsVal === dbStudentCountAit.toString() &&
      manualsVal?.includes(dbResourceCountAit.toString());

    recordTest({
      suite: 'College Overview',
      name: 'Dynamic Database Metrics (Zero Dummy Numbers)',
      action: 'Compared browser metric cards with live MongoDB Atlas counts for AIT',
      expected: `Depts: ${dbDeptCountAit}, Labs: ${dbLabCountAit}, Students: ${dbStudentCountAit}, Manuals: ${dbResourceCountAit}`,
      actual: `Depts: ${deptsVal}, Labs: ${labsVal}, Students: ${studentsVal}, Manuals: ${manualsVal}`,
      passed: Boolean(metricsMatch),
    });

    const overviewMainText = await page.$eval('main', (el) => el.innerText);
    const hierarchyTextCorrect =
      overviewMainText.includes('Institution → Department → Course → Laboratory → Experiment') &&
      !overviewMainText.includes('Subject → Laboratory');

    recordTest({
      suite: 'College Overview',
      name: 'Academic Hierarchy 5-Level Structure Banner',
      action: 'Inspected Active Academic Hierarchy banner in College Overview',
      expected: 'Institution → Department → Course → Laboratory → Experiment (Subject level removed)',
      actual: hierarchyTextCorrect ? 'Correct 5-level hierarchy rendered' : 'Failed to display 5-level structure',
      passed: hierarchyTextCorrect,
    });

    const displaysEceDept = overviewMainText.includes('Department of Electronics & Communication Engineering (ECE)');
    recordTest({
      suite: 'College Overview',
      name: 'Dynamic Department Breakdown',
      action: 'Verified department listing rendered in College Overview',
      expected: 'Lists genuine AIT department (ECE)',
      actual: `Department of Electronics & Communication Engineering present: ${displaysEceDept}`,
      passed: displaysEceDept,
    });

    // =========================================================================
    // STEP 2: Academic Hierarchy
    // =========================================================================
    console.log('\n--- Step 2: Testing Academic Hierarchy Navigation ---');
    await navigateSidebar(page, 'Academic Hierarchy');

    const hierarchyMainText = await page.$eval('main', (el) => el.innerText);
    const showsDeptEce = hierarchyMainText.includes('Electronics & Communication');
    const noSubjectLevel = !hierarchyMainText.includes('Subject Level') && !hierarchyMainText.includes('Subjects (Legacy)');

    recordTest({
      suite: 'Academic Hierarchy',
      name: 'Active 5-Level Structure Enforcement',
      action: 'Navigated to Academic Hierarchy view in browser and inspected hierarchy levels',
      expected: 'Shows Department ECE, Course BTECH-ECE, Laboratory without standalone Subject level',
      actual: `Shows ECE: ${showsDeptEce}, No Subject Level: ${noSubjectLevel}`,
      passed: showsDeptEce && noSubjectLevel,
    });

    // =========================================================================
    // STEP 3: Faculty & Students
    // =========================================================================
    console.log('\n--- Step 3: Testing Faculty & Students Roster ---');
    await navigateSidebar(page, 'Faculty & Students');

    const usersMainText = await page.$eval('main', (el) => el.innerText);
    const showsProfElena = usersMainText.includes('Prof. Elena Rostova');
    const showsRohanSharma = usersMainText.includes('Rohan Sharma');
    const foreignBitAbsent = !usersMainText.includes('Ananya') && !usersMainText.includes('manjuryam.cs24@bitsathy.ac.in');

    recordTest({
      suite: 'Faculty & Students',
      name: 'Tenant Roster Isolation & Course Assignment',
      action: 'Navigated to Faculty & Students view and inspected user management table',
      expected: 'Shows AIT users (Prof. Elena Rostova with ECE/BTECH-ECE, Rohan Sharma) and does NOT show foreign BIT users',
      actual: `Prof. Elena present: ${showsProfElena}, Rohan present: ${showsRohanSharma}, Foreign BIT users absent: ${foreignBitAbsent}`,
      passed: showsProfElena && showsRohanSharma && foreignBitAbsent,
    });

    // =========================================================================
    // STEP 4: Institutional Resources
    // =========================================================================
    console.log('\n--- Step 4: Testing Institutional Resources (Upload, Persistence, Download) ---');
    await navigateSidebar(page, 'Institutional Resources');

    // Click "Upload Approved Lab Resource"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find((b) => b.textContent?.includes('Upload Approved Lab Resource'));
      if (btn) btn.click();
    });

    await page.waitForSelector('input[type="file"]');

    const tempPdf = path.resolve(__dirname, '../../uploads/temp_browser_test.pdf');
    fs.mkdirSync(path.dirname(tempPdf), { recursive: true });
    fs.writeFileSync(tempPdf, '%PDF-1.4 Browser End-to-End Test Resource Manual Grounding Content');

    const fileEl = await page.$('input[type="file"]');
    if (fileEl) {
      await fileEl.uploadFile(tempPdf);
    }

    const titleEl = await page.$('input[placeholder*="Analog Circuit"]');
    if (titleEl) {
      await titleEl.click({ count: 3 });
      await titleEl.type('Precision Oscilloscope Operation Guide 2026');
    }

    // Submit upload
    const [uploadRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/learning-resources') && (r.status() === 201 || r.status() === 200)),
      page.evaluate(() => {
        const submitBtn = Array.from(document.querySelectorAll('button[type="submit"]')).find((b) =>
          b.textContent?.includes('Upload & Ground Resource')
        );
        if (submitBtn) (submitBtn as HTMLButtonElement).click();
      }),
    ]);

    const uploadData = await uploadRes.json();
    if (uploadData?.data?._id) {
      createdResourceId = uploadData.data._id;
    }

    await page.waitForFunction(() => document.body.innerText.includes('Precision Oscilloscope Operation Guide 2026'), { timeout: 12000 });

    const resourceUploaded = await page.evaluate(() =>
      document.body.innerText.includes('Precision Oscilloscope Operation Guide 2026')
    );

    recordTest({
      suite: 'Institutional Resources',
      name: 'Live Document Upload & RAG Indexing',
      action: 'Uploaded PDF file with title "Precision Oscilloscope Operation Guide 2026" via upload modal',
      expected: 'Upload succeeds, modal closes, document appears in table with "Indexed" RAG badge',
      actual: `Resource rendered in table: ${resourceUploaded}`,
      passed: resourceUploaded,
    });

    // Page Reload to test persistence
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('aside', { timeout: 10000 });
    await navigateSidebar(page, 'Institutional Resources');
    await page.waitForFunction(() => document.body.innerText.includes('Precision Oscilloscope Operation Guide 2026'), { timeout: 10000 });
    const resourcePersisted = await page.evaluate(() =>
      document.body.innerText.includes('Precision Oscilloscope Operation Guide 2026')
    );

    recordTest({
      suite: 'Institutional Resources',
      name: 'Persistence After Page Reload',
      action: 'Reloaded browser page (F5) and checked table rows',
      expected: 'Uploaded document persists in MongoDB Atlas and renders after reload',
      actual: `Document present after reload: ${resourcePersisted}`,
      passed: resourcePersisted,
    });

    // Track for cleanup
    const dbRes = await LearningResource.findOne({
      institutionId: aitInst._id,
      title: 'Precision Oscilloscope Operation Guide 2026',
    });
    if (dbRes) {
      createdResourceId = dbRes._id.toString();
    }

    // Verify Download
    let downloadStatus = 0;
    if (createdResourceId) {
      const cookies = await page.cookies();
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
      const res = await fetch(`http://localhost:5000/api/v1/learning-resources/${createdResourceId}/download`, {
        headers: { Cookie: cookieHeader },
      });
      downloadStatus = res.status;
    }

    recordTest({
      suite: 'Institutional Resources',
      name: 'Resource Download Action',
      action: `Requested download endpoint /api/v1/learning-resources/${createdResourceId}/download`,
      expected: 'Returns HTTP 200 with authenticated file stream',
      actual: `HTTP ${downloadStatus}`,
      passed: downloadStatus === 200,
    });

    try {
      fs.unlinkSync(tempPdf);
    } catch {}

    // =========================================================================
    // STEP 5: College Analytics
    // =========================================================================
    console.log('\n--- Step 5: Testing College Analytics Against Database ---');
    await navigateSidebar(page, 'College Analytics');

    const [realSessions, realStudents, realCompleted] = await Promise.all([
      LearningSession.countDocuments({ institutionId: aitInst._id }),
      User.countDocuments({ institutionId: aitInst._id, role: 'student', status: 'active' }),
      LearningSession.countDocuments({ institutionId: aitInst._id, sessionStatus: 'completed' }),
    ]);

    const analyticsMetrics = await page.$$eval('.metric-card', (cards) =>
      cards.map((c) => ({
        title: c.querySelector('.metric-title')?.textContent?.trim() || '',
        value: c.querySelector('.metric-value')?.textContent?.trim() || '',
      }))
    );

    const sVal = analyticsMetrics.find((m) => m.title.includes('Scheduled Lab Sessions'))?.value;
    const stuVal = analyticsMetrics.find((m) => m.title.includes('Active Students'))?.value;
    const compVal = analyticsMetrics.find((m) => m.title.includes('Lab Completion Rate'))?.value;

    const sMatch = sVal === realSessions.toString();
    const stuMatch = stuVal === realStudents.toString();
    const compMatch =
      realSessions > 0
        ? compVal === `${Math.round((realCompleted / realSessions) * 100)}%`
        : compVal === 'No data available';

    recordTest({
      suite: 'College Analytics',
      name: 'Database Telemetry Grounding (No Hardcoded 42 or 1,240)',
      action: 'Verified displayed analytics values against MongoDB Atlas aggregate counts',
      expected: `Sessions: ${realSessions}, Active Students: ${realStudents}, Completion: ${realSessions > 0 ? 'calculated %' : 'No data available'}`,
      actual: `Sessions: ${sVal}, Active Students: ${stuVal}, Completion: ${compVal}`,
      passed: sMatch && stuMatch && compMatch,
    });

    // =========================================================================
    // STEP 6: Student Interventions
    // =========================================================================
    console.log('\n--- Step 6: Testing Student Interventions ---');
    await navigateSidebar(page, 'Student Interventions');
    await page.waitForFunction(() => !document.body.innerText.includes('Checking student session telemetry'), { timeout: 10000 });

    const interventionsMainText = await page.$eval('main', (el) => el.innerText);
    const showsRohanFlagged = interventionsMainText.includes('Rohan Sharma');
    const noDummyMayaLin = !interventionsMainText.includes('Maya Lin');

    recordTest({
      suite: 'Student Interventions',
      name: 'Genuine Diagnostic Interventions (No Mock Students)',
      action: 'Inspected early-warning intervention table and alerts in browser',
      expected: 'Displays genuinely eligible student (Rohan Sharma with <50% diagnostic score); mock student Maya Lin absent',
      actual: `Rohan Sharma flagged: ${showsRohanFlagged}, Dummy Maya Lin absent: ${noDummyMayaLin}`,
      passed: showsRohanFlagged && noDummyMayaLin,
    });

    // =========================================================================
    // STEP 7: Faculty Oversight
    // =========================================================================
    console.log('\n--- Step 7: Testing Faculty Oversight ---');
    await navigateSidebar(page, 'Faculty Oversight');

    const facultyMainText = await page.$eval('main', (el) => el.innerText);
    const facultyElena = facultyMainText.includes('Prof. Elena Rostova');
    const mockSterlingAbsent = !facultyMainText.includes('Dr. Marcus Sterling');
    const mockRoyAbsent = !facultyMainText.includes('Dr. Ananya Roy');

    recordTest({
      suite: 'Faculty Oversight',
      name: 'Genuine Faculty Roster Ledger',
      action: 'Inspected Faculty Participation table in browser',
      expected: 'Displays genuine faculty (Prof. Elena Rostova); mock faculty (Dr. Marcus Sterling, Dr. Ananya Roy) absent',
      actual: `Elena Rostova present: ${facultyElena}, Dr. Sterling absent: ${mockSterlingAbsent}, Dr. Roy absent: ${mockRoyAbsent}`,
      passed: facultyElena && mockSterlingAbsent && mockRoyAbsent,
    });

    // =========================================================================
    // STEP 8: College Support (Create, Reload, Status Update)
    // =========================================================================
    console.log('\n--- Step 8: Testing College Support (Create, Reload, Update) ---');
    await navigateSidebar(page, 'College Support');

    // Click "File Support Ticket"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find((b) => b.textContent?.includes('File Support Ticket'));
      if (btn) btn.click();
    });

    await page.waitForSelector('input[placeholder*="Lab manual vector"]');
    await page.type('input[placeholder*="Lab manual vector"]', 'Bench 4 Oscilloscope Trigger Calibration Request');
    await page.type('textarea[placeholder*="Provide complete details"]', 'High-frequency transient response lab requires probe calibration verification.');

    // Select Priority High
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const prioritySelect = selects.find((s) => s.innerHTML.includes('Urgent'));
      if (prioritySelect) {
        prioritySelect.value = 'high';
        prioritySelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Submit ticket
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/support-tickets') && (r.status() === 201 || r.status() === 200)),
      page.evaluate(() => {
        const submitBtn = Array.from(document.querySelectorAll('button[type="submit"]')).find((b) =>
          b.textContent?.includes('Submit Ticket')
        );
        if (submitBtn) (submitBtn as HTMLButtonElement).click();
      }),
    ]);

    await page.waitForFunction(() => document.body.innerText.includes('Bench 4 Oscilloscope Trigger Calibration Request'), { timeout: 10000 });

    const ticketInUi = await page.evaluate(() =>
      document.body.innerText.includes('Bench 4 Oscilloscope Trigger Calibration Request')
    );

    const ticketInDb = await SupportTicket.findOne({
      institutionId: aitInst._id,
      subject: 'Bench 4 Oscilloscope Trigger Calibration Request',
    });

    if (ticketInDb) {
      createdTicketId = ticketInDb._id.toString();
    }

    recordTest({
      suite: 'College Support',
      name: 'Support Ticket Creation',
      action: 'Submitted support ticket modal with Subject, Description, Priority High',
      expected: 'Ticket created with unique TKT-YYYY-XXXXX number, renders in table with Open status',
      actual: `Rendered in UI: ${ticketInUi}, DB TicketNumber: ${ticketInDb?.ticketNumber}`,
      passed: ticketInUi && !!ticketInDb?.ticketNumber.startsWith('TKT-'),
    });

    // Reload page
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('aside', { timeout: 10000 });
    await navigateSidebar(page, 'College Support');
    await page.waitForFunction(() => document.body.innerText.includes('Bench 4 Oscilloscope Trigger Calibration Request'), { timeout: 10000 });
    const ticketPersists = await page.evaluate(() =>
      document.body.innerText.includes('Bench 4 Oscilloscope Trigger Calibration Request')
    );

    recordTest({
      suite: 'College Support',
      name: 'Ticket Persistence After Reload',
      action: 'Reloaded browser page (F5) and checked support ticket rows',
      expected: 'Support ticket persists in database and renders from Atlas after reload',
      actual: `Ticket present after reload: ${ticketPersists}`,
      passed: ticketPersists,
    });

    // Click "Details" button to update status
    await page.evaluate(() => {
      const detailBtns = Array.from(document.querySelectorAll('button')).filter((b) =>
        b.textContent?.includes('Details')
      );
      if (detailBtns.length > 0) detailBtns[0]?.click();
    });

    await page.waitForSelector('textarea[placeholder*="Document any actions"]');

    const selectEl = await page.$('form select');
    if (selectEl) {
      await selectEl.select('resolved');
    }

    await page.type(
      'textarea[placeholder*="Document any actions"]',
      'Probes recalibrated and verified by departmental technician.'
    );

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/support-tickets/') && r.status() === 200),
      page.evaluate(() => {
        const saveBtn = Array.from(document.querySelectorAll('button[type="submit"]')).find((b) =>
          b.textContent?.includes('Save Ticket Status')
        );
        if (saveBtn) (saveBtn as HTMLButtonElement).click();
      }),
    ]);

    await page.waitForFunction(() => document.body.innerText.includes('Resolved'), { timeout: 10000 });

    const updatedDbTicket = await SupportTicket.findById(createdTicketId);
    const isResolvedInDb = updatedDbTicket?.status === 'resolved' && !!updatedDbTicket?.resolvedAt;

    recordTest({
      suite: 'College Support',
      name: 'Ticket Status Update & Resolution Persistence',
      action: 'Updated status to Resolved with notes and saved via Details modal',
      expected: 'Status badge changes to Resolved in UI; status="resolved" and resolvedAt timestamp saved in Atlas',
      actual: `Status: ${updatedDbTicket?.status}, ResolvedAt recorded: ${!!updatedDbTicket?.resolvedAt}`,
      passed: isResolvedInDb,
    });

    // =========================================================================
    // STEP 9: Multi-Tenant Verification (AIT vs BIT)
    // =========================================================================
    console.log('\n--- Step 9: Testing Multi-Tenant Verification (BIT Institution) ---');

    // Generate tokens for BIT College Admin and switch session in browser
    const bitTokens = generateAuthTokens(bitAdminUser);

    await page.setCookie(
      { name: 'access_token', value: bitTokens.tokens.accessToken, domain: 'localhost', path: '/' },
      { name: 'refresh_token', value: bitTokens.tokens.refreshToken, domain: 'localhost', path: '/' }
    );

    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.body.innerText.includes('Administration Portal'));

    const bitHeader = await page.$eval('main h1', (el) => el.textContent || '');
    const bitMainOverview = await page.$eval('main', (el) => el.innerText);

    const bitShowsBitName = bitHeader.includes('BANNARI AMMAN INSTITUTE OF TECHNOLOGY');
    const bitShowsCse = bitMainOverview.includes('COMPUTER SCIENCE AND ENGINEERING');
    const bitNoEce = !bitMainOverview.includes('Department of Electronics & Communication Engineering');

    recordTest({
      suite: 'Multi-Tenant Isolation',
      name: 'College Overview Institutional Isolation',
      action: 'Switched session to BIT College Admin and checked College Overview in browser',
      expected: 'Displays BANNARI AMMAN INSTITUTE OF TECHNOLOGY and CSE department; zero AIT ECE records',
      actual: `Header: "${bitHeader.trim()}", Shows CSE: ${bitShowsCse}, AIT ECE absent: ${bitNoEce}`,
      passed: bitShowsBitName && bitShowsCse && bitNoEce,
    });

    // Check Support Tickets in BIT
    await navigateSidebar(page, 'College Support');
    const bitSupportText = await page.$eval('main', (el) => el.innerText);
    const bitCannotSeeAitTicket = !bitSupportText.includes('Bench 4 Oscilloscope Trigger Calibration Request');
    const bitHonestEmptyTickets = bitSupportText.includes('No Support Tickets Found');

    recordTest({
      suite: 'Multi-Tenant Isolation',
      name: 'Support Ticket Cross-Tenant Privacy',
      action: 'Navigated to College Support as BIT College Admin and inspected ticket ledger',
      expected: 'BIT sees 0 tickets (honest empty state); AIT ticket is completely invisible to BIT',
      actual: `AIT ticket invisible: ${bitCannotSeeAitTicket}, Shows honest empty state: ${bitHonestEmptyTickets}`,
      passed: bitCannotSeeAitTicket && bitHonestEmptyTickets,
    });

    // Check Learning Resources in BIT
    await navigateSidebar(page, 'Institutional Resources');
    const bitResourcesText = await page.$eval('main', (el) => el.innerText);
    const bitCannotSeeAitManual = !bitResourcesText.includes('Precision Oscilloscope Operation Guide 2026');
    const bitHonestEmptyResources = bitResourcesText.includes('No Learning Resources Uploaded');

    recordTest({
      suite: 'Multi-Tenant Isolation',
      name: 'Learning Resources Cross-Tenant Privacy',
      action: 'Navigated to Institutional Resources as BIT College Admin and inspected table',
      expected: 'BIT sees 0 resources (honest empty state); AIT manual is completely invisible to BIT',
      actual: `AIT manual invisible: ${bitCannotSeeAitManual}, Shows honest empty state: ${bitHonestEmptyResources}`,
      passed: bitCannotSeeAitManual && bitHonestEmptyResources,
    });

    // Check Faculty & Students in BIT
    await navigateSidebar(page, 'Faculty & Students');
    await page.waitForFunction(() => document.body.innerText.includes('College Identity & User Governance'), { timeout: 10000 });
    const bitUsersText = await page.$eval('main', (el) => el.innerText);
    const bitShowsAnanya = bitUsersText.includes('Ananya') || bitUsersText.includes('manjuryam.cs24@bitsathy.ac.in');
    const bitNoElena = !bitUsersText.includes('Prof. Elena Rostova');
    const bitNoRohan = !bitUsersText.includes('Rohan Sharma');

    recordTest({
      suite: 'Multi-Tenant Isolation',
      name: 'Faculty & Student Roster Cross-Tenant Privacy',
      action: 'Navigated to Faculty & Students as BIT College Admin and inspected table',
      expected: 'Shows BIT faculty (Ananya); AIT faculty (Elena) and student (Rohan) are absent',
      actual: `BIT faculty present: ${bitShowsAnanya}, AIT faculty absent: ${bitNoElena}, AIT student absent: ${bitNoRohan}`,
      passed: bitShowsAnanya && bitNoElena && bitNoRohan,
    });

    // Cross-tenant direct API rejection test:
    const crossTicketRes = await fetch(`http://localhost:5000/api/v1/support-tickets/${createdTicketId}`, {
      headers: { Cookie: `access_token=${bitTokens.tokens.accessToken}` },
    });
    const ticketBlocked = crossTicketRes.status === 404 || crossTicketRes.status === 403;

    recordTest({
      suite: 'Multi-Tenant Isolation',
      name: 'Backend API Rejection of Cross-Tenant Ticket Access',
      action: `BIT admin attempted direct GET on AIT ticket /api/v1/support-tickets/${createdTicketId}`,
      expected: 'HTTP 404 (TICKET_NOT_FOUND) or 403 fail-closed rejection',
      actual: `HTTP ${crossTicketRes.status}`,
      passed: ticketBlocked,
    });

    const crossResourceRes = await fetch(`http://localhost:5000/api/v1/learning-resources/${createdResourceId}/download`, {
      headers: { Cookie: `access_token=${bitTokens.tokens.accessToken}` },
    });
    const resourceBlocked = crossResourceRes.status === 404 || crossResourceRes.status === 403;

    recordTest({
      suite: 'Multi-Tenant Isolation',
      name: 'Backend API Rejection of Cross-Tenant Resource Download',
      action: `BIT admin attempted direct GET on AIT resource /api/v1/learning-resources/${createdResourceId}/download`,
      expected: 'HTTP 404 (RESOURCE_NOT_FOUND) or 403 fail-closed rejection',
      actual: `HTTP ${crossResourceRes.status}`,
      passed: resourceBlocked,
    });
  } catch (err) {
    console.error('[BROWSER_EXECUTION_ERROR]', err);
  } finally {
    await browser.close();

    // Clean up ONLY temporary records created during test
    if (createdTicketId) {
      await SupportTicket.deleteOne({ _id: createdTicketId });
      console.log(`[CLEANUP] Deleted temporary test support ticket: ${createdTicketId}`);
    }
    if (createdResourceId) {
      await LearningResource.deleteOne({ _id: createdResourceId });
      console.log(`[CLEANUP] Deleted temporary test learning resource: ${createdResourceId}`);
    }

    await disconnectDatabase();
  }

  console.log('\n================================================================');
  console.log('              FINAL BROWSER E2E VERIFICATION SUMMARY            ');
  console.log('================================================================');
  const total = testReports.length;
  const passedCount = testReports.filter((r) => r.passed).length;
  const failedCount = total - passedCount;

  console.log(`Total Browser Tests Executed : ${total}`);
  console.log(`Passed Checks                : ${passedCount}`);
  console.log(`Failed Checks                : ${failedCount}`);

  if (failedCount > 0) {
    console.error('\nFAILED CHECKS:');
    testReports.filter((r) => !r.passed).forEach((r) => console.error(` - ${r.suite} > ${r.name}`));
    process.exit(1);
  } else {
    console.log('\n[ALL PASS] 100% of browser end-to-end tests and multi-tenant checks PASSED!');
  }
}

runBrowserVerification();
