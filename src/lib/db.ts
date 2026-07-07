import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// ตรวจสอบและตั้งค่า Global context เพื่อรักษาอินสแตนซ์ Prisma Client ในช่วง Hot-reload (Development)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

// 1. สร้างการเชื่อมต่อ Connection Pool ของ PostgreSQL โดยอิงจาก Environment variables
const pool =
  globalForPrisma.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

// 2. สร้าง Driver Adapter เชื่อมต่อ PostgreSQL เข้ากับ Prisma 7 Engine
const adapter = new PrismaPg(pool);

// 3. กำหนดอินสแตนซ์ Prisma Client ขึ้นมาโดยส่งผ่านตัวอแดปเตอร์ใน Option constructor
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter, // ส่งมอบอแดปเตอร์แทนการระบุ url โดยตรงเพื่อความปลอดภัย
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// บันทึกตัวแปรเก็บไว้ใน Global Context ในฝั่ง Development ป้องกันการสร้าง Pool เชื่อมต่อซ้ำๆ เกินจำกัด
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.pgPool = pool;
}
