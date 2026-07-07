"use server";

import { db } from "@/lib/db";
import { decrypt } from "@/lib/auth";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

// ฟังก์ชันดึงไอดีและสิทธิ์ผู้ใช้จากเซสชันคุกกี้
async function getSessionUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;
  if (!sessionToken) return null;

  const session = await decrypt(sessionToken);
  if (!session || !session.userId) return null;

  // ตรวจสอบความถูกต้องว่าบัญชีผู้ใช้ยังมีอยู่ในระบบจริง (กันเคส Database Reset / Seed)
  const userExists = await db.user.findUnique({ where: { id: session.userId as string } });
  if (!userExists) return null;

  return {
    id: session.userId as string,
    role: session.role as string,
  };
}

// 1. ดึงห้องเรียนทั้งหมดที่คุณครูคนนี้สอนอยู่
export async function getTeacherClassrooms() {
  const user = await getSessionUser();
  if (!user || (user.role !== "TEACHER" && user.role !== "ADMIN")) return [];

  try {
    const isAdmin = user.role === "ADMIN";
    const classrooms = await db.classroom.findMany({
      where: isAdmin ? {} : { teacherId: user.id },
      orderBy: [
        { yearLevel: "asc" },
        { room: "asc" }
      ],
    });
    return classrooms;
  } catch (err) {
    console.error("Failed to get classrooms:", err);
    return [];
  }
}

