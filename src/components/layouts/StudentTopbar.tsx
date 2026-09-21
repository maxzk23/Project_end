"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { FaBell, FaCheckDouble, FaFileAlt, FaBars, FaBookOpen, FaTrophy, FaExclamationCircle, FaInfoCircle, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa"; // อิมพอร์ตไอคอนกระดิ่งแจ้งเตือน
import { getCurrentStudentProfile } from "@/app/actions/student";
import { getNotifications, markAllNotificationsAsRead, markNotificationAsRead } from "@/app/actions/notification";
import { renderAvatarHelper } from "@/components/profile/ProfileSettings";
import { dispatchNotificationUpdate } from "@/lib/events";

interface TopbarProps {
  onMenuClick?: () => void;
}

// คอมโพเนนต์ Topbar (แถบด้านบน) สำหรับนักเรียน
export default function StudentTopbar({ onMenuClick }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isDashboard = pathname === "/student/dashboard";
  // สร้าง State สำหรับเปิด/ปิด เมนูดรอปดาวน์การแจ้งเตือน
  const [isNotifyOpen, setIsNotifyOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [profile, setProfile] = useState<{
    name: string;
    nickname: string;
    classLabel: string;
    avatarUrl?: string | null;
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
      const data = await getCurrentStudentProfile();
      if (data) {
        setProfile(data);
      }
    };
    fetchProfile();
    loadNotificationsRef.current();

    // ฟัง Event เมื่อมีการอัปเดตโปรไฟล์หรือการแจ้งเตือนเพื่อรีเฟรชข้อมูลทันที
    const handleProfileUpdate = () => {
      fetchProfile();
    };

    const handleNotifyUpdate = () => {
      if (loadNotificationsRef.current) {
        loadNotificationsRef.current();
      }
    };

    window.addEventListener("profile-updated", handleProfileUpdate);
    window.addEventListener("notifications-updated", handleNotifyUpdate);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("lms-channel");
      bc.onmessage = (event) => {
        if (event.data?.type === "PROFILE_UPDATED") {
          fetchProfile();
        } else if (event.data?.type === "NOTIFICATIONS_UPDATED") {
          if (loadNotificationsRef.current) {
            loadNotificationsRef.current();
          }
        }
      };
    } catch (e) {}

    // ดึงข้อมูลการแจ้งเตือนทุก 8 วินาที
    const interval = setInterval(() => {
      if (loadNotificationsRef.current) {
        loadNotificationsRef.current();
      }
    }, 8000);

    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdate);
      window.removeEventListener("notifications-updated", handleNotifyUpdate);
      if (bc) bc.close();
      clearInterval(interval);
    };
  }, []);

  // ฟังก์ชันสลับสถานะเปิด/ปิด การแจ้งเตือน
  const toggleNotify = () => {
    setIsNotifyOpen(!isNotifyOpen);
  };

  const handleMarkAllRead = async () => {
    const res = await markAllNotificationsAsRead();
    if (res.success) {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      dispatchNotificationUpdate();
    }
  };

  const handleMarkRead = async (id: string) => {
    const res = await markNotificationAsRead(id);
    if (res.success) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      dispatchNotificationUpdate();
    }
  };

  const handleNotificationClick = async (item: any) => {
    if (!item.isRead) {
      await handleMarkRead(item.id);
    }
    setIsNotifyOpen(false);

    if (item.relatedType === "ASSIGNMENT") {
      router.push("/student/assignments");
    } else if (item.relatedType === "LESSON") {
      router.push("/student/lessons");
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

  const getPageTitle = (path: string) => {
    switch (path) {
      case "/student/classrooms": return "ประวัติการเช็คชื่อ";
      case "/student/assignments": return "การบ้านและภารกิจ";
      case "/student/lessons": return "สื่อและบทเรียน";
      case "/student/games": return "มินิเกมสะสมแต้ม";
      case "/student/leaderboard": return "ตารางอันดับเกียรติยศ";
      case "/student/notifications": return "ศูนย์แจ้งเตือน";
      case "/student/profile": return "โปรไฟล์ส่วนตัว";
      default: return "";
    }
  };

  return (
    // โครงสร้างหลักของ Topbar: จัดวางให้อยู่ด้านบนซ้ายถึงขวา มีช่องว่างระหว่างกลาง (justify-between)
    <header className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200/60 relative z-40 gap-4">
      
      {/* ส่วนทักทาย หรือ Breadcrumb (ด้านซ้าย) */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 hover:text-sky-500 hover:border-sky-500 transition shrink-0 shadow-xs"
          aria-label="เปิดเมนู"
        >
          <FaBars className="text-base" />
        </button>

        {isDashboard ? (
          <div className="flex flex-col text-left">
            <h1 className="text-lg sm:text-2xl font-bold text-slate-800 leading-tight">
              สวัสดี, {profile ? (profile.nickname || profile.name.split(" ")[0]) : "นักเรียน"}! 👋
            </h1>
            <p className="text-[11px] sm:text-sm text-slate-500 mt-0.5 sm:mt-1">พร้อมที่จะเรียนรู้และทำภารกิจของวันนี้หรือยัง?</p>
          </div>
        ) : (
          getPageTitle(pathname) && (
            <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-semibold select-none min-w-0">
              <Link href="/student/dashboard" className="text-slate-500 hover:text-sky-600 transition font-bold flex items-center gap-1 shrink-0">
                <span>แดชบอร์ด</span>
              </Link>
              <span className="text-slate-300 font-light shrink-0">/</span>
              <span className="text-sky-700 bg-sky-50 border border-sky-200/80 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full font-extrabold flex items-center gap-1.5 shadow-2xs truncate max-w-[130px] sm:max-w-none">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse shrink-0"></span>
                <span className="truncate">{getPageTitle(pathname)}</span>
              </span>
            </div>
          )
        )}
      </div>

      {/* ส่วน Action Buttons (แจ้งเตือน และ โปรไฟล์) (ด้านขวา) */}
      <div className="flex items-center gap-2 sm:gap-5 shrink-0">
        
        {/* กล่องการแจ้งเตือน */}
        <div className="relative">
          <button 
            onClick={toggleNotify}
            className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex justify-center items-center text-slate-500 dark:text-slate-400 hover:text-sky-500 dark:hover:text-sky-400 hover:border-sky-500 transition-all duration-300 shadow-xs"
          >
            <FaBell className="text-base sm:text-xl" />
            {/* ป้ายตัวเลขแจ้งเตือน (Badge) มุมขวาบน */}
            {unreadCount > 0 && (
              <div className="absolute top-1 sm:top-1.5 right-1 sm:right-1.5 min-w-[16px] sm:min-w-[18px] h-[16px] sm:h-[18px] bg-rose-500 rounded-full border-2 border-white dark:border-slate-800 text-[9px] font-bold text-white flex items-center justify-center px-1">
                {unreadCount}
              </div>
            )}
          </button>

          {/* ดรอปดาวน์การแจ้งเตือน */}
          {isNotifyOpen && (
            <div className="absolute top-14 right-0 w-[calc(100vw-32px)] sm:w-[360px] max-w-[360px] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-200 text-left z-50">
              
              {/* หัวข้อดรอปดาวน์ */}
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
                        <span className="text-[10px] text-slate-400 font-semibold block">{formatTime(item.createdAt)}</span>
                      </div>
                      {!item.isRead && (
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute right-4 mt-2"></div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* ปุ่มท้ายดรอปดาวน์ */}
              <div className="p-3 border-t border-slate-100 text-center">
                <Link 
                  href="/student/notifications" 
                  onClick={() => setIsNotifyOpen(false)}
                  className="text-xs font-bold text-sky-600 hover:text-sky-700 block"
                >
                  ดูการแจ้งเตือนทั้งหมด
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ส่วนข้อมูลโปรไฟล์ (รูปภาพ และ ชื่อ) */}
        <Link 
          href="/student/profile"
          className="flex items-center gap-3 bg-white dark:bg-slate-800/90 pr-4 pl-1.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-sm hover:border-sky-300 dark:hover:border-sky-500 transition-all select-none"
        >
          {renderAvatarHelper(profile?.avatarUrl, profile?.name || "นักเรียน", "w-9 h-9 text-base")}
          <div className="hidden md:block">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{profile?.name || "กำลังโหลด..."}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">{profile?.classLabel || "นักเรียน"}</p>
          </div>
        </Link>

      </div>
    </header>
  );
}
