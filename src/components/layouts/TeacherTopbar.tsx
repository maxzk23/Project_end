"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FaBell, FaExclamationCircle, FaBars, FaFileAlt, FaBookOpen, FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaTrash } from "react-icons/fa";
import { getCurrentTeacherProfile } from "@/app/actions/classroom";
import { getNotifications, markAllNotificationsAsRead, markNotificationAsRead, clearAllNotifications, getAssignmentClassId } from "@/app/actions/notification";

interface TopbarProps {
  onMenuClick?: () => void;
}

// คอมโพเนนต์ Topbar (แถบด้านบน) สำหรับคุณครู
export default function TeacherTopbar({ onMenuClick }: TopbarProps) {
  const router = useRouter();
  const [isNotifyOpen, setIsNotifyOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [profile, setProfile] = useState<{
    name: string;
    role: string;
    avatarChar: string;
  } | null>(null);

  const loadNotifications = async () => {
    const data = await getNotifications();
    setNotifications(data);
  };

  const loadNotificationsRef = useRef(loadNotifications);
  useEffect(() => {
    loadNotificationsRef.current = loadNotifications;
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const data = await getCurrentTeacherProfile();
      if (data) {
        setProfile(data);
      }
    };
    fetchProfile();
    loadNotificationsRef.current();

    // ดึงข้อมูลแจ้งเตือนทุก 8 วินาที
    const interval = setInterval(() => {
      if (loadNotificationsRef.current) {
        loadNotificationsRef.current();
      }
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  // ฟังก์ชันสลับสถานะเปิด/ปิด การแจ้งเตือน
  const toggleNotify = () => {
    setIsNotifyOpen(!isNotifyOpen);
  };

  const handleMarkAllRead = async () => {
    const res = await markAllNotificationsAsRead();
    if (res.success) {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    }
  };

  const handleMarkRead = async (id: string) => {
    const res = await markNotificationAsRead(id);
    if (res.success) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    }
  };

  const handleNotificationClick = async (item: any) => {
    if (!item.isRead) {
      await handleMarkRead(item.id);
    }
    setIsNotifyOpen(false);

    if (item.relatedType === "ASSIGNMENT" && item.relatedId) {
      const classId = await getAssignmentClassId(item.relatedId);
      if (classId) {
        localStorage.setItem("teacher-grading-classId", classId);
        localStorage.setItem("teacher-grading-expandedIds", JSON.stringify([item.relatedId]));
        
        try {
          const savedTabs = localStorage.getItem("teacher-grading-activeTabs");
          let tabs = savedTabs ? JSON.parse(savedTabs) : {};
          tabs[item.relatedId] = "pending";
          localStorage.setItem("teacher-grading-activeTabs", JSON.stringify(tabs));
        } catch (e) {
          console.error("Failed to set activeTab in storage", e);
        }
      }
      
      if (window.location.pathname === "/teacher/grading") {
        window.location.reload();
      } else {
        router.push("/teacher/grading");
      }
    } else if (item.relatedType === "LESSON") {
      router.push("/teacher/materials");
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("คุณต้องการล้างการแจ้งเตือนทั้งหมดหรือไม่?")) return;
    const res = await clearAllNotifications();
    if (res.success) {
      setNotifications([]);
      setIsNotifyOpen(false);
    }
  };

  const getIcon = (type: string, relatedType: string | null) => {
    if (relatedType === "LESSON") {
      return <FaBookOpen className="text-purple-500" />;
    }
    if (relatedType === "ASSIGNMENT") {
      return <FaFileAlt className="text-orange-500" />;
    }
    
    switch (type) {
      case "SUCCESS":
        return <FaCheckCircle className="text-emerald-500" />;
      case "WARNING":
        return <FaExclamationTriangle className="text-amber-500" />;
      case "ALERT":
        return <FaExclamationCircle className="text-rose-500" />;
      default:
        return <FaInfoCircle className="text-sky-500" />;
    }
  };

  const formatTime = (date: Date) => {
    const diffMs = Date.now() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 1) return "เมื่อสักครู่";
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    
    return new Date(date).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short"
    });
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    // โครงสร้างหลัก: จัดให้อยู่ด้านบนซ้ายถึงขวา
    <header className="flex justify-between items-center mb-8 relative z-40 gap-4">
      
      {/* ส่วนทักทายคุณครู (ด้านซ้าย) */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 hover:text-sky-600 hover:border-sky-500 transition shrink-0"
          aria-label="เปิดเมนู"
        >
          <FaBars className="text-base" />
        </button>
        <div className="flex flex-col text-left">
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
            สวัสดี, {profile ? (profile.name.startsWith("คุณครู") ? profile.name.replace("คุณครู", "ครู") : profile.name) : "คุณครู"}!
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-semibold">ภาพรวมการเรียนการสอน ห้อง ม.3/1 ประจำวันนี้</p>
        </div>
      </div>

      {/* ส่วน Action Buttons (ด้านขวา) */}
      <div className="flex items-center gap-5">
        
        {/* กล่องการแจ้งเตือน */}
        <div className="relative">
          <button 
            onClick={toggleNotify}
            className="relative bg-white border border-slate-200 w-10 h-10 rounded-full flex justify-center items-center text-slate-500 hover:text-sky-600 hover:border-sky-500 transition-all duration-300 shadow-sm"
          >
            <FaBell className="text-base" />
            {/* ป้ายตัวเลขแจ้งเตือน */}
            {unreadCount > 0 && (
              <div className="absolute top-1 right-1 min-w-[16px] h-[16px] bg-rose-500 rounded-full border-2 border-white text-[9px] font-bold text-white flex items-center justify-center px-0.5">
                {unreadCount}
              </div>
            )}
          </button>

          {/* ดรอปดาวน์การแจ้งเตือน */}
          {isNotifyOpen && (
            <div className="absolute top-12 right-0 w-[360px] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-200 text-left z-50">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h4 className="font-bold flex items-center gap-2 text-slate-800 text-sm">
                  <FaBell className="text-sky-500" /> การแจ้งเตือน
                </h4>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-bold text-sky-600 hover:underline"
                  >
                    อ่านทั้งหมดแล้ว
                  </button>
                )}
              </div>

              {/* รายการแจ้งเตือน */}
              <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-50">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-semibold">ไม่มีรายการแจ้งเตือนใหม่</div>
                ) : (
                  notifications.slice(0, 5).map((item) => (
                    <div 
                      key={item.id} 
                      onClick={() => handleNotificationClick(item)}
                      className={`flex gap-3 p-4 hover:bg-slate-50 cursor-pointer relative transition-colors ${
                        !item.isRead ? "bg-sky-50/15" : ""
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-sm">
                        {getIcon(item.type, item.relatedType)}
                      </div>
                      <div className="min-w-0 flex-1 pr-3">
                        <p className={`text-xs text-slate-800 leading-snug mb-0.5 ${!item.isRead ? "font-bold" : "font-semibold"}`}>
                          {item.title}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate mb-0.5">{item.message}</p>
                        <span className="text-[9px] text-slate-400 font-semibold block">{formatTime(item.createdAt)}</span>
                      </div>
                      {!item.isRead && (
                        <div className="w-1.5 h-1.5 rounded-full bg-sky-500 absolute right-4 mt-2"></div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 border-t border-slate-100 text-center flex flex-col gap-2">
                <Link 
                  href="/teacher/notifications" 
                  onClick={() => setIsNotifyOpen(false)}
                  className="text-xs font-bold text-sky-600 hover:text-sky-700 block"
                >
                  ดูการแจ้งเตือนทั้งหมด
                </Link>
                <div className="flex justify-around items-center pt-1">
                  {notifications.length > 0 && (
                    <button 
                      onClick={handleClearAll}
                      className="text-[10px] font-bold text-rose-600 hover:text-rose-700"
                    >
                      ล้างการแจ้งเตือนทั้งหมด
                    </button>
                  )}
                  <button 
                    onClick={() => setIsNotifyOpen(false)}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-700"
                  >
                    ปิดหน้าต่าง
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ส่วนข้อมูลโปรไฟล์ครูตามรูปภาพเดโม่ */}
        <Link 
          href="/teacher/profile"
          className="flex items-center gap-3 bg-white pr-5 pl-2 py-1.5 rounded-full border border-slate-200 cursor-pointer hover:shadow-sm hover:border-sky-300 transition-all select-none"
        >
          <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-700 flex justify-center items-center font-bold border border-sky-200">
            {profile?.avatarChar || "ค"}
          </div>
          <div className="hidden md:block text-left">
            <h4 className="text-xs font-bold text-slate-800">{profile ? profile.name : "กำลังโหลด..."}</h4>
            <p className="text-[10px] text-slate-400 font-semibold">
              {profile ? (profile.role === "ADMIN" ? "ผู้ดูแลระบบ" : "ครูประจำวิชา วิทยาการคำนวณ") : "คุณครู"}
            </p>
          </div>
        </Link>

      </div>
    </header>
  );
}
