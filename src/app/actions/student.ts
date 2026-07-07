"use server";

import { db } from "@/lib/db";
import { decrypt } from "@/lib/auth";
import { cookies } from "next/headers";
import { SubmissionStatus, AttendanceStatus } from "@prisma/client";

// ดึงไอดีผู้ใช้ปัจจุบันจากเซสชันคุกกี้
async function getSessionStudent() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;
  if (!sessionToken) return null;

  const session = await decrypt(sessionToken);
  if (!session || !session.userId) return null;

  return session.userId as string;
}

// 1. ดึงวิชาเรียนแรกของนักเรียนเพื่อนำมาแสดงเป็นค่าเริ่มต้น (Default Class)
export async function getStudentDefaultClass() {
  const studentId = await getSessionStudent();
  if (!studentId) return null;

  try {
    const studentClass = await db.studentClass.findFirst({
      where: { studentId },
      include: { classroom: true },
      orderBy: {
        classroom: {
          academicYear: "desc"
        }
      }
    });
    return studentClass?.classroom || null;
  } catch (err) {
    console.error("Failed to get default class:", err);
    return null;
  }
}

// 2. ดึงสื่อการสอนที่ปลดล็อกแล้ว (isLocked: false) สำหรับนักเรียน
export async function getStudentMaterials(classId: string) {
  const studentId = await getSessionStudent();
  if (!studentId || !classId) return [];

  try {
    const cls = await db.classroom.findUnique({
      where: { id: classId },
      select: { yearLevel: true }
    });
    if (!cls) return [];

    return await db.courseMaterial.findMany({
      where: { 
        classroom: {
          yearLevel: cls.yearLevel
        },
        isLocked: false // ดึงเฉพาะเนื้อหาที่เปิดเผยแล้ว
      },
      orderBy: { createdAt: "desc" }
    });
  } catch (err) {
    console.error("Failed to get student materials:", err);
    return [];
  }
}

// 3. ดึงงาน/การบ้านและประวัติการส่งงานของนักเรียนคนนี้
export async function getStudentAssignments(classId: string) {
  const studentId = await getSessionStudent();
  if (!studentId || !classId) return [];

  try {
    const assignments = await db.assignment.findMany({
      where: { classId },
      orderBy: { createdAt: "desc" },
      include: {
        submissions: {
          where: { studentId },
          select: {
            id: true,
            fileUrl: true,
            score: true,
            feedback: true,
            status: true,
            submittedAt: true
          }
        }
      }
    });

    return assignments.map(asm => {
      const { submissions, ...rest } = asm;
      return {
        ...rest,
        submission: submissions[0] || null
      };
    });

  } catch (err) {
    console.error("Failed to get student assignments:", err);
    return [];
  }
}

// 4. บันทึกและส่งการบ้าน (รองรับทั้งลิงก์ URL และอัปโหลดไฟล์)
export async function submitStudentAssignment(assignmentId: string, formData: FormData) {
  const studentId = await getSessionStudent();
  if (!studentId) return { success: false, error: "กรุณาล็อกอินใหม่" };

  const mode = formData.get("mode") as string; // "link" | "file"
  const linkUrl = formData.get("linkUrl") as string;
  const uploadedFile = formData.get("file") as File | null;

  let fileUrl = "";

  if (mode === "file" && uploadedFile && uploadedFile.size > 0) {
    // อัปโหลดไฟล์จริงลงเซิร์ฟเวอร์
    try {
      const { writeFile, mkdir } = await import("fs/promises");
      const { join } = await import("path");

      const bytes = await uploadedFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const uploadDir = join(process.cwd(), "public", "uploads", "submissions");
      await mkdir(uploadDir, { recursive: true });

      // ตั้งชื่อไฟล์ให้ unique ด้วย studentId + timestamp
      const ext = uploadedFile.name.split(".").pop() || "bin";
      const fileName = `${studentId}_${assignmentId}_${Date.now()}.${ext}`;
      const filePath = join(uploadDir, fileName);
      await writeFile(filePath, buffer);

      fileUrl = `/uploads/submissions/${fileName}`;
    } catch (err) {
      console.error("Failed to upload submission file:", err);
      return { success: false, error: "เกิดข้อผิดพลาดในการบันทึกไฟล์ กรุณาลองใหม่อีกครั้ง" };
    }
  } else if (mode === "link" && linkUrl?.trim()) {
    // ส่งลิงก์ URL
    let url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    fileUrl = url;
  } else {
    return { success: false, error: "กรุณาเลือกไฟล์หรือระบุลิงก์ที่ต้องการส่ง" };
  }

  try {
    const sub = await db.submission.upsert({
      where: { studentId_assignmentId: { studentId, assignmentId } },
      update: {
        fileUrl,
        status: SubmissionStatus.SUBMITTED,
        submittedAt: new Date()
      },
      create: {
        studentId,
        assignmentId,
        fileUrl,
        status: SubmissionStatus.SUBMITTED
      }
    });

    // แจ้งเตือนไปยังครูผู้สอน
    const asm = await db.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        classroom: {
          select: {
            teacherId: true,
            name: true,
            yearLevel: true,
            room: true
          }
        }
      }
    });

    if (asm && asm.classroom) {
      const student = await db.user.findUnique({
        where: { id: studentId },
        select: { name: true }
      });

      if (student) {
        // ค้นหาแอดมินทั้งหมด
        const admins = await db.user.findMany({
          where: { role: "ADMIN" },
          select: { id: true }
        });

        // รวบรวม ID ผู้ที่จะได้รับแจ้งเตือน (ครูประจำชั้น + แอดมินทุกคน) ป้องกันข้อมูลซ้ำ
        const recipientIds = new Set<string>();
        recipientIds.add(asm.classroom.teacherId);
        admins.forEach(admin => recipientIds.add(admin.id));

        for (const recipientId of recipientIds) {
          await db.notification.create({
            data: {
              recipientId,
              type: "INFO",
              title: `${student.name} ส่งการบ้านแล้ว 📥`,
              message: `ส่งงานในหัวข้อ "${asm.title}" ของห้อง ${asm.classroom.yearLevel}/${asm.classroom.room}`,
              relatedType: "ASSIGNMENT",
              relatedId: assignmentId
            }
          });
        }
      }
    }

    return { success: true, message: "ส่งผลงานสำเร็จเรียบร้อยแล้ว! 🎉" };
  } catch (err) {
    console.error("Failed to submit assignment:", err);
    return { success: false, error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" };
  }
}

