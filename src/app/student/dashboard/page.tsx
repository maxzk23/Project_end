"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStudentClassrooms } from "@/app/actions/classroom";
import { getStudentDefaultClass, getStudentDashboardSummary } from "@/app/actions/student";
import { 
  FaStar, 
  FaMedal, 
  FaCheckCircle, 
  FaUserCheck, 
  FaChartBar, 
  FaFileAlt, 
  FaBookOpen, 
  FaFilePowerpoint, 
  FaEye, 
  FaFileVideo, 
  FaPlay, 
  FaRocket, 
  FaUserAlt, 
  FaTrophy,
  FaExclamationCircle,
  FaLink,
  FaArrowRight
} from "react-icons/fa";

interface Classroom {
  id: string;
  name: string;
  yearLevel: string;
  room: string;
}

interface DashboardData {
  studentName: string;
  stats: {
    totalPoints: number;
    rank: number | string;
    pendingAssignmentsCount: number;
  };
  attendanceStatus: string | null;
  materials: {
    id: string;
    title: string;
    type: string;
    fileUrl: string;
  }[];
  pendingAssignments: {
    id: string;
    title: string;
    dueDate: Date | null;
  }[];
  leaderboard: {
    rank: number;
    studentId: string;
    studentName: string;
    totalPoints: number;
  }[];
}

