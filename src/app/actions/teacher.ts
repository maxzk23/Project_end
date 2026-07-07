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
  const teacherExists = await db.user.findUnique({ where: { id: session.userId as string } });
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

    // 1. นับจำนวนนักเรียนในห้องเรียนนี้
    const totalStudentsCount = await db.studentClass.count({
      where: { classId }
    });

    // 2. นับการบ้านที่รอดำเนินการตรวจ (score == null) ของห้องนี้
    const pendingGradingCount = await db.submission.count({
      where: {
        score: null,
        assignment: { classId }
      }
    });

    // 3. นับจำนวนบทเรียน/สื่อการสอนที่เปิดอยู่ (isLocked == false) ของห้องนี้
    const unlockedMaterialsCount = await db.courseMaterial.count({
      where: {
        classId,
        isLocked: false
      }
    });

    // 4. สรุปเช็คชื่อรายสถานะประจำวันนี้
    const attendanceRecords = await db.attendance.findMany({
      where: {
        classId,
        date: today
      }
    });

    const presentCount = attendanceRecords.filter(r => r.status === "PRESENT").length;
    const lateCount = attendanceRecords.filter(r => r.status === "LATE").length;
    const leaveCount = attendanceRecords.filter(r => r.status === "LEAVE").length;
    const absentCount = attendanceRecords.filter(r => r.status === "ABSENT").length;

    // 5. ดึงรายการส่งงานการบ้านล่าสุดที่ยังไม่ได้ตรวจ (สูงสุด 3 รายการ)
    const recentSubmissions = await db.submission.findMany({
      where: {
        score: null,
        assignment: { classId }
      },
      include: {
        student: { select: { name: true } },
        assignment: { select: { title: true } }
      },
      orderBy: { submittedAt: "desc" },
      take: 3
    });

    // 6. ดึงสิทธิ์เปิดเผยสื่อบทเรียน (แสดง 3 รายการล่าสุดเพื่อความคล่องตัว)
    const materials = await db.courseMaterial.findMany({
      where: { classId },
      orderBy: { createdAt: "desc" },
      take: 3
    });

    // 7. ดึงบอร์ดเกียรติยศ (Leaderboard) 5 อันดับแรก
    const leaderboard = await db.leaderboard.findMany({
      where: { classId },
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
    const studentClasses = await db.studentClass.findMany({
      where: { classId },
      include: {
        student: {
          select: { id: true, name: true, avatarUrl: true }
        }
      },
      orderBy: { student: { name: "asc" } }
    });

    const attendanceRecords = await db.attendance.findMany({
      where: {
        classId,
        date: {
          equals: date
        }
      }
    });

    return studentClasses.map(sc => {
      const record = attendanceRecords.find(r => r.studentId === sc.studentId);
      return {
        student: sc.student,
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
  records: { studentId: string; status: AttendanceStatus; note?: string }[]
) {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return { success: false, error: "ไม่มีสิทธิ์ทำรายการ" };

  const date = new Date(dateStr);

  try {
    for (const record of records) {
      await db.attendance.upsert({
        where: {
          studentId_classId_date: {
            studentId: record.studentId,
            classId,
            date
          }
        },
        update: {
          status: record.status,
          note: record.note || null
        },
        create: {
          studentId: record.studentId,
          classId,
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

// ==========================================
// 2. MODULE: COURSE MATERIALS (จัดการบทเรียน)
// ==========================================

export async function getCourseMaterials(classIdOrYear: string) {
  const teacherId = await getSessionTeacher();
  if (!teacherId) return [];

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
    const assignments = await db.assignment.findMany({
      where: { classId },
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
