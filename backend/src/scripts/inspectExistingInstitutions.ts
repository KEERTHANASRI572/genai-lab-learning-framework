import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { connectDatabase, disconnectDatabase } from '../config/database';
import { Institution } from '../models/Institution';
import { User } from '../models/User';
import { Department } from '../models/Department';
import { Course } from '../models/Course';
import { Laboratory } from '../models/Laboratory';
import { Experiment } from '../models/Experiment';
import { LearningResource } from '../models/LearningResource';
import { SupportTicket } from '../models/SupportTicket';

async function inspectData() {
  await connectDatabase();

  const institutions = await Institution.find().lean();
  console.log(`=== INSTITUTIONS (${institutions.length}) ===`);
  for (const inst of institutions) {
    console.log(`ID: ${inst._id}, Name: ${inst.name}, Code: ${inst.code}, Status: ${inst.status}, AdminEmail: ${inst.adminEmail}`);
    const users = await User.find({ institutionId: inst._id }).lean();
    console.log(`  Users (${users.length}):`);
    for (const u of users) {
      console.log(`    - Role: ${u.role}, Name: ${u.name}, Email: ${u.email}, Status: ${u.status}`);
    }
    const depts = await Department.find({ institutionId: inst._id }).lean();
    console.log(`  Departments (${depts.length}):`);
    for (const d of depts) {
      console.log(`    - Name: ${d.name}, Code: ${d.code}`);
      const courses = await Course.find({ departmentId: d._id }).lean();
      for (const c of courses) {
        console.log(`      * Course: ${c.name} (${c.code})`);
      }
    }
    const labs = await Laboratory.find({ institutionId: inst._id }).lean();
    console.log(`  Laboratories (${labs.length})`);
    const exps = await Experiment.find({ institutionId: inst._id }).lean();
    console.log(`  Experiments (${exps.length})`);
    const resources = await LearningResource.find({ institutionId: inst._id }).lean();
    console.log(`  LearningResources (${resources.length})`);
    const tickets = await SupportTicket.find({ institutionId: inst._id }).lean();
    console.log(`  SupportTickets (${tickets.length})`);
  }

  const platformAdmins = await User.find({ role: 'platform-admin' }).lean();
  console.log(`=== PLATFORM ADMINS (${platformAdmins.length}) ===`);
  for (const pa of platformAdmins) {
    console.log(`  - Name: ${pa.name}, Email: ${pa.email}, Status: ${pa.status}`);
  }

  await disconnectDatabase();
}

inspectData().catch(console.error);

