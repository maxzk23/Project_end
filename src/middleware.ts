import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/auth";

// กำหนดเส้นทาง URL ที่อนุญาตให้เข้าถึงได้โดยไม่ต้องล็อกอิน (Public Routes)
const publicRoutes = ["/login"];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  
  // ตรวจหาคุกกี้เซสชันความปลอดภัยจากคำร้องขอที่ส่งเข้ามา
  const cookie = req.cookies.get("session")?.value;
  
  // พยายามถอดรหัสเซสชันที่ได้จากคุกกี้
  const session = cookie ? await decrypt(cookie) : null;

  // 1. กรณีผู้ใช้ที่ยังไม่ได้เข้าสู่ระบบ
  if (!session && !publicRoutes.includes(path)) {
    // บังคับเปลี่ยนเส้นทางให้ไปล็อกอิน
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // 2. กรณีผู้ใช้ที่เข้าสู่ระบบเรียบร้อยแล้ว
  if (session) {
    const role = session.role as string;

    // หากพยายามเข้าหน้าล็อกอินอีกครั้ง ให้เปลี่ยนเส้นทางไปยังหน้าแดชบอร์ดตามสิทธิ์ตัวเองทันที
    if (publicRoutes.includes(path) || path === "/") {
      if (role === "TEACHER" || role === "ADMIN") {
        return NextResponse.redirect(new URL("/teacher/dashboard", req.nextUrl));
      }
      return NextResponse.redirect(new URL("/student/dashboard", req.nextUrl));
    }

    // ป้องกันสิทธิ์: บัญชีนักเรียนห้ามเข้าถึงโฟลเดอร์ของฝั่งคุณครู (/teacher/*)
    if (path.startsWith("/teacher") && (role !== "TEACHER" && role !== "ADMIN")) {
      return NextResponse.redirect(new URL("/student/dashboard", req.nextUrl));
    }

    // ป้องกันสิทธิ์: บัญชีคุณครูห้ามเข้าถึงโฟลเดอร์ของฝั่งนักเรียน (/student/*)
    if (path.startsWith("/student") && role === "TEACHER") {
      return NextResponse.redirect(new URL("/teacher/dashboard", req.nextUrl));
    }
  }

  // อนุญาตให้ผ่านไปยังปลายทางได้หากเงื่อนไขข้างต้นผ่านการรับรอง
  return NextResponse.next();
}

// กำหนด Config ให้ Middleware ทำงานเฉพาะส่วนของเพจหลัก (หลีกเลี่ยงการเช็คไฟล์รูปภาพ, static assets, และไฟล์ api)
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images, symbols, assets
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.html).*)",
  ],
};
