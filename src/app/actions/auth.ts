"use server";

import { db } from "@/lib/db";
import { encrypt } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

// คลาสหรือประเภทข้อมูลสำหรับจำลองข้อผิดพลาดส่งกลับไปยังหน้า UI
export interface ActionResponse {
  success: boolean;
  error?: string;
}

function cleanNameVariants(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const variants = new Set<string>();
  variants.add(trimmed);

  // ปรับช่องว่างซ้ำซ้อนให้เป็นช่องเดียว
  const singleSpaced = trimmed.replace(/\s+/g, " ");
  variants.add(singleSpaced);

  // ตัดคำนำหน้าชื่อภาษาไทยยอดนิยม
  const prefixes = [
    /^เด็กชาย\s*/i,
    /^ด\.ช\.\s*/i,
    /^ด\.ช\s+/i,
    /^เด็กหญิง\s*/i,
    /^ด\.ญ\.\s*/i,
    /^ด\.ญ\s+/i,
    /^นาย\s*/i,
    /^นางสาว\s*/i,
    /^น\.ส\.\s*/i,
    /^น\.ส\s+/i,
    /^นาง\s*/i,
    /^คุณครู\s*/i,
    /^ครู\s*/i,
    /^อาจารย์\s*/i,
    /^อ\.\s*/i,
  ];

  for (const prefix of prefixes) {
    if (prefix.test(trimmed)) {
      const stripped = trimmed.replace(prefix, "").trim();
      if (stripped) {
        variants.add(stripped);
        variants.add(stripped.replace(/\s+/g, " "));
      }
    }
  }

  return Array.from(variants);
}

/**
 * Server Action สำหรับประมวลผลการเข้าสู่ระบบ (Login)
 */
export async function login(prevState: any, formData: FormData): Promise<ActionResponse> {
  const name = formData.get("name") as string;
  const password = formData.get("password") as string;

  // 1. ตรวจสอบความถูกต้องของ Input เบื้องต้น
  if (!name || !password) {
    return { success: false, error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน" };
  }

  try {
    const rawInput = name.trim();
    const searchVariants = cleanNameVariants(rawInput);
    
    // แยกส่วนของคำค้นหา (ชื่อ / นามสกุล)
    const nameParts = rawInput.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ");

    // สร้างเงื่อนไขค้นหาแบบยืดหยุ่น (ชื่อเต็ม, รหัสประจำตัว, คำนำหน้า, ชื่อจริง, นามสกุล)
    const orConditions: any[] = [
      ...searchVariants.map(v => ({ name: { equals: v, mode: "insensitive" } })),
      ...searchVariants.map(v => ({ studentId: { equals: v, mode: "insensitive" } })),
      { name: { equals: rawInput, mode: "insensitive" } },
    ];

    if (firstName) {
      orConditions.push({ name: { startsWith: firstName, mode: "insensitive" } });
      orConditions.push({ name: { contains: firstName, mode: "insensitive" } });
    }
    if (lastName) {
      orConditions.push({ name: { contains: lastName, mode: "insensitive" } });
    }

    // 2. ค้นหาผู้ใช้จากฐานข้อมูล
    let candidateUsers: any[] = [];
    if (typeof db.user?.findMany === "function") {
      candidateUsers = await db.user.findMany({
        where: { OR: orConditions },
      });
    }

    // หาก findMany ไม่พบ หรืออยู่ในสภาพแวดล้อม mock ให้ fallback หาด้วย findFirst
    if (candidateUsers.length === 0 && typeof db.user?.findFirst === "function") {
      const singleUser = await db.user.findFirst({
        where: { OR: orConditions },
      });
      if (singleUser) {
        candidateUsers = [singleUser];
      }
    }

    // 3. ตรวจเช็คหากไม่พบผู้ใช้
    if (candidateUsers.length === 0) {
      return { success: false, error: "ไม่พบชื่อผู้ใช้งานนี้ในระบบ" };
    }

    // 4. กรณีพบผู้ใช้ที่ตรงกับคำค้นหาหลายคน (เช่น พิมพ์แค่ชื่อแล้วมีหลายคน)
    // ให้ค้นหาผู้ใช้ที่รหัสผ่านตรงกับที่กรอกเข้ามา
    let matchingUser = candidateUsers.find(u => bcrypt.compareSync(password, u.password));

    // หากยังไม่ตรงและมีผู้ใช้คนเดียว ให้ถือเป็นคนนั้นเพื่อตรวจสอบความถูกต้องของรหัสผ่าน
    if (!matchingUser && candidateUsers.length === 1) {
      matchingUser = candidateUsers[0];
    }

    if (!matchingUser) {
      return { success: false, error: "รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง" };
    }

    const user = matchingUser;

    // 5. ตรวจสอบสิทธิ์การใช้งานของบัญชี
    if (user.status === "GRADUATED") {
      return { success: false, error: "ไม่พบผู้ใช้งาน" };
    }
    if (user.status !== "ACTIVE") {
      return { success: false, error: "บัญชีผู้ใช้นี้ถูกระงับการใช้งานชั่วคราว" };
    }

    // 6. ตรวจสอบเปรียบเทียบรหัสผ่าน (Hashed Password Comparison)
    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) {
      return { success: false, error: "รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง" };
    }

    // 7. เข้ารหัสข้อมูลสร้างเป็น Session Token (เก็บ ID, ชื่อ, และบทบาท)
    const sessionData = {
      userId: user.id,
      name: user.name,
      role: user.role,
    };
    const sessionToken = await encrypt(sessionData);

    // 8. บันทึก Token ลงใน Cookie ชนิด HTTP-Only ปลอดภัยสูง
    const cookieStore = await cookies();
    cookieStore.set("session", sessionToken, {
      httpOnly: true, // ป้องกันฝั่งไคลเอนต์ใช้ javascript เข้าถึงคุกกี้ (ลดเสี่ยง XSS)
      secure: process.env.NODE_ENV === "production", // ใช้ Https เฉพาะบน Production
      sameSite: "lax", // ป้องกันการโจมตีข้ามไซต์
      path: "/", // ให้มีสิทธิ์เรียกอ่านได้ทุกส่วนของเว็บแอป
      maxAge: 60 * 60 * 2, // กำหนดอายุคุกกี้ 2 ชั่วโมง (สอดคล้องกับโทเค็น)
    });

  } catch (err) {
    console.error("Login Action Error: ", err);
    return { success: false, error: "เกิดข้อผิดพลาดภายในระบบฐานข้อมูล" };
  }

  // 9. ล็อกอินสำเร็จ
  return { success: true };
}

/**
 * Server Action สำหรับทำรายการออกจากระบบ (Logout)
 */
export async function logout() {
  const cookieStore = await cookies();
  
  // ล้างคุกกี้เซสชันออกทั้งหมด
  cookieStore.delete("session");
  
  // นำกลับหน้าหลักล็อกอิน
  redirect("/login");
}