// 5. ดึงคะแนนบอร์ดเกียรติยศ (Leaderboard) ของห้องเรียนนั้นๆ
export async function getClassLeaderboard(classId: string) {
  try {
    return await db.leaderboard.findMany({
      where: { classId },
      include: {
        student: {
          select: { name: true, avatarUrl: true }
        }
      },
      orderBy: { totalPoints: "desc" }
    });
  } catch (err) {
    console.error("Failed to get leaderboard:", err);
    return [];
  }
}

// 6. บันทึกประวัติและคะแนนการเล่นมินิเกม พร้อมซิงค์ตาราง Leaderboard อัตโนมัติ
export async function saveGameScoreAndSync(gameType: string, points: number, classId: string) {
  const studentId = await getSessionStudent();
  if (!studentId || !classId) return { success: false, error: "ไม่มีสิทธิ์ทำรายการ" };

  try {
    // 6.1 บันทึกคะแนนดิบลง GameScore
    await db.gameScore.create({
      data: {
        studentId,
        gameType,
        points
      }
    });

    // 6.2 อัปเดตตาราง Leaderboard (บวกคะแนนเพิ่มจากของเดิม)
    const updatedLeaderboard = await db.leaderboard.upsert({
      where: {
        studentId_classId: {
          studentId,
          classId
        }
      },
      update: {
        totalPoints: { increment: points },
        lastSynced: new Date()
      },
      create: {
        studentId,
        classId,
        totalPoints: points
      }
    });

    return { success: true, totalPoints: updatedLeaderboard.totalPoints };
  } catch (err) {
    console.error("Failed to save game score:", err);
    return { success: false, error: "เกิดข้อผิดพลาดในการบันทึกสถิติคะแนน" };
  }
}

