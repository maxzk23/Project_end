"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  FaGraduationCap, 
  FaHome, 
  FaBookOpen, 
  FaFileUpload, 
  FaGamepad, 
  FaTrophy, 
  FaBell, 
  FaSignOutAlt,
  FaUserCheck,
  FaTimes
} from "react-icons/fa";
import { logout } from "@/app/actions/auth";
import { getStudentSidebarCounts } from "@/app/actions/student";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function StudentSidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [counts, setCounts] = useState({ pendingAssignments: 0, unlockedLessons: 0, unreadNotifications: 0 });
  const [seenLessonsCount, setSeenLessonsCount] = useState<number>(0);

  const fetchCounts = async () => {
    const data = await getStudentSidebarCounts();
    if (data) setCounts(data);
  };

  useEffect(() => {
    const saved = localStorage.getItem("lms_seen_lessons_count");
    if (saved !== null) {
      setSeenLessonsCount(Number(saved));
    }
  }, []);

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

  useEffect(() => {
    if (pathname === "/student/lessons" && counts.unlockedLessons > 0) {
      localStorage.setItem("lms_seen_lessons_count", String(counts.unlockedLessons));
      setSeenLessonsCount(counts.unlockedLessons);
    }
  }, [pathname, counts.unlockedLessons]);

  const isCurrentActive = (path: string) => pathname === path;

  const isActive = (path: string) => {
    return isCurrentActive(path) 
      ? "bg-sky-500 text-white shadow-sm shadow-sky-200 dark:shadow-none font-semibold" 
      : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-700 dark:hover:text-slate-200 font-medium";
  };

  return (
    <aside className={`fixed top-0 left-0 h-screen w-[260px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-50 transition-all duration-300 ${
      isOpen ? "translate-x-0" : "-translate-x-full"
    } lg:translate-x-0`}>
      
      {/* ส่วนหัวของ Sidebar (โลโก้ / แบรนด์) */}
      <div className="p-6 text-2xl font-bold text-sky-700 dark:text-sky-400 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">

        <div className="flex items-center gap-3">
          <FaGraduationCap className="text-3xl drop-shadow-sm text-sky-500" />
          <span>LMS Student</span>
        </div>
        <button 
          onClick={onClose}
          className="lg:hidden text-slate-400 hover:text-slate-600 transition p-1"
          aria-label="ปิดเมนู"
        >
          <FaTimes className="text-xl" />
        </button>
      </div>

      {/* กลุ่มเมนูนำทาง (Navigation Links) */}
      <nav className="flex-1 px-4 py-6 flex flex-col gap-2 overflow-y-auto">
        
        {/* เมนู แดชบอร์ด */}
        <Link 
          href="/student/dashboard" 
          onClick={onClose}
          className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${isActive("/student/dashboard")}`}
        >
          <FaHome className="text-xl w-6 text-center" />
          <span>แดชบอร์ด</span>
        </Link>

        {/* เมนู ประวัติการเข้าเรียน */}
        <Link 
          href="/student/classrooms" 
          onClick={onClose}
          className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${isActive("/student/classrooms")}`}
        >
          <FaUserCheck className="text-xl w-6 text-center" />
          <span>ประวัติการเข้าเรียน</span>
        </Link>

        {/* เมนู บทเรียนของฉัน */}
        <Link 
          href="/student/lessons" 
          onClick={onClose}
          className={`flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${isActive("/student/lessons")}`}
        >
          <div className="flex items-center gap-3">
            <FaBookOpen className="text-xl w-6 text-center" />
            <span>บทเรียนของฉัน</span>
          </div>
          {Math.max(0, counts.unlockedLessons - seenLessonsCount) > 0 && (
            <span className="px-2 py-0.5 text-[11px] font-black rounded-full bg-rose-500 text-white shadow-sm shadow-rose-200">
              {Math.max(0, counts.unlockedLessons - seenLessonsCount)}
            </span>
          )}
        </Link>

        {/* เมนู ส่งการบ้าน */}
        <Link 
          href="/student/assignments" 
          onClick={onClose}
          className={`flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${isActive("/student/assignments")}`}
        >
          <div className="flex items-center gap-3">
            <FaFileUpload className="text-xl w-6 text-center" />
            <span>ส่งการบ้าน</span>
          </div>
          {counts.pendingAssignments > 0 && (
            <span className="px-2 py-0.5 text-[11px] font-black rounded-full bg-rose-500 text-white shadow-sm shadow-rose-200">
              {counts.pendingAssignments}
            </span>
          )}
        </Link>

        {/* เมนู มินิเกม & ภารกิจ */}
        <Link 
          href="/student/games" 
          onClick={onClose}
          className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${isActive("/student/games")}`}
        >
          <FaGamepad className="text-xl w-6 text-center" />
          <span>มินิเกม & ภารกิจ</span>
        </Link>

        {/* เมนู ลีดเดอร์บอร์ด */}
        <Link 
          href="/student/leaderboard" 
          onClick={onClose}
          className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${isActive("/student/leaderboard")}`}
        >
          <FaTrophy className="text-xl w-6 text-center" />
          <span>ลีดเดอร์บอร์ด</span>
        </Link>

        {/* เมนู การแจ้งเตือน */}
        <Link 
          href="/student/notifications" 
          onClick={onClose}
          className={`flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${isActive("/student/notifications")}`}
        >
          <div className="flex items-center gap-3">
            <FaBell className="text-xl w-6 text-center" />
            <span>การแจ้งเตือน</span>
          </div>
          {counts.unreadNotifications > 0 && (
            <span className="px-2 py-0.5 text-[11px] font-black rounded-full bg-rose-500 text-white shadow-sm shadow-rose-200">
              {counts.unreadNotifications}
            </span>
          )}
        </Link>
      </nav>

      {/* ปุ่มออกจากระบบ (อยู่ส่วนล่างสุดของ Sidebar เสมอ) */}
      <div className="p-4 mt-auto">
        <button 
          onClick={() => logout()} // เรียกใช้งาน Action logout เมื่อคลิก
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50/80 dark:hover:bg-rose-950/40 rounded-xl font-semibold transition-all duration-200 cursor-pointer"
        >
          <FaSignOutAlt className="text-lg" />
          <span>ออกจากระบบ</span>
        </button>
      </div>

    </aside>
  );
}
