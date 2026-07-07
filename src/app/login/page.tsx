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
        // เมื่อล็อกอินสำเร็จ ตัว middleware จะจัดคุกกี้เรียบร้อย ให้รีเฟรชหน้าบ้านเพื่อเด้งเข้าสู่ Dashboard ของบทบาทตัวเองทันที
        router.refresh();
        router.push("/");
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-slate-50 via-slate-100 to-slate-200/60 p-4 select-none relative overflow-hidden font-sans">
      
      {/* วัตถุตกแต่งพื้นหลังเรืองแสงแบบสุ่มอนิเมชัน */}
      <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] rounded-full bg-sky-400/20 blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] rounded-full bg-purple-400/20 blur-[120px] animate-pulse delay-700"></div>

      <div className="w-full max-w-md relative z-10">
        
        {/* กล่องล็อกอินสไตล์ Glassmorphism ในธีมขาว */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-8 rounded-3xl shadow-xl shadow-slate-200/50 space-y-6">
          
          {/* ส่วนหัวแสดงผลโลโก้และชื่อวิทยาลัย */}
          <div className="text-center space-y-2">
            <div className="inline-flex p-4 bg-sky-50 text-sky-600 rounded-2xl border border-sky-100 mb-2">
              <FaSignInAlt className="text-3xl" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">LMS & MINIGAMES</h1>
            <p className="text-sm text-slate-500">ระบบเข้าสู่ระบบวิทยาลัยเทคโนโลยีประจำภาคเรียน</p>
          </div>

          {/* กล่องแสดงการเตือนข้อผิดพลาด (Error alert box) */}
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200/80 text-red-600 rounded-2xl flex items-start gap-3 animate-headShake">
              <FaExclamationCircle className="text-lg mt-0.5 flex-shrink-0" />
              <span className="text-sm font-medium">{errorMessage}</span>
            </div>
          )}

          {/* ฟอร์มสำหรับการเข้าสู่ระบบ */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* กล่องกรอกข้อมูลชื่อ - นามสกุลจริง */}
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                ชื่อ - นามสกุลจริงของคุณ
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                  <FaUser className="text-sm" />
                </span>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  disabled={isPending}
                  placeholder="เช่น เด็กชายแดง รักเรียน"
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* กล่องกรอกรหัสผ่าน */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                รหัสผ่านเข้าระบบ
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
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
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* ปุ่มกดยืนยันการส่งข้อมูลล็อกอิน */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-indigo-600 text-white rounded-2xl text-sm font-semibold hover:from-sky-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/10 disabled:opacity-50 disabled:active:scale-100"
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

          {/* รายละเอียดบัญชีสำหรับทดสอบระบบตัวอย่าง */}
          <div className="pt-4 border-t border-white/5 text-center space-y-1">
            <p className="text-xs text-slate-500">บัญชีสำหรับคณะกรรมการ / ครู / แอดมิน ทดสอบรัน:</p>
            <p className="text-[11px] text-slate-400">
              แอดมิน: <span className="text-sky-400 font-mono">แอดมินระบบ</span> (รหัส: <span className="text-sky-400 font-mono">admin</span>)
            </p>
            <p className="text-[11px] text-slate-400">
              ครู: <span className="text-sky-400 font-mono">คุณครูสมชาย รักเรียน</span> (รหัส: <span className="text-sky-400 font-mono">teacher</span>)
            </p>
            <p className="text-[11px] text-slate-400">
              นักเรียน: <span className="text-sky-400 font-mono">เด็กชายแดง รักเรียน</span> (รหัส: <span className="text-sky-400 font-mono">student</span>)
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
