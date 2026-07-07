import { SignJWT, jwtVerify } from "jose";

// กำหนด Secret Key สำหรับเข้ารหัส Token (หากไม่มีใน ENV จะใช้ค่ายืดหยุ่นเป็น Fallback)
const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "lms-system-super-secret-key-2026-very-long"
);

// ฟังก์ชันเข้ารหัสข้อมูลผู้ใช้ (Payload) เพื่อสร้างเป็น JWT Token
export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" }) // ใช้การเข้ารหัสแบบสมมาตร HS256
    .setIssuedAt()
    .setExpirationTime("2h") // เซสชันล็อกอินจะมีอายุยาวนาน 2 ชั่วโมง
    .sign(SECRET_KEY);
}

// ฟังก์ชันถอดรหัส Token และสืบค้นข้อมูลข้างใน หาก Token ไม่ถูกต้องหรือหมดอายุจะคืนค่า null
export async function decrypt(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (error) {
    return null; // เมื่อตรวจพบว่า Token มีการปลอมแปลงหรือหมดอายุ
  }
}
