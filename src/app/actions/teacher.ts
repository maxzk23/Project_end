"use server";

import { db } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/auth";
import { cookies } from "next/headers";
import { AttendanceStatus, MaterialType, AssignmentStatus, SubmissionStatus, StudentStatus } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import bcrypt from "bcryptjs";


// ดึงไอดีผู้ใช้ปัจจุบันจากเซสชันคุกกี้
async function getSessionTeacher() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;
  if (!sessionToken) return null;

  const session = await decrypt(sessionToken);
  if (!session || !session.userId || (session.role !== "TEACHER" && session.role !== "ADMIN")) return null;

  // ตรวจสอบความถูกต้องว่าบัญชีผู้ใช้ยังมีอยู่ในระบบจริง (กันเคส Database Reset / Seed)
  const teacherExists = await db.user.findUnique({
    where: { id: session.userId as string },
    select: { id: true }
  });
  if (!teacherExists) return null;

  return session.userId as string;
}

// ------------------------------------------
// ดึงข้อมูลภาพรวมแดชบอร์ดหลักตาม ClassId แบบเชื่อมโยง DB จริง 100%
// ------------------------------------------
export async function getDashboardSummaryData(classId: string) {
  const teacherId = await getSessionTeacher();
  if (!teacherId || !classId) return null;

  try {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const today = new Date(`${year}-${month}-${day}`);

    const isAll = classId === "ALL";

    // 1. นับจำนวนนักเรียนทั้งหมด (หรือในห้องเรียนนี้)
    const totalStudentsCount = isAll
      ? await db.user.count({ where: { role: "STUDENT" } })
      : await db.studentClass.count({ where: { classId } });

    // 2. นับการบ้านที่รอดำเนินการตรวจ (score == null)
    const pendingGradingCount = await db.submission.count({
      where: {
        score: null,
        ...(isAll ? {} : { assignment: { classId } })
      }
    });

    // 3. นับจำนวนบทเรียน/สื่อการสอนที่เปิดอยู่ (isLocked == false)
    const unlockedMaterialsCount = await db.courseMaterial.count({
      where: {
        ...(isAll ? {} : { classId }),
        isLocked: false
      }
    });

    // 4. สรุปเช็คชื่อรายสถานะประจำวันนี้
    const attendanceRecords = await db.attendance.findMany({
      where: {
        ...(isAll ? {} : { classId }),
        date: today
      }
    });

    const presentCount = attendanceRecords.filter(r => r.status === "PRESENT").length;
    const lateCount = attendanceRecords.filter(r => r.status === "LATE").length;
    const leaveCount = attendanceRecords.filter(r => r.status === "LEAVE").length;
    const absentCount = attendanceRecords.filter(r => r.status === "ABSENT").length;

    // 5. ดึงรายการส่งงานการบ้านล่าสุดที่ยังไม่ได้ตรวจ (สูงสุด 5 รายการ)
    const recentSubmissions = await db.submission.findMany({
      where: {
        score: null,
        ...(isAll ? {} : { assignment: { classId } })
      },
      include: {
        student: { select: { name: true } },
        assignment: { select: { title: true } }
      },
      orderBy: { submittedAt: "desc" },
      take: 5
    });

    // 6. ดึงสิทธิ์เปิดเผยสื่อบทเรียน (แสดง 5 รายการล่าสุดเพื่อความคล่องตัว)
    const materials = await db.courseMaterial.findMany({
      where: isAll ? {} : { classId },
      orderBy: { createdAt: "desc" },
      take: 5
    });

    // 7. ดึงบอร์ดเกียรติยศ (Leaderboard) 5 อันดับแรก
    const leaderboard = await db.leaderboard.findMany({
      where: isAll ? {} : { classId },
      include: {
        student: { select: { name: true } }
      },
      orderBy: { totalPoints: "desc" },
      take: 5
    });

    return {
      stats: {
        totalStudents: totalStudentsCount,
        pendingGrading: pendingGradingCount,
        unlockedMaterials: unlockedMaterialsCount,
        totalGames: 1 // มินิเกมคงที่
      },
      attendance: {
        present: presentCount,
        late: lateCount,
        leave: leaveCount,
        absent: absentCount
      },
      recentSubmissions: recentSubmissions.map(s => ({
        id: s.id,
        assignmentTitle: s.assignment.title,
        studentName: s.student.name,
        submittedAt: s.submittedAt
      })),
      materials: materials.map(m => ({
        id: m.id,
        title: m.title,
        type: m.type,
        isLocked: m.isLocked
      })),
      leaderboard: leaderboard.map((l, idx) => ({
        rank: idx + 1,
        studentName: l.student.name,
        totalPoints: l.totalPoints
      }))
    };

  } catch (err) {
    console.error("Dashboard calculation error:", err);
    return null;
  }
}

// ==========================================
// 1. MODULE: ATTENDANCE (ระบบเช็คชื่อ)
// ==========================================

export async function getAttendanceData(classId: string, dateStr: string) {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return null;

  const date = new Date(dateStr);

  try {
    const teacher = await db.user.findUnique({
      where: { id: teacherId },
      select: { role: true }
    });

    let classWhereClause: any = { classId };

    if (classId === "ALL" || !classId) {
      if (teacher?.role === "ADMIN") {
        classWhereClause = {};
      } else {
        const teacherClassrooms = await db.classroom.findMany({
          where: { teacherId },
          select: { id: true }
        });
        classWhereClause = { classId: { in: teacherClassrooms.map(c => c.id) } };
      }
    }

    const studentClasses = await db.studentClass.findMany({
      where: classWhereClause,
      include: {
        student: {
          select: { id: true, name: true, avatarUrl: true }
        },
        classroom: {
          select: { id: true, name: true, yearLevel: true, room: true }
        }
      },
      orderBy: { student: { name: "asc" } }
    });

    const attendanceRecords = await db.attendance.findMany({
      where: {
        ...(classId === "ALL" || !classId ? classWhereClause : { classId }),
        date: {
          equals: date
        }
      }
    });

    return studentClasses.map(sc => {
      const record = attendanceRecords.find(r => r.studentId === sc.studentId && r.classId === sc.classId);
      return {
        student: sc.student,
        classId: sc.classId,
        classroomName: `${sc.classroom.name} (${sc.classroom.yearLevel}/${sc.classroom.room})`,
        status: record ? record.status : null,
        note: record ? record.note : ""
      };
    });

  } catch (err) {
    console.error("Failed to get attendance data:", err);
    return [];
  }
}

export async function saveAttendance(
  classId: string,
  dateStr: string,
  records: { studentId: string; classId?: string; status: AttendanceStatus; note?: string }[]
) {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return { success: false, error: "ไม่มีสิทธิ์ทำรายการ" };

  const date = new Date(dateStr);

  try {
    for (const record of records) {
      const targetClassId = record.classId || classId;
      if (!targetClassId || targetClassId === "ALL") continue;

      await db.attendance.upsert({
        where: {
          studentId_classId_date: {
            studentId: record.studentId,
            classId: targetClassId,
            date
          }
        },
        update: {
          status: record.status,
          note: record.note || null
        },
        create: {
          studentId: record.studentId,
          classId: targetClassId,
          date,
          status: record.status,
          note: record.note || null
        }
      });
    }

    return { success: true, message: "บันทึกการเช็คชื่อเข้าเรียนเสร็จสิ้น" };
  } catch (err) {
    console.error("Failed to save attendance:", err);
    return { success: false, error: "เกิดข้อผิดพลาดในการบันทึกข้อมูลเข้า DB" };
  }
}