// 2. ดึงห้องเรียนทั้งหมดที่นักเรียนคนนี้ลงทะเบียนเรียนไว้
export async function getStudentClassrooms() {
  const user = await getSessionUser();
  if (!user) return [];

  try {
    // สืบค้นจาก StudentClass โยงหา Classroom
    const enrolledClasses = await db.studentClass.findMany({
      where: { studentId: user.id },
      include: {
        classroom: {
          include: {
            teacher: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { joinedAt: "desc" }
    });
    
    return enrolledClasses.map(ec => ({
      ...ec.classroom,
      teacherName: ec.classroom.teacher.name
    }));
  } catch (err) {
    console.error("Failed to get student classrooms:", err);
    return [];
  }
}

// 3. ฟังก์ชันสร้างห้องเรียนใหม่สำหรับคุณครู
export async function createClassroom(prevState: any, formData: FormData) {
  const user = await getSessionUser();
  if (!user || user.role !== "TEACHER" && user.role !== "ADMIN") {
    return { success: false, error: "ไม่มีสิทธิ์ในการสร้างห้องเรียน" };
  }

  const name = formData.get("name") as string;
  const yearLevel = formData.get("yearLevel") as string;
  const room = formData.get("room") as string;
  const academicYear = formData.get("academicYear") as string;

  if (!name || !yearLevel || !room || !academicYear) {
    return { success: false, error: "กรุณากรอกข้อมูลห้องเรียนให้ครบถ้วน" };
  }

  try {
    const newClass = await db.classroom.create({
      data: {
        name: name.trim(),
        yearLevel: yearLevel.trim(),
        room: room.trim(),
        academicYear: academicYear.trim(),
        teacherId: user.id,
      },
    });

    return { success: true, classroomId: newClass.id };
  } catch (err) {
    console.error("Failed to create classroom:", err);
    return { success: false, error: "เกิดข้อผิดพลาดในการบันทึกห้องเรียน" };
  }
}

// 4. ดึงข้อมูลรายชื่อนักเรียนในห้องเรียนที่ต้องการ
export async function getClassroomDetails(classId: string) {
  const user = await getSessionUser();
  if (!user) return null;

  try {
    // 4.1 ข้อมูลห้องเรียน
    const classroom = await db.classroom.findUnique({
      where: { id: classId },
      include: {
        teacher: {
          select: { name: true, avatarUrl: true }
        }
      }
    });

    if (!classroom) return null;

    // 4.2 รายชื่อนักเรียนในห้องนี้
    const studentsInClass = await db.studentClass.findMany({
      where: { classId: classId },
      include: {
        student: {
          select: { id: true, name: true, avatarUrl: true, status: true, passwordHint: true }
        }
      },
      orderBy: { student: { name: "asc" } }
    });

    return {
      classroom,
      students: studentsInClass.map(s => s.student)
    };

  } catch (err) {
    console.error("Failed to get classroom details:", err);
    return null;
  }
}

// 5. นำเข้ากลุ่มรายชื่อนักเรียนจำนวนมาก (จากข้อมูล Excel หรือกรอกมือ)
export async function importStudentsToClassroom(classId: string, studentNames: string[], password?: string) {
  const user = await getSessionUser();
  if (!user || user.role !== "TEACHER" && user.role !== "ADMIN") {
    return { success: false, error: "ไม่มีสิทธิ์ลงทะเบียนรายชื่อนักเรียน" };
  }

  if (!studentNames || studentNames.length === 0) {
    return { success: false, error: "ไม่พบรายชื่อนักเรียนสำหรับนำเข้า" };
  }

  const defaultPasswordText = password && password.trim() ? password.trim() : "student";
  const defaultPasswordHash = bcrypt.hashSync(defaultPasswordText, 10);
  let importedCount = 0;
  let enrolledCount = 0;

  try {
    // ประมวลผลทีละชื่อ
    for (const name of studentNames) {
      const cleanName = name.trim();
      if (!cleanName) continue;

      // 5.1 ตรวจเช็คว่ามี User ชื่อนี้อยู่แล้วหรือไม่
      let student = await db.user.findFirst({
        where: { name: cleanName, role: "STUDENT" }
      });

      // 5.2 ถ้าไม่มี ให้สร้างผู้ใช้งานขึ้นมาใหม่
      if (!student) {
        student = await db.user.create({
          data: {
            name: cleanName,
            password: defaultPasswordHash,
            passwordHint: defaultPasswordText,
            role: "STUDENT",
            status: "ACTIVE"
          }
        });
        importedCount++;
      } else {
        // อัปเดตรหัสผ่านใหม่กรณีครูเลือกส่งค่ารหัสผ่านใหม่เข้ามาทับ
        await db.user.update({
          where: { id: student.id },
          data: {
            password: defaultPasswordHash,
            passwordHint: defaultPasswordText
          }
        });
      }

      // 5.3 ตรวจสอบว่าเคยลงทะเบียนเข้าชั้นเรียนนี้ไปหรือยัง
      const existingEnroll = await db.studentClass.findUnique({
        where: {
          studentId_classId: {
            studentId: student.id,
            classId: classId
          }
        }
      });

      // 5.4 ถ้ายังไม่ลงทะเบียน ให้จับคู่นักเรียนเข้าห้องเรียน
      if (!existingEnroll) {
        await db.studentClass.create({
          data: {
            studentId: student.id,
            classId: classId
          }
        });
        enrolledCount++;
      }
    }

    return { 
      success: true, 
      message: `นำเข้าสำเร็จ: สร้างบัญชีใหม่ ${importedCount} คน และลงทะเบียนเข้าห้องเรียนนี้ ${enrolledCount} คน` 
    };

  } catch (err) {
    console.error("Failed to import students:", err);
    return { success: false, error: "เกิดข้อผิดพลาดในระบบระเบียบฐานข้อมูล" };
  }
}

// 6. แก้ไขข้อมูลห้องเรียน
export async function updateClassroom(prevState: any, formData: FormData) {
  const user = await getSessionUser();
  if (!user || (user.role !== "TEACHER" && user.role !== "ADMIN")) {
    return { success: false, error: "ไม่มีสิทธิ์ในการแก้ไขห้องเรียน" };
  }

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const yearLevel = formData.get("yearLevel") as string;
  const room = formData.get("room") as string;
  const academicYear = formData.get("academicYear") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!id || !name || !yearLevel || !room || !academicYear || !confirmPassword) {
    return { success: false, error: "กรุณากรอกข้อมูลห้องเรียนและรหัสผ่านเพื่อยืนยันให้ครบถ้วน" };
  }

  try {
    // ยืนยันรหัสผ่านผู้ใช้งานปัจจุบัน
    const dbUser = await db.user.findUnique({ where: { id: user.id } });
    if (!dbUser || !bcrypt.compareSync(confirmPassword, dbUser.password)) {
      return { success: false, error: "รหัสผ่านยืนยันไม่ถูกต้อง การแก้ไขข้อมูลล้มเหลว" };
    }

    const existing = await db.classroom.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "ไม่พบห้องเรียนที่ต้องการแก้ไข" };
    }
    if (existing.teacherId !== user.id && user.role !== "ADMIN") {
      return { success: false, error: "ไม่มีสิทธิ์แก้ไขห้องเรียนของครูท่านอื่น" };
    }

    await db.classroom.update({
      where: { id },
      data: {
        name: name.trim(),
        yearLevel: yearLevel.trim(),
        room: room.trim(),
        academicYear: academicYear.trim(),
      },
    });

    return { success: true };
  } catch (err) {
    console.error("Failed to update classroom:", err);
    return { success: false, error: "เกิดข้อผิดพลาดในการแก้ไขข้อมูลห้องเรียน" };
  }
}

