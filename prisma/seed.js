require('dotenv').config(); // โหลด Environment variables จากไฟล์ .env
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs'); // นำเข้าไลบรารีเข้ารหัสรหัสผ่าน

// สร้าง Connection Pool และโยงผ่าน Driver Adapter สำหรับความเข้ากันได้กับ Prisma 7
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== เริ่มต้นทำความสะอาดฐานข้อมูลเก่า (Clean up) ===");
  
  // ลบข้อมูลย้อนกลับเพื่อไม่ให้ติด Foreign Key Constraint
  await prisma.academicYearLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.leaderboard.deleteMany({});
  await prisma.gameScore.deleteMany({});
  await prisma.courseMaterial.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.submission.deleteMany({});
  await prisma.assignment.deleteMany({});
  await prisma.studentClass.deleteMany({});
  await prisma.classroom.deleteMany({});
  await prisma.user.deleteMany({});

  console.log("=== เริ่มใส่ข้อมูลจำลอง (Database Seeding) ===");

  // ใช้รหัสผ่านง่ายสำหรับการ seed
  const teacherPasswordHash = bcrypt.hashSync("teacher", 10);
  const adminPasswordHash = bcrypt.hashSync("admin", 10);
  const studentPasswordHash = bcrypt.hashSync("1234", 10); // รหัสเริ่มต้นของนักเรียนในเดโม่คือ 1234

  // 1. สร้างข้อมูลผู้ดูแลระบบ (Admin)
  const admin = await prisma.user.create({
    data: {
      name: "แอดมินระบบ",
      role: "ADMIN",
      password: adminPasswordHash,
      passwordHint: "admin",
      status: "ACTIVE",
      avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"
    }
  });
  console.log(`สร้างแอดมินสำเร็จ: ${admin.name}`);

  // 1.2 สร้างข้อมูลคุณครู (Teacher)
  const teacher = await prisma.user.create({
    data: {
      name: "คุณครูสมชาย รักเรียน",
      role: "TEACHER",
      password: teacherPasswordHash,
      passwordHint: "teacher",
      status: "ACTIVE",
      avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150"
    }
  });
  console.log(`สร้างครูสำเร็จ: ${teacher.name}`);

  // 2. สร้างห้องเรียนทั้งหมด (Classrooms) ตามที่มีในรายชื่อ ม.1, ม.2, ม.3
  const classroomsData = [
    { name: "เทคโนโลยีวิทยาการคำนวณ", yearLevel: "ม.1", room: "1", academicYear: "2568" },
    { name: "เทคโนโลยีวิทยาการคำนวณ", yearLevel: "ม.1", room: "2", academicYear: "2568" },
    { name: "เทคโนโลยีวิทยาการคำนวณ", yearLevel: "ม.1", room: "3", academicYear: "2568" },
    { name: "เทคโนโลยีวิทยาการคำนวณ", yearLevel: "ม.2", room: "1", academicYear: "2568" },
    { name: "เทคโนโลยีวิทยาการคำนวณ", yearLevel: "ม.2", room: "2", academicYear: "2568" },
    { name: "เทคโนโลยีวิทยาการคำนวณ", yearLevel: "ม.2", room: "3", academicYear: "2568" },
    { name: "เทคโนโลยีวิทยาการคำนวณ", yearLevel: "ม.3", room: "1", academicYear: "2568" },
    { name: "เทคโนโลยีวิทยาการคำนวณ", yearLevel: "ม.3", room: "2", academicYear: "2568" }
  ];

  const classrooms = {};
  for (const c of classroomsData) {
    const cls = await prisma.classroom.create({
      data: {
        ...c,
        teacherId: teacher.id
      }
    });
    classrooms[`${c.yearLevel}/${c.room}`] = cls;
  }
  console.log("สร้างห้องเรียนทั้งหมด 8 ห้องเรียนเรียบร้อย");

  // 3. รายชื่อนักเรียน 15 คนพร้อมคะแนน และห้องเรียนตามเดโม่
  const studentsList = [
    // ม.3
    { name: 'สมชาย ขยันเรียน', score: 1500, yearLevel: 'ม.3', room: '1', studentId: '660104' },
    { name: 'สมหญิง รักดี', score: 1320, yearLevel: 'ม.3', room: '1', studentId: '660102' },
    { name: 'ภัทรพล เรียนดี', score: 1250, yearLevel: 'ม.3', room: '1', studentId: '660101' },
    { name: 'มานะ อดทน', score: 1100, yearLevel: 'ม.3', room: '1', studentId: '660103' },
    { name: 'ชูใจ ใจดี', score: 950, yearLevel: 'ม.3', room: '1', studentId: '660105' },
    // ม.2
    { name: 'เดชา เก่งกล้า', score: 1420, yearLevel: 'ม.2', room: '1', studentId: '670101' },
    { name: 'อรดี มีสุข', score: 1280, yearLevel: 'ม.2', room: '2', studentId: '670201' },
    { name: 'ปรีชา ขยันดี', score: 1150, yearLevel: 'ม.2', room: '1', studentId: '670102' },
    { name: 'สุนิตา รักเรียน', score: 1020, yearLevel: 'ม.2', room: '3', studentId: '670301' },
    { name: 'วิชัย ชัยชนะ', score: 890, yearLevel: 'ม.2', room: '2', studentId: '670202' },
    // ม.1
    { name: 'กิตติศักดิ์ พรสุวรรณ', score: 1380, yearLevel: 'ม.1', room: '1', studentId: '680101' },
    { name: 'นิสา แสนดี', score: 1210, yearLevel: 'ม.1', room: '2', studentId: '680201' },
    { name: 'ภานุ วงศ์สกุล', score: 1080, yearLevel: 'ม.1', room: '1', studentId: '680102' },
    { name: 'มนัส ตั้งใจ', score: 930, yearLevel: 'ม.1', room: '3', studentId: '680301' },
    { name: 'ดรุณี มีนา', score: 790, yearLevel: 'ม.1', room: '2', studentId: '680202' }
  ];

  const students = [];
  for (const s of studentsList) {
    const student = await prisma.user.create({
      data: {
        name: s.name,
        role: "STUDENT",
        password: studentPasswordHash,
        passwordHint: "1234",
        status: "ACTIVE",
        studentId: s.studentId,
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random&color=fff&size=150`
      }
    });
    students.push(student);

    // บันทึกเข้าชั้นเรียน
    const targetClass = classrooms[`${s.yearLevel}/${s.room}`];
    if (targetClass) {
      await prisma.studentClass.create({
        data: {
          studentId: student.id,
          classId: targetClass.id
        }
      });

      // บันทึกอันดับ Leaderboard Cache
      await prisma.leaderboard.create({
        data: {
          studentId: student.id,
          classId: targetClass.id,
          totalPoints: s.score
        }
      });
    }

    // บันทึกคะแนนดิบเล่นมินิเกม เพื่อประมวลผล sum(points)
    await prisma.gameScore.create({
      data: {
        studentId: student.id,
        gameType: "space-waves",
        points: s.score
      }
    });

    console.log(`สร้างและจัดการนักเรียนสำเร็จ: ${student.name}`);
  }

  // 4. สร้างการบ้านตัวอย่าง (Assignments)
  const classroom31 = classrooms["ม.3/1"];
  const assignmentFile = await prisma.assignment.create({
    data: {
      classId: classroom31.id,
      title: "การบ้านบทที่ 1: วาดแผนผังขั้นตอนวิธี (Flowchart)",
      description: "ให้นักเรียนวาดแผนผังโฟลว์ชาร์ตขั้นตอนการต้มบะหมี่กึ่งสำเร็จรูปและบันทึกภาพส่งเป็นไฟล์ PNG/PDF ขนาดไม่เกิน 25MB",
      maxPoints: 10,
      isGoogleForm: false,
      status: "PUBLISHED",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  const assignmentGForm = await prisma.assignment.create({
    data: {
      classId: classroom31.id,
      title: "แบบทดสอบท้ายบทที่ 1: ความรู้พื้นฐานเกี่ยวกับอัลกอริทึม",
      description: "ทำแบบทดสอบผ่าน Google Forms ที่ฝังอยู่ในหน้าแดชบอร์ดให้เสร็จสิ้นเพื่อบันทึกการส่งงาน",
      maxPoints: 10,
      isGoogleForm: true,
      googleFormUrl: "https://docs.google.com/forms/d/e/1FAIpQLSf7z2Fm1i45678-abc/viewform?embedded=true",
      status: "PUBLISHED"
    }
  });

  // 5. บันทึกการส่งงานตัวอย่าง (Submissions)
  await prisma.submission.create({
    data: {
      studentId: students[0].id, // สมชาย
      assignmentId: assignmentFile.id,
      fileUrl: "https://example.com/uploads/flowchart_student_somchai.pdf",
      score: null,
      status: "SUBMITTED"
    }
  });

  await prisma.submission.create({
    data: {
      studentId: students[1].id, // สมหญิง
      assignmentId: assignmentFile.id,
      fileUrl: "https://example.com/uploads/flowchart_student_somying.png",
      score: 9,
      feedback: "เขียนทิศทางลูกศรได้ถูกต้องตามสัญลักษณ์มาตรฐาน ดีมากครับ!",
      status: "GRADED"
    }
  });

  // 6. บันทึกเช็คชื่อเข้าเรียนตัวอย่าง (Attendance)
  const today = new Date();
  await prisma.attendance.createMany({
    data: [
      { studentId: students[0].id, classId: classroom31.id, date: today, status: "PRESENT" },
      { studentId: students[1].id, classId: classroom31.id, date: today, status: "LATE", note: "รถรับส่งนักเรียนมาสาย" },
      { studentId: students[2].id, classId: classroom31.id, date: today, status: "ABSENT" }
    ]
  });

  // 7. สร้างคลังสื่อการเรียน (Course Materials)
  await prisma.courseMaterial.create({
    data: {
      classId: classroom31.id,
      title: "บทเรียนที่ 1: แนะนำอัลกอริทึมและผังงาน",
      type: "SLIDE",
      fileUrl: "https://example.com/materials/intro_algorithms.pdf",
      isLocked: false
    }
  });

  // 8. บันทึกแจ้งเตือนตัวอย่าง (Notifications)
  await prisma.notification.create({
    data: {
      recipientId: students[0].id,
      type: "INFO",
      title: "มีภารกิจงานใหม่",
      message: "คุณครูสมชายได้มอบหมายงานชิ้นใหม่: แบบทดสอบท้ายบทที่ 1",
      relatedType: "ASSIGNMENT",
      relatedId: assignmentGForm.id
    }
  });

  console.log("=== สิ้นสุดการทำงานฐานข้อมูลจำลองสมบูรณ์ (Database Seeding Finished Successfully) ===");
}

main()
  .catch((e) => {
    console.error("เกิดข้อผิดพลาดในการรัน Seed: ", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
