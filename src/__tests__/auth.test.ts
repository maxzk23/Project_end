import { describe, it, expect, vi, beforeEach } from "vitest";
import { login } from "@/app/actions/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

// --- จำลอง (Mock) การทำงานของ Database และ Library ต่างๆ ---
vi.mock("@/lib/db", () => ({
  db: {
    user: { 
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: { compareSync: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  encrypt: vi.fn(() => "mock-token"),
}));

describe("Auth Server Actions (Unit Tests)", () => {
  let mockFormData: FormData;

  beforeEach(() => {
    // ล้างค่าที่จำลองไว้ก่อนเทสแต่ละรอบ
    vi.clearAllMocks();
    mockFormData = new FormData();
    // จำลอง Cookie Store
    (cookies as any).mockResolvedValue({ set: vi.fn(), delete: vi.fn() });
  });

  it("[TC01] ควรเข้าสู่ระบบสำเร็จเมื่อข้อมูลถูกต้อง (Positive Case)", async () => {
    // 1. เตรียมข้อมูลทดสอบ (Test Data)
    mockFormData.append("name", "ภัทรพล");
    mockFormData.append("password", "123456");

    // จำลองว่าหา User เจอในฐานข้อมูล และบัญชี ACTIVE
    (db.user.findMany as any).mockResolvedValue([{
      id: "u1", name: "ภัทรพล", role: "STUDENT", status: "ACTIVE", password: "hashed_password"
    }]);
    // จำลองว่ารหัสผ่านตรงกัน
    (bcrypt.compareSync as any).mockReturnValue(true);

    // 2. ทดสอบเรียกใช้ฟังก์ชัน (Action)
    const result = await login(null, mockFormData);

    // 3. ตรวจสอบผลลัพธ์ (Expected Result)
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("[TC02] ควรแจ้งเตือนเมื่อรหัสผ่านผิด (Negative Case)", async () => {
    mockFormData.append("name", "ภัทรพล");
    mockFormData.append("password", "wrongpass"); // รหัสผิด

    (db.user.findMany as any).mockResolvedValue([{
      id: "u1", name: "ภัทรพล", role: "STUDENT", status: "ACTIVE", password: "hashed_password"
    }]);
    (bcrypt.compareSync as any).mockReturnValue(false); // รหัสไม่ตรง

    const result = await login(null, mockFormData);

    expect(result.success).toBe(false);
    expect(result.error).toBe("รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
  });

  it("[TC03] ควรป้องกันการเข้าระบบหากบัญชีถูกระงับ (Suspended Account)", async () => {
    mockFormData.append("name", "สมศักดิ์");
    mockFormData.append("password", "123456");

    (db.user.findMany as any).mockResolvedValue([{
      id: "u2", name: "สมศักดิ์", role: "STUDENT", status: "SUSPENDED", password: "hashed_password" // บัญชีโดนระงับ
    }]);
    (bcrypt.compareSync as any).mockReturnValue(true);

    const result = await login(null, mockFormData);

    expect(result.success).toBe(false);
    expect(result.error).toBe("บัญชีผู้ใช้นี้ถูกระงับการใช้งานชั่วคราว");
  });

  it("[TC04] ควรเข้าสู่ระบบได้ด้วยชื่อจริงและนามสกุลเต็ม (Full Name)", async () => {
    mockFormData.append("name", "สมชาย ขยันเรียน");
    mockFormData.append("password", "1234");

    (db.user.findMany as any).mockResolvedValue([{
      id: "u3", name: "สมชาย ขยันเรียน", role: "STUDENT", status: "ACTIVE", password: "hashed_password"
    }]);
    (bcrypt.compareSync as any).mockReturnValue(true);

    const result = await login(null, mockFormData);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("[TC05] ควรเข้าสู่ระบบได้แม้พิมพ์คำนำหน้าชื่อ เช่น เด็กชาย (Prefix stripping)", async () => {
    mockFormData.append("name", "เด็กชายสมชาย ขยันเรียน");
    mockFormData.append("password", "1234");

    (db.user.findMany as any).mockResolvedValue([{
      id: "u3", name: "สมชาย ขยันเรียน", role: "STUDENT", status: "ACTIVE", password: "hashed_password"
    }]);
    (bcrypt.compareSync as any).mockReturnValue(true);

    const result = await login(null, mockFormData);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
