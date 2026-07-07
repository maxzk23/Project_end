"use server";

import { db } from "@/lib/db";
import { decrypt } from "@/lib/auth";
import { cookies } from "next/headers";
import { NotificationType } from "@prisma/client";

// ดึงไอดีผู้ใช้ปัจจุบันจากเซสชันคุกกี้ (ทั้งครูและนักเรียน)
async function getSessionUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;
  if (!sessionToken) return null;

  const session = await decrypt(sessionToken);
  if (!session || !session.userId) return null;

  return {
    id: session.userId as string,
    role: session.role as string,
  };
}

// 1. ดึงรายการแจ้งเตือนทั้งหมดของผู้ใช้ปัจจุบัน
export async function getNotifications() {
  const user = await getSessionUser();
  if (!user) return [];

  try {
    return await db.notification.findMany({
      where: { recipientId: user.id },
      orderBy: { createdAt: "desc" }
    });
  } catch (err) {
    console.error("Failed to get notifications:", err);
    return [];
  }
}

// 2. ทำเครื่องหมายว่าอ่านแล้วสำหรับแจ้งเตือนชิ้นเดียว
export async function markNotificationAsRead(id: string) {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "ไม่มีสิทธิ์ทำรายการ" };

  try {
    await db.notification.update({
      where: { id, recipientId: user.id },
      data: { isRead: true }
    });
    return { success: true };
  } catch (err) {
    console.error("Failed to mark notification as read:", err);
    return { success: false, error: "เกิดข้อผิดพลาด" };
  }
}

// 3. ทำเครื่องหมายว่าอ่านแล้วสำหรับแจ้งเตือนทั้งหมดของผู้ใช้
export async function markAllNotificationsAsRead() {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "ไม่มีสิทธิ์ทำรายการ" };

  try {
    await db.notification.updateMany({
      where: { recipientId: user.id, isRead: false },
      data: { isRead: true }
    });
    return { success: true };
  } catch (err) {
    console.error("Failed to mark all notifications as read:", err);
    return { success: false, error: "เกิดข้อผิดพลาด" };
  }
}

// 4. ลบการแจ้งเตือนชิ้นเดียว
export async function deleteNotification(id: string) {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "ไม่มีสิทธิ์ทำรายการ" };

  try {
    await db.notification.delete({
      where: { id, recipientId: user.id }
    });
    return { success: true };
  } catch (err) {
    console.error("Failed to delete notification:", err);
    return { success: false, error: "เกิดข้อผิดพลาด" };
  }
}

// 5. ลบการแจ้งเตือนทั้งหมดของผู้ใช้
export async function clearAllNotifications() {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "ไม่มีสิทธิ์ทำรายการ" };

  try {
    await db.notification.deleteMany({
      where: { recipientId: user.id }
    });
    return { success: true };
  } catch (err) {
    console.error("Failed to clear all notifications:", err);
    return { success: false, error: "เกิดข้อผิดพลาด" };
  }
}

// 6. ดึง Classroom ID ของการบ้าน
export async function getAssignmentClassId(assignmentId: string) {
  try {
    const asm = await db.assignment.findUnique({
      where: { id: assignmentId },
      select: { classId: true }
    });
    return asm?.classId || null;
  } catch (err) {
    console.error("Failed to get assignment classId:", err);
    return null;
  }
}
