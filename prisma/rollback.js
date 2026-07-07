require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function rollback() {
  console.log("=== เริ่มต้นกระบวนการย้อนกลับข้อมูลปีการศึกษา (Academic Year Rollback) ===");

  // 1. ดึง Log ล่าสุดของการทำ Rollover
  const latestLog = await prisma.academicYearLog.findFirst({
    orderBy: { executedAt: 'desc' },
    include: {
      executor: { select: { name: true } }
    }
  });

  if (!latestLog) {
    console.log("❌ ไม่พบประวัติการทำ Rollover ในระบบสำหรับการย้อนกลับ");
    return;
  }

  console.log(`พบรายการล่าสุด: เปลี่ยนผ่านปี ${latestLog.fromYear} ➡️ ${latestLog.toYear}`);
  console.log(`ดำเนินการโดย: ${latestLog.executor?.name} เมื่อเวลา: ${latestLog.executedAt}`);

  const backup = latestLog.backupJson;
  if (!backup || !backup.studentsMapping) {
    console.log("❌ ข้อมูล Backup JSON ใน Log ไม่สมบูรณ์ ไม่สามารถกู้คืนได้");
    return;
  }

  // 2. ดึงประวัติห้องเรียนและนักเรียนจาก Backup
  const classroomsMapping = backup.classroomsMapping || [];
  const studentsMapping = backup.studentsMapping || [];

  console.log(`\n1. กำลังกู้สถานะนักเรียนจำนวน ${studentsMapping.length} คน กลับเป็น ACTIVE...`);
  // คืนสถานะของนักเรียนกลับเป็น ACTIVE ทุกคน (เพราะก่อน Rollover ทุกคนมีสถานะปกติ)
  const studentIds = [...new Set(studentsMapping.map(s => s.studentId))];
  await prisma.user.updateMany({
    where: {
      id: { in: studentIds }
    },
    data: {
      status: "ACTIVE"
    }
  });
  console.log("✅ คืนสถานะ ACTIVE สำเร็จ");

  console.log("\n2. กำลังลบประวัติลงทะเบียนเรียนและลีดเดอร์บอร์ดในปีการศึกษาใหม่...");
  // ลบความสัมพันธ์ห้องเรียนปีใหม่ (StudentClass) และ Leaderboard Cache ของวิชาใหม่ที่สร้างขึ้น
  let studentClassDeleted = 0;
  let leaderboardDeleted = 0;

  for (const sm of studentsMapping) {
    if (sm.newClassroomId) {
      const delClass = await prisma.studentClass.deleteMany({
        where: {
          studentId: sm.studentId,
          classId: sm.newClassroomId
        }
      });
      studentClassDeleted += delClass.count;

      const delLeader = await prisma.leaderboard.deleteMany({
        where: {
          studentId: sm.studentId,
          classId: sm.newClassroomId
        }
      });
      leaderboardDeleted += delLeader.count;
    }
  }
  console.log(`✅ ลบประวัติเข้าเรียนสำเร็จ (${studentClassDeleted} แถว), ลบลีดเดอร์บอร์ดสำเร็จ (${leaderboardDeleted} แถว)`);

  console.log("\n3. กำลังลบห้องเรียนใหม่ที่ถูกสร้างขึ้นในรอบการ Rollover นี้...");
  // ลบเฉพาะห้องเรียนที่ถูกสร้างขึ้นมาใหม่ในรอบนั้น (ห้องที่หมุนเวียนใช้ Reuse จะไม่โดนลบ)
  let classroomsDeleted = 0;
  for (const cm of classroomsMapping) {
    try {
      await prisma.classroom.delete({
        where: { id: cm.newClassroomId }
      });
      classroomsDeleted++;
    } catch (e) {
      // ข้ามกรณีที่ห้องถูกลบไปก่อนแล้ว
    }
  }
  console.log(`✅ ลบห้องเรียนใหม่สำเร็จ ${classroomsDeleted} ห้องเรียน`);

  console.log("\n4. กำลังลบประวัติกิจกรรมล็อกการทำ Rollover ล่าสุดออกจากระบบ...");
  await prisma.academicYearLog.delete({
    where: { id: latestLog.id }
  });
  console.log("✅ ลบ Log เรียบร้อย");

  console.log("\n🎉 ย้อนกลับข้อมูลเสร็จสมบูรณ์! ระบบฐานข้อมูลทุกส่วนถูกย้อนคืนกลับสู่สถานะก่อนปิดปีการศึกษาเรียบร้อยแล้ว");
}

rollback()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