// 7. ลบห้องเรียน
export async function deleteClassroom(classId: string, confirmPassword: string) {
  const user = await getSessionUser();
  if (!user || (user.role !== "TEACHER" && user.role !== "ADMIN")) {
    return { success: false, error: "ไม่มีสิทธิ์ในการลบห้องเรียน" };
  }

  if (!confirmPassword) {
    return { success: false, error: "กรุณากรอกรหัสผ่านเพื่อยืนยันการลบห้องเรียน" };
  }

  try {
    // ยืนยันรหัสผ่านผู้ใช้งานปัจจุบัน
    const dbUser = await db.user.findUnique({ where: { id: user.id } });
    if (!dbUser || !bcrypt.compareSync(confirmPassword, dbUser.password)) {
      return { success: false, error: "รหัสผ่านยืนยันไม่ถูกต้อง การลบข้อมูลล้มเหลว" };
    }

    const existing = await db.classroom.findUnique({ where: { id: classId } });
    if (!existing) {
      return { success: false, error: "ไม่พบห้องเรียนที่ต้องการลบ" };
    }
    if (existing.teacherId !== user.id && user.role !== "ADMIN") {
      return { success: false, error: "ไม่มีสิทธิ์ลบห้องเรียนของครูท่านอื่น" };
    }

    await db.classroom.delete({
      where: { id: classId },
    });

    return { success: true };
  } catch (err) {
    console.error("Failed to delete classroom:", err);
    return { success: false, error: "เกิดข้อผิดพลาดในการลบห้องเรียน" };
  }
}

// 8. ดึงข้อมูลนักเรียนทั้งหมดในระบบ (รวมระดับชั้น, ห้องเรียน, คะแนนสะสมมินิเกม)
export async function getAllStudents() {
  const user = await getSessionUser();
  if (!user || (user.role !== "TEACHER" && user.role !== "ADMIN")) {
    return [];
  }

  try {
    const students = await db.user.findMany({
      where: { role: "STUDENT" },
      include: {
        studentClasses: {
          include: {
            classroom: true
          }
        },
        gameScores: true
      },
      orderBy: { name: "asc" }
    });

    const result: any[] = [];

    for (const s of students) {
      const totalPoints = s.gameScores.reduce((acc, curr) => acc + curr.points, 0);

      if (s.studentClasses.length === 0) {
        result.push({
          id: s.id,
          name: s.name,
          avatarUrl: s.avatarUrl,
          status: s.status,
          studentId: s.studentId || "ไม่มีรหัส",
          passwordHint: s.passwordHint || "1234",
          nickname: s.nickname || "",
          gender: s.gender || "",
          rollNumber: s.rollNumber || "",
          parentPhone: s.parentPhone || "",
          yearLevel: "",
          room: "",
          academicYear: "2568",
          classroomId: null,
          totalPoints: totalPoints
        });
      } else {
        for (const sc of s.studentClasses) {
          result.push({
            id: s.id,
            name: s.name,
            avatarUrl: s.avatarUrl,
            status: s.status,
            studentId: s.studentId || "ไม่มีรหัส",
            passwordHint: s.passwordHint || "1234",
            nickname: s.nickname || "",
            gender: s.gender || "",
            rollNumber: s.rollNumber || "",
            parentPhone: s.parentPhone || "",
            yearLevel: sc.classroom.yearLevel,
            room: sc.classroom.room,
            academicYear: sc.classroom.academicYear,
            classroomId: sc.classroom.id,
            totalPoints: totalPoints
          });
        }
      }
    }

    return result;
  } catch (err) {
    console.error("Failed to fetch all students:", err);
    return [];
  }
}

