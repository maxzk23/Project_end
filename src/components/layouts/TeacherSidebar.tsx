"use client";

import { useEffect, useState } from "react";
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
} from "react-icons/fa";
import { logout } from "@/app/actions/auth";
import { getTeacherSidebarCounts } from "@/app/actions/teacher";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function TeacherSidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [counts, setCounts] = useState({ pendingGrading: 0, unreadNotifications: 0 });

  const fetchCounts = async () => {
    const data = await getTeacherSidebarCounts();
    if (data) setCounts(data);
  };

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 3000);

    const bc = new BroadcastChannel("lms-channel");
    bc.onmessage = () => {
      fetchCounts();
    };

    return () => {
      clearInterval(interval);
      bc.close();
    };
  }, []);

  // เช็คว่าหน้าปัจจุบันตรงกับเมนูใด
  const isItemActive = (path: string) => {
    if (path === "/teacher/classrooms") {
      return pathname.startsWith("/teacher/classrooms");
    }
    return pathname === path;
  };

  const getItemClass = (path: string) => {
    return isItemActive(path)
      ? "bg-sky-500 text-white font-semibold shadow-sm shadow-sky-200 dark:shadow-none" 
      : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-700 dark:hover:text-slate-200 font-medium";
  };

  return (
    <aside className={`fixed top-0 left-0 h-screen w-[260px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-50 select-none transition-all duration-300 ${
      isOpen ? "translate-x-0" : "-translate-x-full"
    } lg:translate-x-0`}>
      
      {/* ส่วนหัวแบรนด์: LMS Teacher และหมวกสีฟ้า */}
      <div className="p-6 text-2xl font-bold text-sky-600 dark:text-sky-400 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">

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

      {/* เมนูทั้งหมด */}
      <nav className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto px-3">
        
        {/* 1. แดชบอร์ดสรุปผล */}
        <Link 
          href="/teacher/dashboard" 
          onClick={onClose}
          className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-all duration-150 ${getItemClass("/teacher/dashboard")}`}
        >
          <FaChartPie className="text-base w-5 text-center" />
          <span>แดชบอร์ดสรุปผล</span>
        </Link>

        {/* 2. เช็คชื่อเข้าเรียน */}
        <Link 
          href="/teacher/attendance" 
          onClick={onClose}
          className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-all duration-150 ${getItemClass("/teacher/attendance")}`}
        >
          <FaUserCheck className="text-base w-5 text-center" />
          <span>เช็คชื่อเข้าเรียน</span>
        </Link>

        {/* 3. ตรวจการบ้าน */}
        <Link 
          href="/teacher/grading" 
          onClick={onClose}
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-150 ${getItemClass("/teacher/grading")}`}
        >
          <div className="flex items-center gap-3.5">
            <FaCheckSquare className="text-base w-5 text-center" />
            <span>ตรวจการบ้าน</span>
          </div>
          {counts.pendingGrading > 0 && (
            <span className="px-2 py-0.5 text-[11px] font-black rounded-full bg-rose-500 text-white shadow-sm shadow-rose-200">
              {counts.pendingGrading}
            </span>
          )}
        </Link>

        {/* 4. การมอบหมายงาน */}
        <Link 
          href="/teacher/assignments" 
          onClick={onClose}
          className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-all duration-150 ${getItemClass("/teacher/assignments")}`}
        >
          <FaTasks className="text-base w-5 text-center" />
          <span>การมอบหมายงาน</span>
        </Link>

        {/* 5. ลีดเดอร์บอร์ด */}
        <Link 
          href="/teacher/leaderboard" 
          onClick={onClose}
          className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-all duration-150 ${getItemClass("/teacher/leaderboard")}`}
        >
          <FaTrophy className="text-base w-5 text-center" />
          <span>ลีดเดอร์บอร์ด</span>
        </Link>

        {/* 6. จัดการสื่อ/บทเรียน */}
        <Link 
          href="/teacher/materials" 
          onClick={onClose}
          className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-all duration-150 ${getItemClass("/teacher/materials")}`}
        >
          <FaBookOpen className="text-base w-5 text-center" />
          <span>จัดการสื่อ/บทเรียน</span>
        </Link>

        {/* เส้นคั่นกลาง */}
        <div className="h-px bg-slate-100 dark:bg-slate-800 my-2 mx-2"></div>

        {/* 7. บัญชีนักเรียน */}
        <Link 
          href="/teacher/classrooms" 
          onClick={onClose}
          className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-all duration-150 ${getItemClass("/teacher/classrooms")}`}
        >
          <FaAddressBook className="text-base w-5 text-center" />
          <span>บัญชีนักเรียน</span>
        </Link>

        {/* 8. การแจ้งเตือน */}
        <Link 
          href="/teacher/notifications" 
          onClick={onClose}
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-150 ${getItemClass("/teacher/notifications")}`}
        >
          <div className="flex items-center gap-3.5">
            <FaBell className="text-base w-5 text-center" />
            <span>การแจ้งเตือน</span>
          </div>
          {counts.unreadNotifications > 0 && (
            <span className="px-2 py-0.5 text-[11px] font-black rounded-full bg-rose-500 text-white shadow-sm shadow-rose-200">
              {counts.unreadNotifications}
            </span>
          )}
        </Link>

        {/* 9. จัดการปีการศึกษา */}
        <Link 
          href="/teacher/settings" 
          onClick={onClose}
          className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-all duration-150 ${getItemClass("/teacher/settings")}`}
        >
          <FaGraduationCap className="text-base w-5 text-center" />
          <span>จัดการปีการศึกษา</span>
        </Link>
        
      </nav>

      {/* ปุ่มออกจากระบบสไตล์ Ghost Button สบายตา */}
      <div className="p-3 shrink-0">
        <button 
          onClick={() => logout()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50/80 dark:hover:bg-rose-950/40 rounded-xl font-semibold transition-all duration-200 cursor-pointer"
        >
          <FaSignOutAlt className="text-base" />
          <span>ออกจากระบบ</span>
        </button>
      </div>


    </aside>
  );
}