// ------------------------------------------
// 7. ดึงข้อมูลภาพรวมแดชบอร์ดหลักของนักเรียน เชื่อม DB จริง 100%
// ------------------------------------------
export async function getStudentDashboardSummary(classId: string) {
  const studentId = await getSessionStudent();
  if (!studentId || !classId) return null;

  try {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const today = new Date(`${year}-${month}-${day}`);

    // 7.1 ดึงชื่อผู้ใช้และระดับคะแนนสะสมย้อนหลัง
    const user = await db.user.findUnique({
      where: { id: studentId },
      select: { name: true }
    });

    const leaderboardEntry = await db.leaderboard.findUnique({
      where: {
        studentId_classId: {
          studentId,
          classId
        }
      }
    });
    const totalPoints = leaderboardEntry?.totalPoints ?? 0;

    // 7.2 คำนวณอันดับสะสมของนักเรียนคนนี้ในห้องเรียน
    const classLeaderboard = await db.leaderboard.findMany({
      where: { classId },
      orderBy: { totalPoints: "desc" }
    });
    const rank = classLeaderboard.findIndex(l => l.studentId === studentId) + 1 || "-";

    // 7.3 นับจำนวนการบ้านค้างส่ง (ยังไม่ส่ง) ของห้องเรียนนี้
    const totalAssignments = await db.assignment.findMany({
      where: { classId }
    });
    const studentSubmissions = await db.submission.findMany({
      where: { studentId }
    });
    
    // คัดกรองนับรายการที่ยังไม่ได้ส่ง
    const pendingAssignmentsCount = totalAssignments.filter(
      asm => !studentSubmissions.some(sub => sub.assignmentId === asm.id)
    ).length;

    // 7.4 เช็คชื่อเข้าเรียนประจำวันนี้
    const attendanceRecord = await db.attendance.findFirst({
      where: {
        studentId,
        classId,
        date: today
      }
    });
    const attendanceStatus = attendanceRecord?.status ?? null; // PRESENT / LATE / LEAVE / ABSENT หรือ null

    // 7.5 ดึงข้อมูลบทเรียนประกอบวิชาเรียน 3 บทแรก (เปิดเผยแล้ว) โดยอิงตามระดับชั้นปี (yearLevel)
    const cls = await db.classroom.findUnique({
      where: { id: classId },
      select: { yearLevel: true }
    });
    const materials = cls 
      ? await db.courseMaterial.findMany({
          where: { 
            classroom: {
              yearLevel: cls.yearLevel
            },
            isLocked: false 
          },
          orderBy: { createdAt: "desc" },
          take: 3
        })
      : [];

    // 7.6 ดึงข้อมูลการบ้านค้างส่ง 3 ชิ้นล่าสุด
    const pendingAssignments = totalAssignments
      .filter(asm => !studentSubmissions.some(sub => sub.assignmentId === asm.id))
      .slice(0, 3)
      .map(asm => ({
        id: asm.id,
        title: asm.title,
        dueDate: asm.dueDate
      }));

    // 7.7 ดึง Leaderboard 5 อันดับแรกของห้อง
    const top5Leaderboard = await db.leaderboard.findMany({
      where: { classId },
      include: {
        student: { select: { id: true, name: true } }
      },
      orderBy: { totalPoints: "desc" },
      take: 5
    });

    return {
      studentName: user?.name || "นักเรียน",
      stats: {
        totalPoints,
        rank,
        pendingAssignmentsCount
      },
      attendanceStatus,
      materials: materials.map(m => ({
        id: m.id,
        title: m.title,
        type: m.type,
        fileUrl: m.fileUrl
      })),
      pendingAssignments,
      leaderboard: top5Leaderboard.map((l, idx) => ({
        rank: idx + 1,
        studentId: l.studentId,
        studentName: l.student.name,
        totalPoints: l.totalPoints
      }))
    };

  } catch (err) {
    console.error("Failed to calculate student dashboard stats:", err);
    return null;
  }
}

// 8. ดึงประวัติการเข้าเรียนทั้งหมดของนักเรียนคนนี้
export async function getStudentAttendanceHistory(classId: string) {
  const studentId = await getSessionStudent();
  if (!studentId || !classId) return [];

  try {
    const records = await db.attendance.findMany({
      where: { studentId, classId },
      orderBy: { date: "desc" }
    });

    // คำนวณสรุปสถิติ
    const total = records.length;
    const present = records.filter(r => r.status === "PRESENT").length;
    const late = records.filter(r => r.status === "LATE").length;
    const leave = records.filter(r => r.status === "LEAVE").length;
    const absent = records.filter(r => r.status === "ABSENT").length;

    return {
      records: records.map(r => ({
        id: r.id,
        date: r.date,
        status: r.status,
        note: r.note ?? null
      })),
      summary: { total, present, late, leave, absent }
    };
  } catch (err) {
    console.error("Failed to get attendance history:", err);
    return { records: [], summary: { total: 0, present: 0, late: 0, leave: 0, absent: 0 } };
  }
}

// 9. ดึงข้อมูลโปรไฟล์ของนักเรียนที่ล็อกอินอยู่ในปัจจุบันแบบ Dynamic
export async function getCurrentStudentProfile() {
  const studentId = await getSessionStudent();
  if (!studentId) return null;

  try {
    const student = await db.user.findUnique({
      where: { id: studentId },
      include: {
        studentClasses: {
          include: {
            classroom: true
          }
        }
      }
    });

    if (!student) return null;

    const activeEnroll = student.studentClasses[0];
    const classroom = activeEnroll ? activeEnroll.classroom : null;
    
    // แปลง ม.1 -> 1
    let levelNum = "";
    if (classroom) {
      levelNum = classroom.yearLevel.replace("ม.", "");
    }
    const classLabel = classroom ? `นักเรียน ม.${levelNum}/${classroom.room}` : "นักเรียน";

    return {
      name: student.name,
      nickname: student.nickname || "",
      classLabel: classLabel,
      avatarChar: student.name.charAt(0) || "น"
    };
  } catch (err) {
    console.error("Failed to get current student profile:", err);
    return null;
  }
}