// 9. เพิ่มข้อมูลนักเรียนใหม่และสร้างหรือเชื่อมห้องเรียนให้ทันที
export async function createGlobalStudent(
  name: string, 
  studentId: string, 
  yearLevel: string, 
  room: string, 
  passwordHint: string,
  nickname?: string,
  gender?: string,
  rollNumber?: string,
  parentPhone?: string,
  academicYear: string = "2568"
) {
  const user = await getSessionUser();
  if (!user || (user.role !== "TEACHER" && user.role !== "ADMIN")) {
    return { success: false, error: "ไม่มีสิทธิ์ลงทะเบียนรายชื่อนักเรียน" };
  }

  // ป้องกันเคสเซสชันค้าง (Stale Session) จากการล้าง DB หรือรีเซ็ตข้อมูลครู
  const dbTeacher = await db.user.findUnique({ where: { id: user.id } });
  if (!dbTeacher) {
    return { success: false, error: "เซสชันค้างเนื่องจากการรีเซ็ตระบบครูผู้สอน กรุณากดปุ่มออกจากระบบแล้วเข้าล็อกอินใหม่อีกครั้งเพื่อเริ่มทำงาน" };
  }

  const cleanName = name.trim();
  const cleanStudentId = studentId.trim();
  const cleanPass = passwordHint.trim() || "1234";

  if (!cleanName || !cleanStudentId || !yearLevel || !room) {
    return { success: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" };
  }

  // ป้องกันปัญหารหัสประจำตัวนักเรียนซ้ำในระบบ
  const existingStudentId = await db.user.findFirst({
    where: { studentId: cleanStudentId, role: "STUDENT" }
  });

  if (existingStudentId && existingStudentId.name !== cleanName) {
    return { success: false, error: `รหัสนักเรียน "${cleanStudentId}" มีผู้ใช้งานแล้วในระบบ (คือ ${existingStudentId.name})` };
  }

  try {
    // หาครูสำหรับกรณีต้องสร้างห้องเรียนใหม่ (ใช้ไอดีครูปัจจุบัน)
    const teacherId = user.id;

    // หาห้องเรียนปลายทาง (หากยังไม่มี ให้สร้างขึ้นมาอัตโนมัติ)
    let classroom = await db.classroom.findFirst({
      where: { yearLevel: yearLevel, room: room, academicYear }
    });

    if (!classroom) {
      classroom = await db.classroom.create({
        data: {
          name: "เทคโนโลยีวิทยาการคำนวณ",
          yearLevel,
          room,
          academicYear,
          teacherId
        }
      });
    }

    // ตรวจสอบชื่อซ้ำ
    let student = await db.user.findFirst({
      where: { name: cleanName, role: "STUDENT" }
    });

    if (!student) {
      student = await db.user.create({
        data: {
          name: cleanName,
          password: bcrypt.hashSync(cleanPass, 10),
          passwordHint: cleanPass,
          studentId: cleanStudentId,
          nickname: nickname?.trim() || null,
          gender: gender || null,
          rollNumber: rollNumber?.trim() || null,
          parentPhone: parentPhone?.trim() || null,
          role: "STUDENT",
          status: "ACTIVE",
          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=random&color=fff&size=150`
        }
      });
    } else {
      // ถ้ามีนักเรียนอยู่แล้ว แต่อาจยังไม่ลงทะเบียนเรียนในห้องนี้ ให้เชื่อมไอดีเข้าเรียน
      await db.user.update({
        where: { id: student.id },
        data: {
          studentId: cleanStudentId,
          password: bcrypt.hashSync(cleanPass, 10),
          passwordHint: cleanPass,
          nickname: nickname?.trim() || null,
          gender: gender || null,
          rollNumber: rollNumber?.trim() || null,
          parentPhone: parentPhone?.trim() || null
        }
      });
    }

    // เชื่อมลงทะเบียนเรียนในห้องเรียน
    const existingEnroll = await db.studentClass.findUnique({
      where: {
        studentId_classId: {
          studentId: student.id,
          classId: classroom.id
        }
      }
    });

    if (!existingEnroll) {
      // เคลียร์ห้องเรียนเก่าก่อน (นักเรียนอยู่ได้ 1 ห้องตามข้อกำหนด LMS)
      await db.studentClass.deleteMany({
        where: { studentId: student.id }
      });

      await db.studentClass.create({
        data: {
          studentId: student.id,
          classId: classroom.id
        }
      });
    }

    return { success: true };
  } catch (err) {
    console.error("Failed to create global student:", err);
    return { success: false, error: "เกิดข้อผิดพลาดในการเพิ่มนักเรียน" };
  }
}

// 10. แก้ไขข้อมูลนักเรียนรายบุคคล
export async function updateStudent(formData: FormData) {
  const user = await getSessionUser();
  if (!user || (user.role !== "TEACHER" && user.role !== "ADMIN")) {
    return { success: false, error: "ไม่มีสิทธิ์แก้ไขข้อมูลนักเรียน" };
  }

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const studentId = formData.get("studentId") as string;
  const yearLevel = formData.get("yearLevel") as string;
  const room = formData.get("room") as string;
  const passwordHint = formData.get("passwordHint") as string;
  const nickname = formData.get("nickname") as string;
  const gender = formData.get("gender") as string;
  const rollNumber = formData.get("rollNumber") as string;
  const parentPhone = formData.get("parentPhone") as string;
  const confirmPassword = formData.get("confirmPassword") as string; // รหัสผ่านครูเพื่อยืนยันตัวตน
  const academicYear = (formData.get("academicYear") as string) || "2568";

  if (!id || !name || !studentId || !yearLevel || !room || !passwordHint || !confirmPassword) {
    return { success: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" };
  }

  try {
    // ตรวจสอบรหัสผ่านของคุณครู/แอดมิน เพื่อความปลอดภัยตาม UX/UI
    const dbUser = await db.user.findUnique({ where: { id: user.id } });
    if (!dbUser || !bcrypt.compareSync(confirmPassword, dbUser.password)) {
      return { success: false, error: "รหัสผ่านยืนยันตัวตนของคุณครูไม่ถูกต้อง" };
    }

    // ป้องกันปัญหารหัสประจำตัวนักเรียนซ้ำในระบบเมื่อแก้ไขข้อมูล
    const duplicateStudentId = await db.user.findFirst({
      where: { 
        studentId: studentId.trim(), 
        role: "STUDENT", 
        NOT: { id: id } 
      }
    });

    if (duplicateStudentId) {
      return { success: false, error: `รหัสนักเรียน "${studentId}" ถูกใช้งานโดยนักเรียนคนอื่นแล้ว (${duplicateStudentId.name})` };
    }

    // 1. หาห้องเรียนปลายทาง
    let classroom = await db.classroom.findFirst({
      where: { yearLevel: yearLevel, room: room, academicYear }
    });

    if (!classroom) {
      classroom = await db.classroom.create({
        data: {
          name: "เทคโนโลยีวิทยาการคำนวณ",
          yearLevel,
          room,
          academicYear,
          teacherId: user.id
        }
      });
    }

    // 2. อัปเดตข้อมูลนักเรียน
    await db.user.update({
      where: { id },
      data: {
        name: name.trim(),
        studentId: studentId.trim(),
        passwordHint: passwordHint.trim(),
        password: bcrypt.hashSync(passwordHint.trim(), 10),
        nickname: nickname?.trim() || null,
        gender: gender || null,
        rollNumber: rollNumber?.trim() || null,
        parentPhone: parentPhone?.trim() || null
      }
    });

    // 3. ปรับเปลี่ยนห้องเรียน
    await db.studentClass.deleteMany({
      where: { studentId: id }
    });

    await db.studentClass.create({
      data: {
        studentId: id,
        classId: classroom.id
      }
    });

    return { success: true };
  } catch (err) {
    console.error("Failed to update student:", err);
    return { success: false, error: "เกิดข้อผิดพลาดในการแก้ไขข้อมูลนักเรียน" };
  }
}

// 11. ลบข้อมูลนักเรียนในระบบ
export async function deleteStudent(studentId: string, confirmPassword: string) {
  const user = await getSessionUser();
  if (!user || (user.role !== "TEACHER" && user.role !== "ADMIN")) {
    return { success: false, error: "ไม่มีสิทธิ์ลบข้อมูลนักเรียน" };
  }

  if (!confirmPassword) {
    return { success: false, error: "กรุณากรอกรหัสผ่านของคุณครูเพื่อยืนยันการลบ" };
  }

  try {
    // ตรวจสอบรหัสผ่านคุณครู
    const dbUser = await db.user.findUnique({ where: { id: user.id } });
    if (!dbUser || !bcrypt.compareSync(confirmPassword, dbUser.password)) {
      return { success: false, error: "รหัสผ่านยืนยันตัวตนของคุณครูไม่ถูกต้อง การลบข้อมูลล้มเหลว" };
    }

    // ลบข้อมูลนักเรียน (Prisma จะทำการ Cascade ลบข้อมูลประวัติและการบ้าน, คะแนนของเด็กคนนี้ออกโดยอัตโนมัติ)
    await db.user.delete({
      where: { id: studentId }
    });

    return { success: true };
  } catch (err) {
    console.error("Failed to delete student:", err);
    return { success: false, error: "เกิดข้อผิดพลาดในการลบข้อมูลนักเรียน" };
  }
}

// 12. นำเข้ากลุ่มรายชื่อนักเรียนแบบ Global (ชื่อ, รหัส, ระดับชั้น, ห้อง, รหัสผ่าน)
export async function importGlobalStudents(
  parsedStudents: { name: string; code: string; class: string; room: string; password?: string }[],
  academicYear: string = "2568"
) {
  const user = await getSessionUser();
  if (!user || (user.role !== "TEACHER" && user.role !== "ADMIN")) {
    return { success: false, error: "ไม่มีสิทธิ์ลงทะเบียนรายชื่อนักเรียน" };
  }

  try {
    let importedCount = 0;
    
    for (const s of parsedStudents) {
      const cleanName = s.name.trim();
      const cleanCode = s.code.trim();
      const cleanClass = s.class === "m3" ? "ม.3" : s.class === "m2" ? "ม.2" : "ม.1";
      const cleanRoom = s.room.trim();
      const cleanPass = s.password?.trim() || "1234";

      // 1. หาหรือสร้างห้องเรียนปลายทาง
      let classroom = await db.classroom.findFirst({
        where: { yearLevel: cleanClass, room: cleanRoom, academicYear }
      });

      if (!classroom) {
        classroom = await db.classroom.create({
          data: {
            name: "เทคโนโลยีวิทยาการคำนวณ",
            yearLevel: cleanClass,
            room: cleanRoom,
            academicYear,
            teacherId: user.id
          }
        });
      }

      // 2. หาหรือสร้างนักเรียน
      let student = await db.user.findFirst({
        where: { name: cleanName, role: "STUDENT" }
      });

      if (!student) {
        student = await db.user.create({
          data: {
            name: cleanName,
            password: bcrypt.hashSync(cleanPass, 10),
            passwordHint: cleanPass,
            studentId: cleanCode,
            role: "STUDENT",
            status: "ACTIVE",
            avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=random&color=fff&size=150`
          }
        });
        importedCount++;
      } else {
        await db.user.update({
          where: { id: student.id },
          data: {
            studentId: cleanCode,
            password: bcrypt.hashSync(cleanPass, 10),
            passwordHint: cleanPass
          }
        });
      }

      // 3. ลงทะเบียนเรียนเข้าห้องเรียน
      const existingEnroll = await db.studentClass.findUnique({
        where: {
          studentId_classId: {
            studentId: student.id,
            classId: classroom.id
          }
        }
      });

      if (!existingEnroll) {
        // ล้างห้องเก่า (ถ้ามี)
        await db.studentClass.deleteMany({
          where: { studentId: student.id }
        });

        await db.studentClass.create({
          data: {
            studentId: student.id,
            classId: classroom.id
          }
        });
      }
    }

    return { success: true, message: `นำเข้ารายชื่อนักเรียนใหม่ ${importedCount} คนสำเร็จ` };
  } catch (err) {
    console.error("Failed batch import:", err);
    return { success: false, error: "เกิดข้อผิดพลาดในการนำเข้าข้อมูลนักเรียนแบบกลุ่ม" };
  }
}

// 12. ดึงข้อมูลโปรไฟล์ของคุณครู/แอดมินที่เข้าสู่ระบบแบบ Dynamic
export async function getCurrentTeacherProfile() {
  const user = await getSessionUser();
  if (!user) return null;

  try {
    const dbUser = await db.user.findUnique({
      where: { id: user.id }
    });
    if (!dbUser) return null;

    return {
      name: dbUser.name,
      role: dbUser.role,
      avatarChar: dbUser.name.charAt(0) || "ค"
    };
  } catch (err) {
    console.error("Failed to get current teacher profile:", err);
    return null;
  }
}