export default function StudentDashboard() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [summary, setSummary] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoginToast, setShowLoginToast] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  // ตรวจสอบว่าเพิ่งเข้าสู่ระบบมาหรือไม่ หากใช่ให้แสดง Toast เพียงครั้งเดียวแล้วเคลียร์ทิ้ง
  useEffect(() => {
    if (typeof window !== "undefined") {
      const shouldShow = sessionStorage.getItem("login-welcome-toast") === "true";
      if (shouldShow) {
        setShowLoginToast(true);
        sessionStorage.removeItem("login-welcome-toast");
        const timer = setTimeout(() => setShowLoginToast(false), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  // จัดการเวลาปัจจุบันแบบไดนามิก
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const hrs = String(d.getHours()).padStart(2, "0");
      const mins = String(d.getMinutes()).padStart(2, "0");
      setCurrentTime(`${hrs}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // ดึงห้องเรียนในการรันหน้าครั้งแรก
  useEffect(() => {
    const initData = async () => {
      const [classes, defaultClass] = await Promise.all([
        getStudentClassrooms(),
        getStudentDefaultClass(),
      ]);
      setClassrooms(classes);
      
      if (defaultClass) {
        setSelectedClassId(defaultClass.id);
      } else if (classes.length > 0) {
        setSelectedClassId(classes[0].id);
      } else {
        setIsLoading(false);
      }
    };
    initData();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadDashboard(false);

      // ดึงข้อมูลอัตโนมัติแบบเงียบๆ (Silent Polling) เพื่ออัปเดตเรียลไทม์โดยไม่กระตุก UI
      const interval = setInterval(() => {
        loadDashboard(true);
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [selectedClassId]);

  // รับการอัปเดตแบบเรียลไทม์เมื่อคุณครูสลับตัวล็อกสื่อการเรียนการสอน
  useEffect(() => {
    const bc = new BroadcastChannel("lms-channel");
    bc.onmessage = (event) => {
      if (event.data?.type === "MATERIAL_TOGGLED") {
        loadDashboard(true);
      }
    };
    return () => {
      bc.close();
    };
  }, [selectedClassId]);

  const loadDashboard = async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    const res = await getStudentDashboardSummary(selectedClassId);
    if (res) {
      setSummary(res as DashboardData);
    }
    if (!isSilent) setIsLoading(false);
  };

  const activeClassroom = classrooms.find(c => c.id === selectedClassId);

  const getAttendanceWidget = () => {
    if (!summary) return null;
    const status = summary.attendanceStatus;

    switch (status) {
      case "PRESENT":
        return (
          <div className="w-full p-4 rounded-xl font-bold flex justify-center items-center gap-3 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 select-none">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
            <span>เช็คชื่อมาเรียนเรียบร้อยแล้ววันนี้</span>
          </div>
        );
      case "LATE":
        return (
          <div className="w-full p-4 rounded-xl font-bold flex justify-center items-center gap-3 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400 select-none">
            <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]"></span>
            <span>คุณเข้าเรียนสายในวันนี้</span>
          </div>
        );
      case "LEAVE":
        return (
          <div className="w-full p-4 rounded-xl font-bold flex justify-center items-center gap-3 bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 text-purple-700 dark:text-purple-400 select-none">
            <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_#a855f7]"></span>
            <span>ลาหยุดเรียน (ลาป่วย/ลากิจ)</span>
          </div>
        );
      case "ABSENT":
        return (
          <div className="w-full p-4 rounded-xl font-bold flex justify-center items-center gap-3 bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-400 select-none">
            <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_#ef4444]"></span>
            <span>ขาดเรียนในวันนี้</span>
          </div>
        );
      default:
        return (
          <div className="w-full p-4 rounded-xl border border-amber-200 dark:border-amber-800/50 border-dashed bg-amber-50/40 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 font-bold flex justify-center items-center gap-3 select-none">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]"></span>
            <span>รอคุณครูเรียกเช็คชื่อ...</span>
          </div>
        );
    }
  };

  const getMaterialIcon = (type: string) => {
    switch (type) {
      case "SLIDE":
        return <FaFilePowerpoint className="text-3xl text-orange-600" />;
      case "VIDEO":
        return <FaFileVideo className="text-3xl text-blue-600" />;
      default:
        return <FaBookOpen className="text-3xl text-purple-600" />;
    }
  };

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300 relative">

      {/* Toast แจ้งเตือนสิทธิ์ล็อกอินสำเร็จเมื่อเพิ่งเข้าสู่ระบบ */}
      {showLoginToast && (
        <div className="fixed top-5 right-5 z-[99999] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-2xl flex items-center gap-3.5 max-w-sm animate-in slide-in-from-top-6 duration-300 border-l-[5px] border-l-sky-500">
          <div className="w-8 h-8 rounded-full bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-700 dark:text-sky-400 shrink-0 text-base">
            <FaCheckCircle className="text-emerald-500" />
          </div>
          <div className="text-left">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 tracking-tight">เข้าสู่ระบบสำเร็จ</h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-400 font-semibold mt-0.5">ยินดีต้อนรับ {summary?.studentName || "นักเรียน"} เข้าสู่ระบบ</p>
          </div>
          <button 
            onClick={() => setShowLoginToast(false)} 
            className="text-slate-300 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-300 font-bold ml-2 text-base outline-none cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {classrooms.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border text-center text-slate-500">
          <FaExclamationCircle className="text-5xl mx-auto text-amber-500 mb-4" />
          <p className="text-lg font-bold">ยังไม่มีข้อมูลห้องเรียนในระบบ</p>
          <p className="text-sm opacity-75 mt-1">กรุณารอครูผู้ตรวจเช็ค ดึงข้อมูลนำเข้ารายชื่อคุณเข้ามาในห้องเรียนวิชาก่อนครับ</p>
        </div>
      ) : (
        <>
          {/* ส่วนที่ 1: แถบสถิติหลัก (Stats Grid) สีสันสดใส ชัดเจน โดดเด่น */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* สถิติ 1: คะแนนสะสม -> สีฟ้าครามประกาย (Sky / Blue / Indigo) */}
            <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 border border-sky-400/30 flex items-center justify-between group hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 cursor-default">
              <div className="absolute -top-10 -left-10 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
              <div className="absolute -right-3 -bottom-3 text-white/10 text-6xl pointer-events-none transform -rotate-12 group-hover:scale-110 group-hover:text-white/15 transition-all duration-300">
                <FaStar />
              </div>
              <div className="space-y-1 text-left relative z-10">
                <h3 className="text-3xl font-black text-white tracking-tight drop-shadow-sm leading-tight">
                  {(summary?.stats.totalPoints ?? 0).toLocaleString()}
                </h3>
                <p className="text-xs font-semibold text-sky-100/90">คะแนนสะสมทั้งหมด</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md text-white border border-white/30 flex items-center justify-center text-2xl shrink-0 group-hover:bg-white group-hover:text-blue-600 shadow-md transition-all duration-200 relative z-10">
                <FaStar />
              </div>
            </div>

            {/* สถิติ 2: อันดับในห้องเรียน -> สีส้มแอมเบอร์ประกาย (Amber / Orange / Rose) */}
            <Link 
              href="/student/leaderboard"
              className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 text-white shadow-lg shadow-orange-500/20 border border-orange-400/30 flex items-center justify-between group hover:shadow-xl hover:shadow-orange-500/30 hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              <div className="absolute -top-10 -left-10 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
              <div className="absolute -right-3 -bottom-3 text-white/10 text-6xl pointer-events-none transform -rotate-12 group-hover:scale-110 group-hover:text-white/15 transition-all duration-300">
                <FaMedal />
              </div>
              <div className="space-y-1 text-left relative z-10">
                <h3 className="text-3xl font-black text-white tracking-tight drop-shadow-sm leading-tight">
                  อันดับ {summary?.stats.rank ?? "-"}
                </h3>
                <p className="text-xs font-semibold text-orange-100/90">Leaderboard ของห้อง</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md text-white border border-white/30 flex items-center justify-center text-2xl shrink-0 group-hover:bg-white group-hover:text-orange-600 shadow-md transition-all duration-200 relative z-10">
                <FaMedal />
              </div>
            </Link>

            {/* สถิติ 3: การบ้านค้างส่ง -> สีเขียวมรกต (Emerald / Teal) */}
            <Link 
              href="/student/assignments"
              className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-500/20 border border-emerald-400/30 flex items-center justify-between group hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              <div className="absolute -top-10 -left-10 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
              <div className="absolute -right-3 -bottom-3 text-white/10 text-6xl pointer-events-none transform -rotate-12 group-hover:scale-110 group-hover:text-white/15 transition-all duration-300">
                <FaCheckCircle />
              </div>
              <div className="space-y-1 text-left relative z-10">
                <h3 className="text-3xl font-black text-white tracking-tight drop-shadow-sm leading-tight">
                  {summary?.stats.pendingAssignmentsCount ?? 0} งาน
                </h3>
                <p className="text-xs font-semibold text-emerald-100/90">การบ้านที่ต้องส่งสัปดาห์นี้</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md text-white border border-white/30 flex items-center justify-center text-2xl shrink-0 group-hover:bg-white group-hover:text-emerald-600 shadow-md transition-all duration-200 relative z-10">
                <FaCheckCircle />
              </div>
            </Link>
          </div>

          {/* ส่วนที่ 2: โครงสร้างแบบ 2 คอลัมน์ (ซ้ายกว้าง ขวาแคบ) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* === คอลัมน์ด้านซ้าย === */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* ตารางเช็คชื่อเข้าเรียนประจำวัน */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <FaUserCheck className="text-sky-500" /> สถานะการเข้าเรียน
                </h3>
                
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                  วิชา: {activeClassroom?.name || "วิทยาการคำนวณ"} {activeClassroom?.yearLevel || "ม.3"}/{activeClassroom?.room || "1"} | เวลาปัจจุบัน: {currentTime || "23:31"} น.
                </p>

                {getAttendanceWidget()}

                <Link
                  href="/student/classrooms"
                  className="w-full mt-4 bg-white border border-slate-200 text-slate-600 py-3.5 rounded-xl font-bold hover:bg-slate-50 hover:shadow transition flex items-center justify-center gap-2 text-xs shadow-xs active:scale-[0.99]"
                >
                  <FaChartBar className="text-sky-500" />
                  <span>ดูรายงานเช็คชื่อย้อนหลัง</span>
                </Link>
              </div>

              {/* การ์ดการบ้านค้างส่ง */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-5">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <FaFileAlt className="text-sky-500" /> การบ้านที่ได้รับมอบหมาย (Assigned Homework)
                  </h3>
                  <Link 
                    href="/student/assignments" 
                    className="text-sky-500 hover:underline text-xs font-bold transition"
                  >
                    ไปที่หน้าส่งงาน
                  </Link>
                </div>
                
                {isLoading ? (
                  <p className="text-xs text-slate-400 py-4">กำลังโหลด...</p>
                ) : summary?.pendingAssignments.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs font-bold flex items-center justify-center gap-2 border border-dashed rounded-xl bg-slate-50/50">
                    <FaCheckCircle className="text-emerald-500 text-base" />
                    <span>ไม่มีการบ้านค้างส่งในวิชานี้แล้ว!</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {summary?.pendingAssignments.map((asm) => (
                      <Link 
                        key={asm.id}
                        href="/student/assignments"
                        className="p-4 bg-slate-50 hover:bg-sky-50/50 rounded-xl border border-slate-100 hover:border-sky-300 flex justify-between items-center transition cursor-pointer group active:scale-[0.99]"
                      >
                        <div>
                          <h4 className="font-bold text-slate-700 text-xs group-hover:text-sky-600 transition-colors">{asm.title}</h4>
                          <p className="text-[10px] text-slate-500 font-semibold mt-1">
                            กำหนดส่ง: {asm.dueDate ? new Date(asm.dueDate).toLocaleString("th-TH") : "ไม่มีกำหนดส่ง"}
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-extrabold border border-amber-200 shrink-0 ml-2">ยังไม่ส่ง</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* การ์ดบทเรียนเปิดสอนล่าสุด */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-5">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <FaBookOpen className="text-purple-600" /> บทเรียนที่เปิดให้เรียนรู้ (Course Materials)
                  </h3>
                  <Link 
                    href="/student/lessons" 
                    className="text-sky-500 hover:underline text-xs font-bold transition"
                  >
                    ดูทั้งหมด
                  </Link>
                </div>
                
                {isLoading ? (
                  <p className="text-xs text-slate-400 py-4">กำลังโหลด...</p>
                ) : summary?.materials.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4 border border-dashed rounded-xl bg-slate-50/50">คุณครูยังไม่ได้ทำรายการปลดล็อกสไลด์บทเรียนสอนเสริม</p>
                ) : (
                  <div className="space-y-3">
                    {summary?.materials.map((m) => (
                      <div 
                        key={m.id} 
                        className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-sky-300 hover:bg-sky-50 transition group"
                      >
                        <Link 
                          href="/student/lessons"
                          className="flex items-center gap-4 min-w-0 flex-1 cursor-pointer"
                        >
                          {getMaterialIcon(m.type)}
                          <div className="min-w-0 flex-1">
                            <h5 className="font-bold text-slate-700 text-xs group-hover:text-sky-600 transition-colors truncate">{m.title}</h5>
                            <p className="text-[10px] text-slate-500 mt-1">บทเรียนสื่อประกอบการเรียนรู้ในระดับชั้น</p>
                          </div>
                        </Link>
                        <a 
                          href={m.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-sky-500 text-white rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow-sm hover:bg-sky-600 transition shrink-0 ml-3 active:scale-95"
                        >
                          {m.type === "VIDEO" ? <FaPlay /> : <FaEye />}
                          <span>{m.type === "VIDEO" ? "เล่นคลิป" : "เปิดดู"}</span>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* === คอลัมน์ด้านขวา === */}
            <div className="space-y-8">
              
              {/* แบนเนอร์เชิญชวนเล่นมินิเกมพิมพ์ศัพท์โค้ดสะสมแต้ม */}
              <div className="bg-gradient-to-br from-blue-500 via-sky-500 to-indigo-600 p-6 rounded-2xl shadow-md text-white relative overflow-hidden text-left">
                <div className="relative z-10 space-y-4">
                  <h4 className="text-base font-bold flex items-center gap-2">
                    <FaRocket className="animate-pulse" /> มินิเกมตะลุยอวกาศ
                  </h4>
                  <p className="text-xs opacity-90 leading-relaxed font-medium">
                    ด่านใหม่เปิดแล้ว! ฝึกเขียนโค้ดแก้ปริศนาเพื่อรับ 500 คะแนนพิเศษ
                  </p>
                  <Link 
                    href="/student/games" 
                    className="inline-flex items-center justify-center w-full gap-2 px-4 py-3 bg-white text-sky-600 rounded-xl font-bold text-xs hover:scale-[1.02] transition shadow-sm"
                  >
                    <FaPlay className="text-sky-500" />
                    <span>เข้าสู่เกมเลย</span>
                  </Link>
                </div>
                <FaUserAlt className="absolute -right-4 -bottom-4 text-9xl text-white opacity-10 pointer-events-none" />
              </div>

              {/* กระดานผู้นำ Leaderboard Top 5 */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-5">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <FaTrophy className="text-yellow-500" /> Top 5 Leaderboard
                  </h3>
                  <Link 
                    href="/student/leaderboard" 
                    className="text-sky-500 hover:underline text-xs font-bold transition"
                  >
                    ดูทั้งหมด
                  </Link>
                </div>
                
                {isLoading ? (
                  <p className="text-xs text-slate-400 py-4">กำลังโหลด...</p>
                ) : summary?.leaderboard.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">ยังไม่เคยมีบันทึกอันดับคะแนนสะสม</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {summary?.leaderboard.map((entry) => {
                      const isMe = summary?.studentName === entry.studentName;
                      const isRank1 = entry.rank === 1;
                      const isRank2 = entry.rank === 2;
                      const isRank3 = entry.rank === 3;

                      let badgeBg = "bg-slate-100 text-slate-500 border-slate-200";
                      if (isRank1) badgeBg = "bg-yellow-100 text-yellow-600 border border-yellow-200";
                      else if (isRank2) badgeBg = "bg-purple-100 text-purple-600 border border-purple-200";
                      else if (isRank3) badgeBg = "bg-orange-100 text-orange-600 border border-orange-200";

                      return (
                        <Link 
                          key={entry.studentId} 
                          href="/student/leaderboard"
                          className={`flex items-center gap-3.5 p-3 rounded-xl border transition relative cursor-pointer hover:border-sky-300 active:scale-[0.99] group ${
                            isMe 
                              ? "bg-sky-50/50 border-sky-400 shadow-sm" 
                              : "bg-slate-50/50 border-slate-100 hover:bg-slate-100/60"
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 border ${badgeBg}`}>
                            {entry.rank}
                          </div>
                          
                          <div className="flex-1 min-w-0 text-left">
                            <h5 className="font-bold text-slate-700 text-xs truncate flex items-center gap-1.5 group-hover:text-sky-600 transition-colors">
                              <span>{entry.studentName}</span>
                              {isMe && (
                                <span className="bg-sky-100 text-sky-700 text-[8px] font-bold px-1.5 py-0.5 rounded-full select-none">คุณ</span>
                              )}
                            </h5>
                            <p className="text-[9px] text-slate-400 font-semibold mt-0.5">
                              ม.3/1 • ม.3
                            </p>
                          </div>
                          
                          <div className="font-mono text-xs font-black text-sky-600 shrink-0">
                            {entry.totalPoints.toLocaleString()} <span className="text-[8px] text-slate-400 font-semibold font-sans">pts</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

          </div>
        </>
      )}

    </div>
  );
}