/**
 * ยืนยันรหัสผ่านเพื่อปลดล็อกการแก้ไขการเช็คชื่อ
 */
export async function verifyTeacherUnlockPassword(password: string) {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return { success: false, error: "ไม่มีสิทธิ์ทำรายการ" };

  if (!password || !password.trim()) {
    return { success: false, error: "กรุณากรอกรหัสผ่านปลดล็อก" };
  }

  try {
    const teacher = await db.user.findUnique({
      where: { id: teacherId },
      select: { password: true }
    });

    if (!teacher) {
      return { success: false, error: "ไม่พบบัญชีผู้ใช้ครูในระบบ" };
    }

    // ยอมรับรหัสผ่านประจำตัวครูผู้ใช้ หรือ PIN เริ่มต้น "1234"
    const isValid = bcrypt.compareSync(password.trim(), teacher.password) || password.trim() === "1234";

    if (!isValid) {
      return { success: false, error: "รหัสผ่านปลดล็อกไม่ถูกต้อง" };
    }

    return { success: true };
  } catch (err) {
    console.error("Failed to verify unlock password:", err);
    return { success: false, error: "เกิดข้อผิดพลาดในการตรวจสอบรหัสผ่าน" };
  }
}

// ==========================================
// 2. MODULE: COURSE MATERIALS (จัดการบทเรียน)
// ==========================================

export async function getCourseMaterials(classIdOrYear: string) {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return [];

  if (classIdOrYear === "ALL" || !classIdOrYear) {
    try {
      return await db.courseMaterial.findMany({
        orderBy: { createdAt: "desc" }
      });
    } catch (err) {
      console.error("Failed to get all materials:", err);
      return [];
    }
  }

  const isInputUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classIdOrYear);

  try {
    return await db.courseMaterial.findMany({
      where: isInputUuid
        ? {
            OR: [
              { classId: classIdOrYear },
              {
                classroom: {
                  yearLevel: classIdOrYear
                }
              }
            ]
          }
        : {
            classroom: {
              yearLevel: classIdOrYear
            }
          },
      orderBy: { createdAt: "desc" }
    });
  } catch (err) {
    console.error("Failed to get materials:", err);
    return [];
  }
}

export async function toggleMaterialLock(materialId: string, isLocked: boolean) {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return { success: false, error: "ไม่มีสิทธิ์ทำรายการ" };

  try {
    const material = await db.courseMaterial.update({
      where: { id: materialId },
      data: { isLocked }
    });

    // ถ้าทำการปลดล็อกสื่อการสอน ให้แจ้งเตือนนักเรียนทุกคนในห้องเรียนนั้นๆ
    if (!isLocked && material.classId) {
      const students = await db.studentClass.findMany({
        where: { classId: material.classId },
        select: { studentId: true }
      });

      for (const s of students) {
        await db.notification.create({
          data: {
            recipientId: s.studentId,
            type: "INFO",
            title: `บทเรียนใหม่ได้รับการปลดล็อกแล้ว: ${material.title} 📖`,
            message: `คุณครูได้เปิดบทเรียนและสไลด์ใหม่สำหรับห้องเรียนของคุณ เข้าไปทบทวนเนื้อหาได้เลย!`,
            relatedType: "LESSON",
            relatedId: materialId
          }
        });
      }
    }

    return { success: true, message: isLocked ? "ล็อกสื่อการสอนแล้ว" : "ปลดล็อกสื่อการสอนแล้ว" };
  } catch (err) {
    console.error("Failed to toggle material lock:", err);
    return { success: false, error: "เกิดข้อผิดพลาดในการอัปเดตข้อมูล" };
  }
}

