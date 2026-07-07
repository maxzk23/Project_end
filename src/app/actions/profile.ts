"use server";

import { db } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/auth";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

// นิยามผลลัพธ์ตอบกลับจาก Server Action
export interface ProfileActionResponse {
  success: boolean;
  error?: string;
  message?: string;
}

// ฟังก์ชันดึงข้อมูลโปรไฟล์ผู้ใช้งานปัจจุบันจาก Database
export async function getCurrentProfile() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;
  if (!sessionToken) return null;

  const session = await decrypt(sessionToken);
  if (!session || !session.userId) return null;

  try {
    const user = await db.user.findUnique({
      where: { id: session.userId as string },
      select: {
        id: true,
        name: true,
        role: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
      },
    });
    return user;
  } catch (err) {
    console.error("Failed to get profile:", err);
    return null;
  }
}

// Server Action สำหรับอัปเดตข้อมูลโปรไฟล์ส่วนตัว
export async function updateProfile(
  prevState: any,
  formData: FormData
): Promise<ProfileActionResponse> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;
  if (!sessionToken) {
    return { success: false, error: "ไม่พบเซสชันการใช้งาน กรุณาล็อกอินใหม่" };
  }

  const session = await decrypt(sessionToken);
  if (!session || !session.userId) {
    return { success: false, error: "เซสชันไม่ถูกต้องหรือหมดอายุ" };
  }

  const userId = session.userId as string;
  const userRole = session.role as string;

  const newName = formData.get("name") as string;
  const newAvatarUrl = formData.get("avatarUrl") as string;
  const oldPassword = formData.get("oldPassword") as string;
  const newPassword = formData.get("newPassword") as string;

  try {
    // 1. ค้นหาผู้ใช้จาก DB เพื่อตรวจสอบรหัสผ่านเดิมและการยืนยันข้อมูล
    const currentUser = await db.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser) {
      return { success: false, error: "ไม่พบผู้ใช้ในระบบ" };
    }

    const updateData: any = {};

    // 2. ตรวจสอบเงื่อนไขการแก้ไขชื่อผู้ใช้และอวาตาร์ (ล็อกเฉพาะครูหรือแอดมินเท่านั้น)
    if (userRole === "TEACHER" || userRole === "ADMIN") {
      if (newName && newName.trim() !== currentUser.name) {
        updateData.name = newName.trim();
      }
      if (newAvatarUrl && newAvatarUrl !== currentUser.avatarUrl) {
        updateData.avatarUrl = newAvatarUrl;
      }
    } else {
      // ถ้านักเรียนแอบส่งค่ามาแก้ไข ให้ป้องกันไว้
      if (
        (newName && newName.trim() !== currentUser.name) ||
        (newAvatarUrl && newAvatarUrl !== currentUser.avatarUrl)
      ) {
        return { success: false, error: "สิทธิ์นักเรียนไม่สามารถแก้ไขชื่อหรืออวาตาร์เองได้" };
      }
    }

    // 3. ตรวจสอบความถูกต้องของการเปลี่ยนรหัสผ่าน
    if (newPassword) {
      if (!oldPassword) {
        return { success: false, error: "กรุณาระบุรหัสผ่านเดิมเพื่อความปลอดภัย" };
      }

      // ตรวจสอบรหัสผ่านเดิม
      const isPasswordValid = bcrypt.compareSync(oldPassword, currentUser.password);
      if (!isPasswordValid) {
        return { success: false, error: "รหัสผ่านเดิมไม่ถูกต้อง" };
      }

      if (newPassword.length < 6) {
        return { success: false, error: "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร" };
      }

      // แฮชรหัสผ่านใหม่
      updateData.password = bcrypt.hashSync(newPassword, 10);
    }

    // 4. หากไม่มีการเปลี่ยนแปลงใดๆ
    if (Object.keys(updateData).length === 0) {
      return { success: false, error: "ไม่มีข้อมูลที่ถูกแก้ไข" };
    }

    // 5. บันทึกการเปลี่ยนแปลงลงฐานข้อมูล
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
    });

    // 6. หากมีการเปลี่ยนชื่อผู้ใช้ ให้ทำการเขียนคุกกี้ Session ใหม่ทับเพื่อให้ชื่อในระบบอัปเดตทันที
    if (updateData.name) {
      const newSessionToken = await encrypt({
        userId: updatedUser.id,
        name: updatedUser.name,
        role: updatedUser.role,
      });

      cookieStore.set("session", newSessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 2, // 2 ชั่วโมง
      });
    }

    return { success: true, message: "บันทึกการเปลี่ยนแปลงโปรไฟล์เรียบร้อยแล้ว" };

  } catch (err) {
    console.error("Profile Action Update Error:", err);
    return { success: false, error: "เกิดข้อผิดพลาดในการบันทึกข้อมูลเข้าระบบ" };
  }
}
