"use client";

import { useState } from "react";
import TeacherSidebar from "@/components/layouts/TeacherSidebar";
import TeacherTopbar from "@/components/layouts/TeacherTopbar";
import { ReactNode } from "react";

// โครงสร้างหน้าเว็บหลัก (Layout) สำหรับส่วนของคุณครูทั้งหมด
export default function TeacherLayout({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    // พื้นหลังสีเทาอ่อน (slate-50) เพื่อความสบายตา
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex overflow-x-hidden">
      
      {/* แทรก Sidebar ของคุณครู */}
      <TeacherSidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />

      {/* Backdrop สำหรับปิดแถบเมนูในมือถือเมื่อคลิกพื้นที่ว่าง */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* ส่วนพื้นที่เนื้อหาหลัก (Main Content Area) */}
      <main className="flex-1 ml-0 lg:ml-[260px] p-4 sm:p-8 min-h-screen flex flex-col relative w-full overflow-x-hidden">
        
        {/* แทรก Topbar สำหรับแสดงโปรไฟล์ครูและการแจ้งเตือน */}
        <TeacherTopbar onMenuClick={() => setIsSidebarOpen(true)} />

        {/* เนื้อหาหน้าย่อยๆ ของครูจะถูกดึงมาแสดงที่นี่ */}
        <div className="flex-1 animate-in fade-in duration-500 w-full">
          {children}
        </div>

      </main>

    </div>
  );
}