export async function createCourseMaterial(yearLevelOrClassId: string, formData: FormData) {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return { success: false, error: "ไม่มีสิทธิ์ทำรายการ" };

  const title = formData.get("title") as string;
  const type = formData.get("type") as MaterialType;
  let fileUrl = formData.get("fileUrl") as string;
  const isLocked = formData.get("isLocked") === "true";
  const file = formData.get("file") as File | null;

  if (!title || !type || !fileUrl) {
    return { success: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" };
  }

  // หากมีการส่งไฟล์อัปโหลดจริง ให้เซฟลงดิสก์เซิร์ฟเวอร์
  if (file && file.size > 0) {
    try {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      const uploadDir = join(process.cwd(), "public", "uploads", "materials");
      await mkdir(uploadDir, { recursive: true });

      const filePath = join(uploadDir, file.name);
      await writeFile(filePath, buffer);
      
      fileUrl = `/uploads/materials/${file.name}`;
    } catch (err) {
      console.error("Failed to write uploaded file:", err);
      return { success: false, error: "เกิดข้อผิดพลาดในการบันทึกไฟล์อัปโหลดลงบนเซิร์ฟเวอร์" };
    }
  }

  try {
    const isInputUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(yearLevelOrClassId);
    let targetClassId = yearLevelOrClassId;

    const classroom = await db.classroom.findFirst({
      where: isInputUuid
        ? {
            OR: [
              { id: yearLevelOrClassId },
              { yearLevel: yearLevelOrClassId }
            ]
          }
        : {
            yearLevel: yearLevelOrClassId
          }
    });

    if (classroom) {
      targetClassId = classroom.id;
    } else {
      return { success: false, error: `ไม่พบห้องเรียนสำหรับระดับชั้น ${yearLevelOrClassId} ในระบบ กรุณาสร้างห้องเรียนก่อนเพิ่มสื่อ` };
    }

    const material = await db.courseMaterial.create({
      data: {
        classId: targetClassId,
        title: title.trim(),
        type,
        fileUrl: fileUrl.trim(),
        isLocked
      }
    });

    // หากเพิ่มมาแล้วไม่ได้ล็อกไว้ ให้แจ้งเตือนนักเรียนทุกคนในห้องเรียนนั้นๆ
    if (!isLocked) {
      const students = await db.studentClass.findMany({
        where: { classId: targetClassId },
        select: { studentId: true }
      });

      for (const s of students) {
        await db.notification.create({
          data: {
            recipientId: s.studentId,
            type: "INFO",
            title: `บทเรียนใหม่: ${title.trim()} 📖`,
            message: `คุณครูได้เพิ่มเอกสารบทเรียนใหม่เข้ามาในระบบประเภท ${type}`,
            relatedType: "LESSON",
            relatedId: material.id
          }
        });
      }
    }

    return { success: true, message: "สร้างเอกสารบทเรียนใหม่เรียบร้อยแล้ว" };
  } catch (err: any) {
    console.error("Failed to create material:", err);
    return { success: false, error: `เกิดข้อผิดพลาดในการเซฟข้อมูล: ${err?.message || err}` };
  }
}

// ==========================================
// 3. MODULE: GRADING & ASSIGNMENT (ตรวจการบ้าน)
// ==========================================

export async function getAssignmentsWithSubmissions(classId: string) {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return [];

  try {
    const teacher = await db.user.findUnique({
      where: { id: teacherId },
      select: { role: true }
    });

    let whereClause: any = { classId };

    if (classId === "ALL" || !classId) {
      if (teacher?.role === "ADMIN") {
        whereClause = {};
      } else {
        const teacherClassrooms = await db.classroom.findMany({
          where: { teacherId },
          select: { id: true }
        });
        whereClause = { classId: { in: teacherClassrooms.map(c => c.id) } };
      }
    }

    const assignments = await db.assignment.findMany({
      where: whereClause,
      include: {
        submissions: {
          include: {
            student: {
              select: { id: true, name: true, avatarUrl: true }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    return assignments;
  } catch (err) {
    console.error("Failed to get assignments:", err);
    return [];
  }
}

export async function createAssignment(classId: string, formData: FormData) {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return { success: false, error: "ไม่มีสิทธิ์" };

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const maxPoints = parseInt(formData.get("maxPoints") as string || "10");
  const isGoogleForm = formData.get("isGoogleForm") === "true";
  const googleFormUrl = formData.get("googleFormUrl") as string;
  const dueDateStr = formData.get("dueDate") as string;

  if (!title) return { success: false, error: "กรุณาระบุหัวข้องาน" };

  const dueDate = dueDateStr ? new Date(dueDateStr) : null;

  try {
    const asm = await db.assignment.create({
      data: {
        classId,
        title: title.trim(),
        description: description?.trim() || null,
        maxPoints,
        isGoogleForm,
        googleFormUrl: isGoogleForm ? googleFormUrl?.trim() : null,
        dueDate,
        status: AssignmentStatus.PUBLISHED
      }
    });

    // แจ้งเตือนไปยังนักเรียนทุกคนในห้องเรียน
    const students = await db.studentClass.findMany({
      where: { classId },
      select: { studentId: true }
    });

    for (const s of students) {
      await db.notification.create({
        data: {
          recipientId: s.studentId,
          type: "INFO",
          title: `มีภารกิจงานใหม่: ${title.trim()} 📋`,
          message: `คุณครูได้สั่งงานใหม่ คะแนนเต็ม ${maxPoints} คะแนน${dueDate ? ` กำหนดส่งวันที่ ${dueDate.toLocaleDateString("th-TH")}` : ""}`,
          relatedType: "ASSIGNMENT",
          relatedId: asm.id
        }
      });
    }

    return { success: true, message: "สร้างการบ้านชิ้นใหม่และประกาศแล้ว" };
  } catch (err) {
    console.error("Failed to create assignment:", err);
    return { success: false, error: "เกิดข้อผิดพลาดในการสร้างใบงาน" };
  }
}

export async function updateAssignment(assignmentId: string, formData: FormData) {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return { success: false, error: "ไม่มีสิทธิ์" };

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const isGoogleForm = formData.get("isGoogleForm") === "true";
  const googleFormUrl = formData.get("googleFormUrl") as string;

  if (!title) return { success: false, error: "กรุณาระบุหัวข้องาน" };

  try {
    await db.assignment.update({
      where: { id: assignmentId },
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        isGoogleForm,
        googleFormUrl: isGoogleForm ? googleFormUrl?.trim() : null,
      }
    });
    return { success: true, message: "แก้ไขการบ้านเรียบร้อยแล้ว" };
  } catch (err) {
    console.error("Failed to update assignment:", err);
    return { success: false, error: "เกิดข้อผิดพลาดในการแก้ไขใบงาน" };
  }
}

export async function gradeSubmission(
  submissionId: string,
  score: number,
  feedback: string
) {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return { success: false, error: "ไม่มีสิทธิ์" };

  try {
    const sub = await db.submission.update({
      where: { id: submissionId },
      data: {
        score,
        feedback: feedback.trim() || null,
        status: SubmissionStatus.GRADED
      },
      include: {
        assignment: {
          select: { title: true, maxPoints: true }
        }
      }
    });

    // แจ้งเตือนไปยังนักเรียนที่ส่งงาน
    await db.notification.create({
      data: {
        recipientId: sub.studentId,
        type: "SUCCESS",
        title: `การบ้านของคุณได้รับการตรวจแล้ว! 📝`,
        message: `คุณครูได้ตรวจใบงาน "${sub.assignment.title}" แล้ว ได้คะแนน ${score}/${sub.assignment.maxPoints} คะแนน${feedback.trim() ? ` (คำติชม: ${feedback.trim()})` : ""}`,
        relatedType: "ASSIGNMENT",
        relatedId: sub.assignmentId
      }
    });

    return { success: true, message: "ให้คะแนนการส่งงานเรียบร้อยแล้ว" };
  } catch (err) {
    console.error("Failed to grade submission:", err);
    return { success: false, error: "เกิดข้อผิดพลาดในการบันทึกคะแนน" };
  }
}

// ------------------------------------------
// ดึงข้อมูลวิเคราะห์และติดตามผลงานของนักเรียน (Student Work Tracking & Analytics)
// ------------------------------------------
export async function getStudentTrackingData(classId: string) {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return null;

  try {
    const teacher = await db.user.findUnique({
      where: { id: teacherId },
      select: { role: true }
    });

    let classroomWhere: any = {};
    if (classId !== "ALL" && classId) {
      classroomWhere = { id: classId };
    } else if (teacher?.role !== "ADMIN") {
      classroomWhere = { teacherId };
    }

    const classrooms = await db.classroom.findMany({
      where: classroomWhere,
      select: { id: true, name: true, yearLevel: true, room: true, academicYear: true },
      orderBy: [{ yearLevel: "asc" }, { room: "asc" }]
    });

    const targetClassIds = classrooms.map(c => c.id);
    if (targetClassIds.length === 0) {
      return {
        classrooms: [],
        students: [],
        assignments: [],
        studentProgress: [],
        overallStats: {
          totalStudents: 0,
          totalAssignments: 0,
          totalExpectedSubmissions: 0,
          totalActualSubmissions: 0,
          overallPercentage: 0,
          completedStudentsCount: 0,
          atRiskStudentsCount: 0,
          onTimeSubmissions: 0,
          lateSubmissions: 0,
          gradedSubmissions: 0,
          pendingSubmissions: 0
        }
      };
    }

    // 1. ดึงนักเรียนที่ลงทะเบียนในห้องเรียนเหล่านี้
    const studentClasses = await db.studentClass.findMany({
      where: { classId: { in: targetClassIds } },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            studentId: true,
            rollNumber: true,
            gender: true,
            avatarUrl: true,
            parentPhone: true
          }
        },
        classroom: {
          select: { id: true, name: true, yearLevel: true, room: true }
        }
      },
      orderBy: [
        { classroom: { yearLevel: "asc" } },
        { classroom: { room: "asc" } },
        { student: { rollNumber: "asc" } },
        { student: { name: "asc" } }
      ]
    });

    // 2. ดึงใบงานทั้งหมดที่สั่งในห้องเรียนเหล่านี้
    const assignments = await db.assignment.findMany({
      where: { classId: { in: targetClassIds } },
      include: {
        classroom: {
          select: { id: true, name: true, yearLevel: true, room: true }
        },
        submissions: {
          include: {
            student: {
              select: { id: true, name: true, studentId: true, rollNumber: true, avatarUrl: true }
            }
          },
          orderBy: { submittedAt: "desc" }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // แมปจำนวนนักเรียนต่อห้อง
    const studentsPerClassMap = new Map<string, number>();
    classrooms.forEach(c => {
      const count = studentClasses.filter(sc => sc.classId === c.id).length;
      studentsPerClassMap.set(c.id, count);
    });

    // คำนวณรายละเอียดและสถิติของแต่ละ Assignment
    const assignmentsWithStats = assignments.map(asm => {
      const classStudentClasses = studentClasses.filter(sc => sc.classId === asm.classId);
      const totalEnrolled = classStudentClasses.length;
      const submittedStudentIds = new Set(asm.submissions.map(s => s.studentId));

      const missingStudents = classStudentClasses
        .filter(sc => !submittedStudentIds.has(sc.studentId))
        .map(sc => ({
          id: sc.student.id,
          name: sc.student.name,
          studentId: sc.student.studentId,
          rollNumber: sc.student.rollNumber,
          avatarUrl: sc.student.avatarUrl,
          parentPhone: sc.student.parentPhone,
          classroomName: `${sc.classroom.name} (${sc.classroom.yearLevel}/${sc.classroom.room})`
        }));

      const submittedCount = asm.submissions.length;
      const gradedCount = asm.submissions.filter(s => s.status === "GRADED").length;
      const pendingCount = asm.submissions.filter(s => s.status !== "GRADED").length;
      const percentage = totalEnrolled > 0 ? Math.round((submittedCount / totalEnrolled) * 1000) / 10 : 0;

      let onTimeCount = 0;
      let lateCount = 0;
      asm.submissions.forEach(sub => {
        if (!asm.dueDate) {
          onTimeCount++;
        } else {
          const isLate = new Date(sub.submittedAt) > new Date(asm.dueDate);
          if (isLate) lateCount++;
          else onTimeCount++;
        }
      });

      return {
        id: asm.id,
        classId: asm.classId,
        classroomName: `${asm.classroom.name} (${asm.classroom.yearLevel}/${asm.classroom.room})`,
        title: asm.title,
        description: asm.description,
        maxPoints: asm.maxPoints,
        isGoogleForm: asm.isGoogleForm,
        googleFormUrl: asm.googleFormUrl,
        dueDate: asm.dueDate,
        createdAt: asm.createdAt,
        totalEnrolled,
        submittedCount,
        gradedCount,
        pendingCount,
        missingCount: missingStudents.length,
        percentage,
        onTimeCount,
        lateCount,
        missingStudents,
        submissions: asm.submissions.map(s => ({
          id: s.id,
          studentId: s.studentId,
          studentName: s.student.name,
          studentRollNumber: s.student.rollNumber,
          avatarUrl: s.student.avatarUrl,
          status: s.status,
          score: s.score,
          feedback: s.feedback,
          fileUrl: s.fileUrl,
          submittedAt: s.submittedAt,
          isLate: asm.dueDate ? new Date(s.submittedAt) > new Date(asm.dueDate) : false
        }))
      };
    });

    // 3. คำนวณความคืบหน้ารายบุคคล (Student Progress)
    // จัดกลุ่มนักเรียนตาม ID (หากลงหลายวิชา ให้แสดงตามรายการ studentClasses)
    const studentProgress = studentClasses.map(sc => {
      const classAssignments = assignments.filter(a => a.classId === sc.classId);
      const totalAsms = classAssignments.length;

      const submittedAsms: any[] = [];
      const missingAsms: any[] = [];
      let totalScore = 0;
      let maxScorePossible = 0;
      let gradedCount = 0;
      let pendingCount = 0;

      classAssignments.forEach(asm => {
        const sub = asm.submissions.find(s => s.studentId === sc.studentId);
        if (sub) {
          const isLate = asm.dueDate ? new Date(sub.submittedAt) > new Date(asm.dueDate) : false;
          if (sub.status === "GRADED") {
            gradedCount++;
            totalScore += (sub.score || 0);
            maxScorePossible += asm.maxPoints;
          } else {
            pendingCount++;
          }
          submittedAsms.push({
            assignmentId: asm.id,
            title: asm.title,
            maxPoints: asm.maxPoints,
            dueDate: asm.dueDate,
            submittedAt: sub.submittedAt,
            status: sub.status,
            score: sub.score,
            feedback: sub.feedback,
            isLate,
            fileUrl: sub.fileUrl
          });
        } else {
          const isOverdue = asm.dueDate ? new Date() > new Date(asm.dueDate) : false;
          missingAsms.push({
            assignmentId: asm.id,
            title: asm.title,
            maxPoints: asm.maxPoints,
            dueDate: asm.dueDate,
            isOverdue
          });
        }
      });

      const submittedCount = submittedAsms.length;
      const percentage = totalAsms > 0 ? Math.round((submittedCount / totalAsms) * 1000) / 10 : (totalAsms === 0 ? 100 : 0);
      const isComplete = totalAsms > 0 && submittedCount === totalAsms;
      const isAtRisk = missingAsms.some(m => m.isOverdue) || (totalAsms > 0 && percentage < 60);

      return {
        studentId: sc.student.id,
        name: sc.student.name,
        rollNumber: sc.student.rollNumber,
        studentCode: sc.student.studentId,
        gender: sc.student.gender,
        avatarUrl: sc.student.avatarUrl,
        parentPhone: sc.student.parentPhone,
        classId: sc.classId,
        classroomName: `${sc.classroom.name} (${sc.classroom.yearLevel}/${sc.classroom.room})`,
        totalAssignments: totalAsms,
        submittedCount,
        missingCount: missingAsms.length,
        gradedCount,
        pendingCount,
        percentage,
        isComplete,
        isAtRisk,
        totalScore,
        maxScorePossible,
        averageScore: maxScorePossible > 0 ? Math.round((totalScore / maxScorePossible) * 1000) / 10 : null,
        missingAssignments: missingAsms,
        submittedAssignments: submittedAsms
      };
    });

    // 4. สถิติภาพรวม (Overall Stats)
    let totalExpectedSubmissions = 0;
    assignmentsWithStats.forEach(a => {
      totalExpectedSubmissions += a.totalEnrolled;
    });

    const totalActualSubmissions = assignmentsWithStats.reduce((sum, a) => sum + a.submittedCount, 0);
    const overallPercentage = totalExpectedSubmissions > 0
      ? Math.round((totalActualSubmissions / totalExpectedSubmissions) * 1000) / 10
      : 0;

    const completedStudentsCount = studentProgress.filter(sp => sp.isComplete).length;
    const atRiskStudentsCount = studentProgress.filter(sp => sp.isAtRisk).length;
    const onTimeSubmissions = assignmentsWithStats.reduce((sum, a) => sum + a.onTimeCount, 0);
    const lateSubmissions = assignmentsWithStats.reduce((sum, a) => sum + a.lateCount, 0);
    const gradedSubmissions = assignmentsWithStats.reduce((sum, a) => sum + a.gradedCount, 0);
    const pendingSubmissions = assignmentsWithStats.reduce((sum, a) => sum + a.pendingCount, 0);

    return {
      classrooms,
      students: studentClasses.map(sc => ({
        ...sc.student,
        classId: sc.classId,
        classroomName: `${sc.classroom.name} (${sc.classroom.yearLevel}/${sc.classroom.room})`
      })),
      assignments: assignmentsWithStats,
      studentProgress,
      overallStats: {
        totalStudents: studentClasses.length,
        totalAssignments: assignments.length,
        totalExpectedSubmissions,
        totalActualSubmissions,
        overallPercentage,
        completedStudentsCount,
        atRiskStudentsCount,
        onTimeSubmissions,
        lateSubmissions,
        gradedSubmissions,
        pendingSubmissions
      }
    };
  } catch (err) {
    console.error("Failed to get student tracking data:", err);
    return null;
  }
}

// ------------------------------------------
// ส่งการแจ้งเตือนตามการบ้าน (1-Click Assignment Reminder)
// ------------------------------------------
export async function sendAssignmentReminder(assignmentId: string, studentIds?: string[]) {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };

  try {
    const assignment = await db.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        classroom: { select: { name: true, yearLevel: true, room: true } },
        submissions: { select: { studentId: true } }
      }
    });

    if (!assignment) return { success: false, error: "ไม่พบใบงานที่ระบุ" };

    let targetStudentIds: string[] = [];

    if (studentIds && studentIds.length > 0) {
      // ตรวจสอบเฉพาะที่ยังไม่ได้ส่ง
      const submittedSet = new Set(assignment.submissions.map(s => s.studentId));
      targetStudentIds = studentIds.filter(id => !submittedSet.has(id));
    } else {
      // ดึงนักเรียนในห้องที่ยังไม่ส่ง
      const enrolledStudents = await db.studentClass.findMany({
        where: { classId: assignment.classId },
        select: { studentId: true }
      });
      const submittedSet = new Set(assignment.submissions.map(s => s.studentId));
      targetStudentIds = enrolledStudents
        .map(e => e.studentId)
        .filter(id => !submittedSet.has(id));
    }

    if (targetStudentIds.length === 0) {
      return { success: true, count: 0, message: "นักเรียนทุกคนส่งงานนี้เรียบร้อยแล้ว ไม่มีค้างส่ง 🎉" };
    }

    const dueDateText = assignment.dueDate
      ? ` (กำหนดส่ง: ${new Date(assignment.dueDate).toLocaleDateString("th-TH")})`
      : "";

    // สร้างการแจ้งเตือนส่งให้นักเรียนเป้าหมายทุกคน
    for (const sId of targetStudentIds) {
      await db.notification.create({
        data: {
          recipientId: sId,
          type: "WARNING",
          title: `แจ้งเตือนส่งงาน: ${assignment.title} ⏰`,
          message: `คุณครูแจ้งเตือนให้ส่งงาน "${assignment.title}" ของวิชา ${assignment.classroom.name} (${assignment.classroom.yearLevel}/${assignment.classroom.room})${dueDateText} กรุณาเร่งดำเนินการส่งผลงาน`,
          relatedType: "ASSIGNMENT",
          relatedId: assignment.id
        }
      });
    }

    return {
      success: true,
      count: targetStudentIds.length,
      message: `ส่งการแจ้งเตือนตามงานไปยังนักเรียน ${targetStudentIds.length} คนเรียบร้อยแล้ว 🔔`
    };
  } catch (err) {
    console.error("Failed to send assignment reminder:", err);
    return { success: false, error: "เกิดข้อผิดพลาดในการส่งแจ้งเตือน" };
  }
}

// ------------------------------------------
// ส่งการแจ้งเตือนตามงานค้างทั้งหมดของนักเรียนรายบุคคล
// ------------------------------------------
export async function sendStudentMissingReminder(studentId: string, missingTitles: string[]) {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return { success: false, error: "ไม่มีสิทธิ์ดำเนินการ" };

  try {
    const titlesStr = missingTitles.slice(0, 3).join(", ") + (missingTitles.length > 3 ? ` และอีก ${missingTitles.length - 3} งาน` : "");

    await db.notification.create({
      data: {
        recipientId: studentId,
        type: "WARNING",
        title: `คุณครูแจ้งเตือนงานที่ยังค้างส่ง (${missingTitles.length} งาน) 📋`,
        message: `คุณครูตรวจสอบพบว่าคุณยังมีงานค้างส่ง ได้แก่: ${titlesStr} กรุณาตรวจสอบในเมนูการบ้านและเร่งส่งงานให้ครบถ้วน`,
        relatedType: "ASSIGNMENT"
      }
    });

    return { success: true, message: "ส่งข้อความแจ้งเตือนเตือนนักเรียนเรียบร้อยแล้ว 🔔" };
  } catch (err) {
    console.error("Failed to send student missing reminder:", err);
    return { success: false, error: "เกิดข้อผิดพลาดในการส่งแจ้งเตือน" };
  }
}

// ==========================================
// 4. MODULE: ACADEMIC YEAR ROLLOVER (ตั้งค่าและปิดปีการศึกษา)
// ==========================================

export async function getRolloverLogs() {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return [];

  try {
    return await db.academicYearLog.findMany({
      include: {
        executor: {
          select: { name: true }
        }
      },
      orderBy: { executedAt: "desc" }
    });
  } catch (err) {
    console.error("Failed to get rollover logs:", err);
    return [];
  }
}

function getNextYearLevel(currentLevel: string): { nextLevel: string | null; isFinal: boolean } {
  const normalized = currentLevel.trim();
  const digitMatch = normalized.match(/\d+/);
  if (!digitMatch) {
    return { nextLevel: null, isFinal: false };
  }
  const currentDigit = parseInt(digitMatch[0], 10);
  const prefix = normalized.replace(/\d+/g, "").trim();

  // หากระดับชั้นเรียนเป็น ม.3 หรือ ม.6 หรือเทียบเท่าที่เป็นระดับสุดท้ายของการเรียน
  if (currentDigit === 3 || currentDigit === 6) {
    return { nextLevel: null, isFinal: true };
  }

  const nextDigit = currentDigit + 1;
  return { nextLevel: `${prefix}${nextDigit}`, isFinal: false };
}

export async function executeAcademicRollover(
  fromYear: string,
  toYear: string,
  retainedStudentIds: string[]
) {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return { success: false, error: "ไม่มีสิทธิ์ทำรายการ" };

  try {
    // 1. ดึงข้อมูลนักเรียนที่เป็น ACTIVE ทั้งหมด พร้อมคลาสเรียนของปีการศึกษา fromYear
    const activeStudents = await db.user.findMany({
      where: { role: "STUDENT", status: "ACTIVE" },
      include: {
        studentClasses: {
          where: {
            classroom: {
              academicYear: fromYear
            }
          },
          include: { classroom: true }
        }
      }
    });

    let graduatedCount = 0;
    let retainedCount = 0;
    let promotedCount = 0;

    const resolvedClassrooms = new Map<string, string>(); // Cache ห้องเรียนเป้าหมายที่ค้นหาหรือสร้างแล้ว เพื่อป้องกันสร้างซ้ำ
    const studentClassesToCreate: { studentId: string; classId: string }[] = [];

    const classroomsMappingSnapshot: { oldClassroomId: string; newClassroomId: string; name: string; yearLevel: string; room: string }[] = [];
    const studentsMappingSnapshot: { studentId: string; name: string; oldClassroomId: string; newClassroomId: string; targetStatus: string }[] = [];

    // วนลูปเพื่อย้ายชั้นเรียนและห้องเรียนให้นักเรียนแต่ละคน
    for (const student of activeStudents) {
      const isRetained = retainedStudentIds.includes(student.id);

      if (student.studentClasses.length === 0) {
        // เด็กไม่มีห้องเรียนเก่าในปีการศึกษา fromYear ให้คงสถานะ ACTIVE ไว้และไม่จับเข้าห้องใหม่
        studentsMappingSnapshot.push({
          studentId: student.id,
          name: student.name,
          oldClassroomId: "",
          newClassroomId: "",
          targetStatus: "ACTIVE"
        });
        continue;
      }

      let hasBeenPromoted = false;
      let hasBeenRetained = false;
      let hasBeenGraduated = false;

      for (const sc of student.studentClasses) {
        const oldClass = sc.classroom;

        if (isRetained) {
          // --- กรณีเด็กซ้ำชั้น ---
          hasBeenRetained = true;
          const targetYearLevel = oldClass.yearLevel; // ระดับชั้นเรียนเดิม
          const classKey = `${oldClass.name}_${targetYearLevel}_${oldClass.room}_${oldClass.teacherId}`;

          let newClassroomId = resolvedClassrooms.get(classKey);

          if (!newClassroomId) {
            // ค้นหาห้องระดับชั้นเดิมของปีการศึกษาใหม่ toYear ก่อนเพื่อนำกลับมาใช้ใหม่ (Reuse)
            const existing = await db.classroom.findFirst({
              where: {
                name: oldClass.name,
                yearLevel: targetYearLevel,
                room: oldClass.room,
                academicYear: toYear,
                teacherId: oldClass.teacherId
              }
            });

            if (existing) {
              newClassroomId = existing.id;
            } else {
              // ถ้ายังไม่มี ค่อยสร้างห้องเรียนระดับเดียวกันใหม่ในปี toYear
              const created = await db.classroom.create({
                data: {
                  name: oldClass.name,
                  yearLevel: targetYearLevel,
                  room: oldClass.room,
                  academicYear: toYear,
                  teacherId: oldClass.teacherId
                }
              });
              newClassroomId = created.id;
              classroomsMappingSnapshot.push({
                oldClassroomId: oldClass.id,
                newClassroomId,
                name: oldClass.name,
                yearLevel: targetYearLevel,
                room: oldClass.room
              });
            }
            resolvedClassrooms.set(classKey, newClassroomId);
          }

          studentClassesToCreate.push({
            studentId: student.id,
            classId: newClassroomId
          });

          studentsMappingSnapshot.push({
            studentId: student.id,
            name: student.name,
            oldClassroomId: oldClass.id,
            newClassroomId,
            targetStatus: "RETAINED"
          });

        } else {
          // --- กรณีเด็กปกติ (เลื่อนชั้น หรือ จบการศึกษา) ---
          const { nextLevel, isFinal } = getNextYearLevel(oldClass.yearLevel);

          if (isFinal) {
            hasBeenGraduated = true;
            studentsMappingSnapshot.push({
              studentId: student.id,
              name: student.name,
              oldClassroomId: oldClass.id,
              newClassroomId: "",
              targetStatus: "GRADUATED"
            });
          } else if (nextLevel) {
            hasBeenPromoted = true;
            const classKey = `${oldClass.name}_${nextLevel}_${oldClass.room}_${oldClass.teacherId}`;

            let newClassroomId = resolvedClassrooms.get(classKey);

            if (!newClassroomId) {
              // ค้นหาห้องระดับชั้นถัดไปของปีการศึกษาใหม่ toYear ก่อนเพื่อนำกลับมาใช้ใหม่ (Reuse)
              const existing = await db.classroom.findFirst({
                where: {
                  name: oldClass.name,
                  yearLevel: nextLevel,
                  room: oldClass.room,
                  academicYear: toYear,
                  teacherId: oldClass.teacherId
                }
              });

              if (existing) {
                newClassroomId = existing.id;
              } else {
                // ถ้ายังไม่มี ค่อยสร้างห้องเรียนระดับใหม่ในปี toYear
                const created = await db.classroom.create({
                  data: {
                    name: oldClass.name,
                    yearLevel: nextLevel,
                    room: oldClass.room,
                    academicYear: toYear,
                    teacherId: oldClass.teacherId
                  }
                });
                newClassroomId = created.id;
                classroomsMappingSnapshot.push({
                  oldClassroomId: oldClass.id,
                  newClassroomId,
                  name: oldClass.name,
                  yearLevel: nextLevel,
                  room: oldClass.room
                });
              }
              resolvedClassrooms.set(classKey, newClassroomId);
            }

            studentClassesToCreate.push({
              studentId: student.id,
              classId: newClassroomId
            });

            studentsMappingSnapshot.push({
              studentId: student.id,
              name: student.name,
              oldClassroomId: oldClass.id,
              newClassroomId,
              targetStatus: "ACTIVE"
            });
          }
        }
      }

      // ปรับปรุงสถานะโปรไฟล์บัญชีนักเรียน
      let targetStatus: StudentStatus = "ACTIVE";
      if (hasBeenRetained) {
        targetStatus = "RETAINED";
        retainedCount++;
      } else if (hasBeenGraduated) {
        targetStatus = "GRADUATED";
        graduatedCount++;
      } else if (hasBeenPromoted) {
        targetStatus = "ACTIVE";
        promotedCount++;
      }

      await db.user.update({
        where: { id: student.id },
        data: { status: targetStatus }
      });
    }

    // 2. บันทึกความสัมพันธ์ของนักเรียนเข้าชั้นเรียนใหม่แบบกลุ่มเดียว (Batch create studentClasses)
    if (studentClassesToCreate.length > 0) {
      await db.studentClass.createMany({
        data: studentClassesToCreate,
        skipDuplicates: true
      });

      // 3. เริ่มต้นสร้างลีดเดอร์บอร์ด (Cache Data) ด้วยคะแนน 0 ให้กับนักเรียนทั้งหมดในห้องเรียนวิชาใหม่
      const leaderboardsToCreate = studentClassesToCreate.map(sc => ({
        studentId: sc.studentId,
        classId: sc.classId,
        totalPoints: 0
      }));

      await db.leaderboard.createMany({
        data: leaderboardsToCreate,
        skipDuplicates: true
      });
    }

    // 4. บันทึกสถิติและ Mapping Snapshot สำหรับการกู้คืนประวัติลง AcademicYearLog
    const backupJson = {
      classroomsMapping: classroomsMappingSnapshot,
      studentsMapping: studentsMappingSnapshot
    };

    await db.academicYearLog.create({
      data: {
        executedBy: teacherId,
        fromYear,
        toYear,
        retainedCount,
        graduatedCount,
        promotedCount,
        backupJson
      }
    });

    return {
      success: true,
      message: `ประมวลผลสำเร็จ: นักเรียนสำเร็จการศึกษา ${graduatedCount} คน, เลื่อนชั้นสำเร็จ ${promotedCount} คน, ซ้ำชั้นเรียน ${retainedCount} คน`
    };

  } catch (err) {
    console.error("Failed to run rollover:", err);
    return { success: false, error: "เกิดข้อผิดพลาดในการประมวลผลเลื่อนชั้นเรียน" };
  }
}

// 6. ดึงสถิติประวัติการเช็คชื่อเข้าชั้นเรียนทั้งหมดเพื่อสรุปย้อนหลัง (คลังข้อมูล)
export async function getAttendanceHistoryLogs() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;
  if (!sessionToken) return [];

  const session = await decrypt(sessionToken);
  if (!session || !session.userId || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
    return [];
  }

  const userId = session.userId as string;
  const userRole = session.role as string;

  try {
    const isAdmin = userRole === "ADMIN";

    // 1. ดึงวิชา/ห้องเรียนที่รับผิดชอบ
    const classrooms = await db.classroom.findMany({
      where: isAdmin ? {} : { teacherId: userId },
      select: { id: true, name: true, yearLevel: true, room: true }
    });

    const classIds = classrooms.map(c => c.id);

    // 2. ดึงข้อมูลการเช็คชื่อทั้งหมด
    const attendanceRecords = await db.attendance.findMany({
      where: {
        classId: { in: classIds }
      },
      orderBy: { date: "desc" }
    });

    // 3. ดึงจำนวนนักเรียนต่อห้องเรียนเพื่อหาอัตราส่วนมาเรียน
    const studentClasses = await db.studentClass.findMany({
      where: {
        classId: { in: classIds }
      }
    });

    const groups: { [key: string]: any } = {};

    for (const record of attendanceRecords) {
      // แปลงวันที่เป็น YYYY-MM-DD
      const dateKey = record.date.toISOString().split("T")[0];
      const groupKey = `${dateKey}_${record.classId}`;

      if (!groups[groupKey]) {
        const cls = classrooms.find(c => c.id === record.classId);
        const totalStudents = studentClasses.filter(sc => sc.classId === record.classId).length;

        groups[groupKey] = {
          date: dateKey,
          classId: record.classId,
          classLabel: cls ? cls.yearLevel : "",
          roomLabel: cls ? cls.room : "",
          total: totalStudents || 0,
          present: 0,
          late: 0,
          leave: 0,
          absent: 0
        };
      }

      const g = groups[groupKey];
      if (record.status === "PRESENT") g.present++;
      else if (record.status === "LATE") g.late++;
      else if (record.status === "LEAVE") g.leave++;
      else if (record.status === "ABSENT") g.absent++;
    }

    const list = Object.values(groups).map(g => {
      const totalRecords = g.present + g.late + g.leave + g.absent;
      const rate = totalRecords > 0 ? Math.round(((g.present + g.late + g.leave) / totalRecords) * 100) : 0;
      return {
        ...g,
        rate
      };
    });

    list.sort((a, b) => b.date.localeCompare(a.date));
    return list;
  } catch (err) {
    console.error("Failed to fetch attendance history logs:", err);
    return [];
  }
}

export async function updateCourseMaterial(materialId: string, yearLevelOrClassId: string, formData: FormData) {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return { success: false, error: "ไม่มีสิทธิ์ทำรายการ" };

  const title = formData.get("title") as string;
  const type = formData.get("type") as MaterialType;
  let fileUrl = formData.get("fileUrl") as string;
  const isLocked = formData.get("isLocked") === "true";
  const file = formData.get("file") as File | null;

  if (!title || !type || !fileUrl) {
    return { success: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" };
  }

  // หากมีการส่งไฟล์อัปโหลดจริง ให้เซฟลงดิสก์เซิร์ฟเวอร์
  if (file && file.size > 0) {
    try {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      const uploadDir = join(process.cwd(), "public", "uploads", "materials");
      await mkdir(uploadDir, { recursive: true });

      const filePath = join(uploadDir, file.name);
      await writeFile(filePath, buffer);
      
      fileUrl = `/uploads/materials/${file.name}`;
    } catch (err) {
      console.error("Failed to write uploaded file:", err);
      return { success: false, error: "เกิดข้อผิดพลาดในการบันทึกไฟล์อัปโหลดลงบนเซิร์ฟเวอร์" };
    }
  }

  try {
    const isInputUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(yearLevelOrClassId);
    let targetClassId = yearLevelOrClassId;

    const classroom = await db.classroom.findFirst({
      where: isInputUuid
        ? {
            OR: [
              { id: yearLevelOrClassId },
              { yearLevel: yearLevelOrClassId }
            ]
          }
        : {
            yearLevel: yearLevelOrClassId
          }
    });

    if (classroom) {
      targetClassId = classroom.id;
    } else {
      return { success: false, error: `ไม่พบห้องเรียนสำหรับระดับชั้น ${yearLevelOrClassId} ในระบบ กรุณาสร้างห้องเรียนก่อนเพิ่มสื่อ` };
    }

    await db.courseMaterial.update({
      where: { id: materialId },
      data: {
        classId: targetClassId,
        title: title.trim(),
        type,
        fileUrl: fileUrl.trim(),
        isLocked
      }
    });

    return { success: true, message: "แก้ไขเอกสารบทเรียนเรียบร้อยแล้ว" };
  } catch (err: any) {
    console.error("Failed to update material:", err);
    return { success: false, error: `เกิดข้อผิดพลาดในการอัปเดตข้อมูล: ${err?.message || err}` };
  }
}

export async function deleteCourseMaterial(materialId: string) {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return { success: false, error: "ไม่มีสิทธิ์ทำรายการ" };

  try {
    await db.courseMaterial.delete({
      where: { id: materialId }
    });
    return { success: true, message: "ลบเอกสารบทเรียนออกจากระบบเรียบร้อยแล้ว" };
  } catch (err: any) {
    console.error("Failed to delete material:", err);
    return { success: false, error: `เกิดข้อผิดพลาดในการลบข้อมูล: ${err?.message || err}` };
  }
}

export async function deleteAssignment(assignmentId: string) {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return { success: false, error: "ไม่มีสิทธิ์ทำรายการ" };

  try {
    await db.assignment.delete({
      where: { id: assignmentId }
    });
    return { success: true, message: "ลบรายการมอบหมายงานเรียบร้อยแล้ว" };
  } catch (err: any) {
    console.error("Failed to delete assignment:", err);
    return { success: false, error: `เกิดข้อผิดพลาดในการลบข้อมูล: ${err?.message || err}` };
  }
}

export async function getRolloverStudents(fromYear: string) {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return [];

  try {
    const studentClasses = await db.studentClass.findMany({
      where: {
        classroom: {
          academicYear: fromYear
        }
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            studentId: true,
            avatarUrl: true,
            status: true
          }
        },
        classroom: {
          select: {
            id: true,
            name: true,
            yearLevel: true,
            room: true
          }
        }
      }
    });

    const studentsMap = new Map();
    for (const sc of studentClasses) {
      if (sc.student.status !== "GRADUATED") {
        studentsMap.set(sc.student.id, {
          id: sc.student.id,
          name: sc.student.name,
          studentId: sc.student.studentId,
          avatarUrl: sc.student.avatarUrl,
          status: sc.student.status,
          yearLevel: sc.classroom.yearLevel,
          room: sc.classroom.room,
          classroomId: sc.classroom.id
        });
      }
    }
    return Array.from(studentsMap.values());
  } catch (err) {
    console.error("Failed to get rollover students:", err);
    return [];
  }
}

export async function exportSystemBackup() {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return { error: "ไม่มีสิทธิ์ทำรายการ" };

  try {
    const classrooms = await db.classroom.findMany();
    const users = await db.user.findMany();
    const studentClasses = await db.studentClass.findMany();
    const assignments = await db.assignment.findMany();
    const submissions = await db.submission.findMany();
    const attendance = await db.attendance.findMany();
    const leaderboards = await db.leaderboard.findMany();
    const gameScores = await db.gameScore.findMany();

    return {
      success: true,
      data: {
        classrooms,
        users,
        studentClasses,
        assignments,
        submissions,
        attendance,
        leaderboards,
        gameScores
      }
    };
  } catch (err: any) {
    console.error("Failed to export backup:", err);
    return { error: `Failed to export: ${err?.message || err}` };
  }
}

export async function restoreSystemFromBackup(backupData: any) {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return { success: false, error: "ไม่มีสิทธิ์ทำรายการ" };

  try {
    if (!backupData || !backupData.users || !backupData.classrooms) {
      return { success: false, error: "โครงสร้างไฟล์สำรองไม่ถูกต้อง" };
    }

    await db.$transaction(async (tx) => {
      // 1. ล้างข้อมูลตารางที่มีความสัมพันธ์ก่อนตามลำดับ
      await tx.leaderboard.deleteMany();
      await tx.gameScore.deleteMany();
      await tx.attendance.deleteMany();
      await tx.submission.deleteMany();
      await tx.assignment.deleteMany();
      await tx.studentClass.deleteMany();
      await tx.academicYearLog.deleteMany();
      await tx.notification.deleteMany();
      await tx.classroom.deleteMany();
      await tx.user.deleteMany();

      // 2. เติมข้อมูลผู้ใช้ (Users) - มีความยืดหยุ่นรองรับทั้งแบบเต็มและแบบย่อเดิม
      const defaultUserPassword = bcrypt.hashSync("1234", 10);
      const defaultTeacherPassword = bcrypt.hashSync("teacher", 10);
      const defaultAdminPassword = bcrypt.hashSync("admin", 10);

      const usersToInsert = backupData.users.map((u: any) => {
        let password = u.password;
        let passwordHint = u.passwordHint;
        if (!password) {
          if (u.role === "ADMIN") {
            password = defaultAdminPassword;
            passwordHint = "admin";
          } else if (u.role === "TEACHER") {
            password = defaultTeacherPassword;
            passwordHint = "teacher";
          } else {
            password = defaultUserPassword;
            passwordHint = "1234";
          }
        }
        return {
          id: u.id,
          name: u.name,
          role: u.role,
          status: u.status || "ACTIVE",
          avatarUrl: u.avatarUrl || null,
          password: password,
          passwordHint: passwordHint,
          studentId: u.studentId || null,
          nickname: u.nickname || null,
          gender: u.gender || null,
          rollNumber: u.rollNumber || null,
          parentPhone: u.parentPhone || null,
          createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
        };
      });

      await tx.user.createMany({
        data: usersToInsert
      });

      // 3. เติมข้อมูลห้องเรียน (Classrooms)
      await tx.classroom.createMany({
        data: backupData.classrooms
      });

      // 4. เติมข้อมูลประวัติลงทะเบียนเรียน (StudentClass)
      if (backupData.studentClasses && backupData.studentClasses.length > 0) {
        await tx.studentClass.createMany({
          data: backupData.studentClasses
        });
      }

      // 5. เติมข้อมูลใบงาน (Assignments)
      if (backupData.assignments && backupData.assignments.length > 0) {
        await tx.assignment.createMany({
          data: backupData.assignments.map((a: any) => ({
            ...a,
            dueDate: a.dueDate ? new Date(a.dueDate) : null,
            createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
          }))
        });
      }

      // 6. เติมข้อมูลการส่งงาน (Submissions)
      if (backupData.submissions && backupData.submissions.length > 0) {
        await tx.submission.createMany({
          data: backupData.submissions.map((s: any) => ({
            ...s,
            submittedAt: s.submittedAt ? new Date(s.submittedAt) : new Date(),
            gradedAt: s.gradedAt ? new Date(s.gradedAt) : null,
          }))
        });
      }

      // 7. เติมข้อมูลการเช็คชื่อ (Attendance)
      if (backupData.attendance && backupData.attendance.length > 0) {
        await tx.attendance.createMany({
          data: backupData.attendance.map((att: any) => ({
            ...att,
            date: new Date(att.date),
            createdAt: att.createdAt ? new Date(att.createdAt) : new Date(),
          }))
        });
      }

      // 8. เติมข้อมูลลีดเดอร์บอร์ด (Leaderboard)
      if (backupData.leaderboards && backupData.leaderboards.length > 0) {
        await tx.leaderboard.createMany({
          data: backupData.leaderboards
        });
      }

      // 9. เติมข้อมูลคะแนนเกม (GameScores)
      if (backupData.gameScores && backupData.gameScores.length > 0) {
        await tx.gameScore.createMany({
          data: backupData.gameScores.map((gs: any) => ({
            ...gs,
            playedAt: gs.playedAt ? new Date(gs.playedAt) : new Date(),
          }))
        });
      }
    });

    // อัปเดตคุกกี้กลับมาเป็นคุณครูตัวใหม่จากการกู้คืนเพื่อให้หน้าเว็บทำงานต่อได้ทันที
    const newTeacher = await db.user.findFirst({
      where: { role: "TEACHER" }
    });

    if (newTeacher) {
      const sessionData = {
        userId: newTeacher.id,
        role: newTeacher.role,
        name: newTeacher.name,
      };
      const encryptedSession = await encrypt(sessionData);
      const cookieStore = await cookies();
      cookieStore.set("session", encryptedSession, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 2, // 2 ชั่วโมง
      });
    }

    return { success: true, message: "กู้คืนระบบจากไฟล์สำรองสำเร็จเรียบร้อยแล้ว! 🎉" };
  } catch (err: any) {
    console.error("Failed to restore from backup:", err);
    return { success: false, error: `เกิดข้อผิดพลาดในการกู้คืนข้อมูล: ${err?.message || err}` };
  }
}


