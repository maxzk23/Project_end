"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { login } from "@/app/actions/auth";
import { FaUser, FaLock, FaSignInAlt, FaExclamationCircle } from "react-icons/fa";

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition(); // ใช้ตรวจสอบสถานะการส่งฟอร์มหลังบ้านแบบเรียลไทม์
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ฟังก์ชันรองรับการกดส่งข้อมูลแบบอัปเดตหน้าบ้านทันที
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await login(null, formData);
      if (result && !result.success) {
        setErrorMessage(result.error || "ล็อกอินไม่สำเร็จ");
      } else {
        // เมื่อล็อกอินสำเร็จ ให้ตั้งค่าแจ้งเตือนต้อนรับให้เด้งเฉพาะครั้งแรก
        if (typeof window !== "undefined") {
          sessionStorage.setItem("login-welcome-toast", "true");
        }
        // ตัว middleware จะจัดคุกกี้เรียบร้อย ให้รีเฟรชหน้าบ้านเพื่อเด้งเข้าสู่ Dashboard ของบทบาทตัวเองทันที
        router.refresh();
        router.push("/");
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-slate-50 via-slate-100 to-slate-200/60 dark:from-slate-950 dark:via-[#0b1329] dark:to-slate-950 p-4 select-none relative overflow-hidden font-sans transition-colors duration-200">
      
      {/* วัตถุตกแต่งพื้นหลังเรืองแสงแบบสุ่มอนิเมชัน */}
      <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] rounded-full bg-sky-400/20 dark:bg-sky-600/15 blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] rounded-full bg-purple-400/20 dark:bg-purple-600/15 blur-[120px] animate-pulse delay-700"></div>

      <div className="w-full max-w-md relative z-10">
        
        {/* กล่องล็อกอินสไตล์ Glassmorphism ในธีมขาว/มืด */}
        <div className="bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 p-8 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:shadow-black/60 space-y-6">
          
          {/* ส่วนหัวแสดงผลโลโก้และชื่อวิทยาลัย */}
          <div className="text-center space-y-2">
            <div className="inline-flex p-4 bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 rounded-2xl border border-sky-100 dark:border-sky-800/50 mb-2 shadow-xs">
              <FaSignInAlt className="text-3xl" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">LMS & MINIGAMES</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">ระบบเข้าสู่ระบบวิทยาลัยเทคโนโลยีประจำภาคเรียน</p>
          </div>

          {/* กล่องแสดงการเตือนข้อผิดพลาด (Error alert box) */}
          {errorMessage && (
            <div className="p-4 bg-red-50 dark:bg-rose-950/40 border border-red-200/80 dark:border-rose-800/50 text-red-600 dark:text-rose-300 rounded-2xl flex items-start gap-3 animate-headShake">
              <FaExclamationCircle className="text-lg mt-0.5 flex-shrink-0" />
              <span className="text-sm font-medium">{errorMessage}</span>
            </div>
          )}

          {/* ฟอร์มสำหรับการเข้าสู่ระบบ */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* กล่องกรอกข้อมูลชื่อ - นามสกุล หรือรหัสประจำตัว */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="name" className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                  ชื่อ - นามสกุล หรือ รหัสประจำตัว
                </label>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 dark:text-slate-500">
                  <FaUser className="text-sm" />
                </span>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  disabled={isPending}
                  placeholder="เช่น สมชาย ขยันเรียน หรือ 660104"
                  className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10 dark:focus:ring-sky-500/20 transition-all disabled:opacity-50"
                />
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium px-1">
                * กรอกได้ทั้งชื่อ-นามสกุล, ชื่อจริง หรือรหัสประจำตัว
              </p>
            </div>

            {/* กล่องกรอกรหัสผ่าน */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                รหัสผ่านเข้าระบบ
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 dark:text-slate-500">
                  <FaLock className="text-sm" />
                </span>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  disabled={isPending}
                  placeholder="••••••••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10 dark:focus:ring-sky-500/20 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* ปุ่มกดยืนยันการส่งข้อมูลล็อกอิน */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 dark:shadow-indigo-900/50 disabled:opacity-50 disabled:active:scale-100 cursor-pointer"
            >
              {isPending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <FaSignInAlt />
                  <span>เข้าสู่ระบบการเรียน</span>
                </>
              )}
            </button>

          </form>

        </div>

      </div>
    </div>
  );
}
