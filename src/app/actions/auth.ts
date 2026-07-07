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
    // 2. ค้นหาผู้ใช้จากตาราง User โดยอิงจากชื่อจริง
    const user = await db.user.findFirst({
      where: { name: name.trim() },
    });

    // 3. ตรวจเช็คหากไม่พบผู้ใช้
    if (!user) {
      return { success: false, error: "ไม่พบชื่อผู้ใช้งานนี้ในระบบ" };
    }

    // 4. ตรวจสอบสิทธิ์การใช้งานของบัญชี
    if (user.status !== "ACTIVE") {
      return { success: false, error: "บัญชีผู้ใช้นี้ถูกระงับการใช้งานชั่วคราว" };
    }

    // 5. ตรวจสอบเปรียบเทียบรหัสผ่าน (Hashed Password Comparison)
    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) {
      return { success: false, error: "รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง" };
    }

    // 6. เข้ารหัสข้อมูลสร้างเป็น Session Token (เก็บ ID, ชื่อ, และบทบาท)
    const sessionData = {
      userId: user.id,
      name: user.name,
      role: user.role,
    };
    const sessionToken = await encrypt(sessionData);

    // 7. บันทึก Token ลงใน Cookie ชนิด HTTP-Only ปลอดภัยสูง
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

  // 8. นำทางผู้ใช้แยกตามสิทธิ์บทบาทที่ถูกล็อกอิน (ต้องกระทำนอกบล็อก try-catch ใน Server Action)
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
