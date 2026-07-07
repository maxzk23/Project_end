"use client";

import { useState } from "react";
import StudentSidebar from "@/components/layouts/StudentSidebar";
import StudentTopbar from "@/components/layouts/StudentTopbar";
import { ReactNode } from "react";

// โครงสร้างหน้าเว็บหลัก (Layout) สำหรับส่วนของนักเรียนทั้งหมด
export default function StudentLayout({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex overflow-x-hidden">
      
      {/* Sidebar เมนูด้านข้าง */}
      <StudentSidebar 
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
        
        {/* แทรก Topbar และปุ่มสำหรับเปิด Hamburger */}
        <StudentTopbar onMenuClick={() => setIsSidebarOpen(true)} />

        {/* เนื้อหาของหน้านักเรียน */}
        <div className="flex-1 animate-in fade-in duration-500 w-full">
          {children}
        </div>

      </main>

    </div>
  );
}
