"use client";

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
} from "react-icons/fa"; // เปลี่ยนกลับมาใช้ fa ปกติ
import { logout } from "@/app/actions/auth"; // อิมพอร์ตฟังก์ชันสำหรับการออกจากระบบ

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

// คอมโพเนนต์ Sidebar (แถบเมนูด้านข้าง) สำหรับนักเรียน
export default function StudentSidebar({ isOpen = false, onClose }: SidebarProps) {
  // ใช้ usePathname เพื่อดึง URL ปัจจุบันมาเช็คว่าผู้ใช้เปิดหน้าไหนอยู่
  const pathname = usePathname();

  // สร้างฟังก์ชันเช็ค URL เพื่อเพิ่ม class 'active' ให้กับเมนูที่ถูกเลือก
  const isActive = (path: string) => {
    return pathname === path 
      ? "bg-sky-500 text-white shadow-md shadow-sky-200" // สไตล์เมื่อเมนูถูกเลือก (Active)
      : "text-slate-500 hover:bg-sky-50 hover:text-sky-600"; // สไตล์ปกติ (Inactive)
  };

  return (
    // โครงสร้างหลักของ Sidebar (Fix ติดจอซ้าย, กว้าง 260px)
    <aside className={`fixed top-0 left-0 h-screen w-[260px] bg-white border-r border-slate-200 flex flex-col z-50 transition-all duration-300 ${
      isOpen ? "translate-x-0" : "-translate-x-full"
    } lg:translate-x-0`}>
      
      {/* ส่วนหัวของ Sidebar (โลโก้ / แบรนด์) */}
      <div className="p-6 text-2xl font-bold text-sky-700 flex items-center justify-between border-b border-slate-200">
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
          className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold transition-all duration-200 ${isActive("/student/dashboard")}`}
        >
          <FaHome className="text-xl w-6 text-center" />
          <span>แดชบอร์ด</span>
        </Link>

        {/* เมนู ประวัติการเข้าเรียน */}
        <Link 
          href="/student/classrooms" 
          className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold transition-all duration-200 ${isActive("/student/classrooms")}`}
        >
          <FaUserCheck className="text-xl w-6 text-center" />
          <span>ประวัติการเข้าเรียน</span>
        </Link>

        {/* เมนู บทเรียนของฉัน */}
        <Link 
          href="/student/lessons" 
          className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold transition-all duration-200 ${isActive("/student/lessons")}`}
        >
          <FaBookOpen className="text-xl w-6 text-center" />
          <span>บทเรียนของฉัน</span>
        </Link>

        {/* เมนู ส่งการบ้าน */}
        <Link 
          href="/student/assignments" 
          className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold transition-all duration-200 ${isActive("/student/assignments")}`}
        >
          <FaFileUpload className="text-xl w-6 text-center" />
          <span>ส่งการบ้าน</span>
        </Link>

        {/* เมนู มินิเกม & ภารกิจ */}
        <Link 
          href="/student/games" 
          className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold transition-all duration-200 ${isActive("/student/games")}`}
        >
          <FaGamepad className="text-xl w-6 text-center" />
          <span>มินิเกม & ภารกิจ</span>
        </Link>

        {/* เมนู ลีดเดอร์บอร์ด */}
        <Link 
          href="/student/leaderboard" 
          className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold transition-all duration-200 ${isActive("/student/leaderboard")}`}
        >
          <FaTrophy className="text-xl w-6 text-center" />
          <span>ลีดเดอร์บอร์ด</span>
        </Link>

        {/* เมนู การแจ้งเตือน */}
        <Link 
          href="/student/notifications" 
          className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold transition-all duration-200 ${isActive("/student/notifications")}`}
        >
          <FaBell className="text-xl w-6 text-center" />
          <span>การแจ้งเตือน</span>
        </Link>
      </nav>

      {/* ปุ่มออกจากระบบ (อยู่ส่วนล่างสุดของ Sidebar เสมอ) */}
      <div className="p-4 mt-auto">
        <button 
          onClick={() => logout()} // เรียกใช้งาน Action logout เมื่อคลิก
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded-xl font-bold transition-all duration-200"
        >
          <FaSignOutAlt className="text-xl" />
          <span>ออกจากระบบ</span>
        </button>
      </div>

    </aside>
  );
}
