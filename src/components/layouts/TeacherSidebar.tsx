"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  FaGraduationCap, 
  FaChartPie, 
  FaUserCheck, 
  FaCheckSquare, 
  FaTasks, 
  FaTrophy, 
  FaBookOpen, 
  FaAddressBook, 
  FaBell, 
  FaSignOutAlt,
  FaTimes
} from "react-icons/fa"; // ใช้ไอคอนที่ตรงกับเดโม่ที่สุด
import { logout } from "@/app/actions/auth";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function TeacherSidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();

  // ปรับสไตล์ปุ่ม Active ให้เป็นปุ่มสีฟ้าโค้งมนตัวหนังสือขาวเหมือนตัวเดโม่จริง
  const isActive = (path: string) => {
    return pathname === path 
      ? "bg-sky-600 text-white font-semibold shadow-sm" 
      : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-medium";
  };

  return (
    <aside className={`fixed top-0 left-0 h-screen w-[260px] bg-white border-r border-slate-200 flex flex-col z-50 select-none transition-all duration-300 ${
      isOpen ? "translate-x-0" : "-translate-x-full"
    } lg:translate-x-0`}>
      
      {/* ส่วนหัวแบรนด์: LMS Teacher และหมวกสีฟ้า */}
      <div className="p-6 text-2xl font-bold text-sky-600 flex items-center justify-between border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3">
          <FaGraduationCap className="text-3xl text-sky-500" />
          <span className="text-[21px] tracking-tight">LMS Teacher</span>
        </div>
        <button 
          onClick={onClose}
          className="lg:hidden text-slate-400 hover:text-slate-600 transition p-1"
          aria-label="ปิดเมนู"
        >
          <FaTimes className="text-xl" />
        </button>
      </div>

      {/* เมนูทั้งหมดตามในรูปเดโม่ 100% */}
      <nav className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto px-3">
        
        {/* 1. แดชบอร์ดสรุปผล */}
        <Link 
          href="/teacher/dashboard" 
          className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-all duration-150 ${isActive("/teacher/dashboard")}`}
        >
          <FaChartPie className="text-base w-5 text-center" />
          <span>แดชบอร์ดสรุปผล</span>
        </Link>

        {/* 2. เช็คชื่อเข้าเรียน */}
        <Link 
          href="/teacher/attendance" 
          className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-all duration-150 ${isActive("/teacher/attendance")}`}
        >
          <FaUserCheck className="text-base w-5 text-center" />
          <span>เช็คชื่อเข้าเรียน</span>
        </Link>

        {/* 3. ตรวจการบ้าน */}
        <Link 
          href="/teacher/grading" 
          className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-all duration-150 ${isActive("/teacher/grading")}`}
        >
          <FaCheckSquare className="text-base w-5 text-center" />
          <span>ตรวจการบ้าน</span>
        </Link>

        {/* 4. การมอบหมายงาน */}
        <Link 
          href="/teacher/assignments" 
          className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-all duration-150 ${isActive("/teacher/assignments")}`}
        >
          <FaTasks className="text-base w-5 text-center" />
          <span>การมอบหมายงาน</span>
        </Link>

        {/* 5. ลีดเดอร์บอร์ด */}
        <Link 
          href="/teacher/leaderboard" 
          className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-all duration-150 ${isActive("/teacher/leaderboard")}`}
        >
          <FaTrophy className="text-base w-5 text-center text-yellow-500" />
          <span>ลีดเดอร์บอร์ด</span>
        </Link>

        {/* 6. จัดการสื่อ/บทเรียน */}
        <Link 
          href="/teacher/materials" 
          className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-all duration-150 ${isActive("/teacher/materials")}`}
        >
          <FaBookOpen className="text-base w-5 text-center" />
          <span>จัดการสื่อ/บทเรียน</span>
        </Link>

        {/* เส้นคั่นกลาง */}
        <div className="h-px bg-slate-100 my-2 mx-2"></div>

        {/* 7. บัญชีนักเรียน */}
        <Link 
          href="/teacher/classrooms" 
          className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-all duration-150 ${isActive("/teacher/classrooms")}`}
        >
          <FaAddressBook className="text-base w-5 text-center" />
          <span>บัญชีนักเรียน</span>
        </Link>

        {/* 8. การแจ้งเตือน */}
        <Link 
          href="/teacher/notifications" 
          className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-all duration-150 ${isActive("/teacher/notifications")}`}
        >
          <FaBell className="text-base w-5 text-center" />
          <span>การแจ้งเตือน</span>
        </Link>

        {/* 9. จัดการปีการศึกษา */}
        <Link 
          href="/teacher/settings" 
          className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-all duration-150 ${isActive("/teacher/settings")}`}
        >
          <FaGraduationCap className="text-base w-5 text-center" />
          <span>จัดการปีการศึกษา</span>
        </Link>
        
      </nav>

      {/* ปุ่มออกจากระบบสีแดงอ่อนโค้งมนแบบภาพเดโม่ */}
      <div className="p-3 shrink-0">
        <button 
          onClick={() => logout()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold transition text-sm border border-rose-150 shadow-sm"
        >
          <FaSignOutAlt className="text-base" />
          <span>ออกจากระบบ</span>
        </button>
      </div>

    </aside>
  );
}