export async function resetDatabaseSeed() {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return { success: false, error: "ไม่มีสิทธิ์ทำรายการ" };

  try {
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);
    
    await execAsync("node prisma/seed.js");

    // ดึงบัญชีครูตัวใหม่ที่พึ่งผ่านการ Seed เข้าไปใหม่ เพื่อนำมาอัปเดต Cookie
    const newTeacher = await db.user.findFirst({
      where: { role: "TEACHER" }
    });

    if (newTeacher) {
      const sessionData = {
        userId: newTeacher.id,
        role: newTeacher.role,
        name: newTeacher.name,
      };
      const encryptedSession = await encrypt(sessionData);
      const cookieStore = await cookies();
      cookieStore.set("session", encryptedSession, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 2, // 2 ชั่วโมง
      });
    }

    return { success: true, message: "รีเซ็ตฐานข้อมูลเริ่มต้นสำเร็จเรียบร้อยแล้ว! 🎉" };
  } catch (err: any) {
    console.error("Failed to run seed reset:", err);
    return { success: false, error: `เกิดข้อผิดพลาดในการรีเซ็ตฐานข้อมูล: ${err?.message || err}` };
  }
}

export async function getTeacherSidebarCounts() {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return { pendingGrading: 0, unreadNotifications: 0 };

  try {
    const pendingGrading = await db.submission.count({
      where: { score: null }
    });

    const unreadNotifications = await db.notification.count({
      where: { recipientId: teacherId, isRead: false }
    });

    return { pendingGrading, unreadNotifications };
  } catch (err) {
    console.error("Failed to get teacher sidebar counts:", err);
    return { pendingGrading: 0, unreadNotifications: 0 };
  }
}
