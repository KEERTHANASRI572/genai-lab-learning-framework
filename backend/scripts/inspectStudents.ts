import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function inspectStudents() {
  await mongoose.connect(process.env.MONGODB_URI!, { dbName: 'genai_lab_learning_db' });
  const User = mongoose.connection.collection('users');
  const students = await User.find({ role: 'student' }).toArray();
  console.log(`Total students (${students.length}):`);
  students.forEach(s => {
    console.log(`Student ID: ${s._id}`);
    console.log(`  Name: ${s.name}, Email: ${s.email}`);
    console.log(`  Institution: ${s.institutionId}`);
    console.log(`  Assigned Department: ${s.assignedDepartmentId}`);
    console.log(`  Assigned Course: ${s.assignedCourseId}`);
    console.log(`  Enrolled Courses: ${JSON.stringify(s.enrolledCourses || [])}`);
  });

  const Course = mongoose.connection.collection('courses');
  const courses = await Course.find({}).toArray();
  console.log(`\nTotal courses (${courses.length}):`);
  courses.forEach(c => {
    console.log(`Course ID: ${c._id}, code: ${c.code}, name: "${c.name}", inst: ${c.institutionId}, dept: ${c.departmentId}`);
  });

  const Lab = mongoose.connection.collection('laboratories');
  const labs = await Lab.find({}).toArray();
  console.log(`\nTotal laboratories (${labs.length}):`);
  labs.forEach(l => {
    console.log(`Lab ID: ${l._id}, code: ${l.code}, name: "${l.name}", inst: ${l.institutionId}, course: ${l.courseId}, dept: ${l.departmentId}`);
  });

  const Exp = mongoose.connection.collection('experiments');
  const exps = await Exp.find({}).toArray();
  console.log(`\nTotal experiments (${exps.length}):`);
  exps.forEach(e => {
    console.log(`Exp ID: ${e._id}, code: ${e.code}, title: "${e.title}", inst: ${e.institutionId}, lab: ${e.laboratoryId}, course: ${e.courseId}, status: ${e.status}`);
  });

  await mongoose.disconnect();
}

inspectStudents().catch(console.error);

