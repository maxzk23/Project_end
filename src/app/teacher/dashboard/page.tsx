"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { getTeacherClassrooms } from "@/app/actions/classroom";
import { getDashboardSummaryData, toggleMaterialLock } from "@/app/actions/teacher";
import CustomSelect from "@/components/ui/CustomSelect";
import { 
  FaUsers, 
  FaFileSignature, 
  FaFolderOpen, 
  FaGamepad, 
  FaUserCheck, 
  FaBookOpen, 
  FaTrophy, 
  FaChevronRight,
  FaFilePdf,
  FaLock,
  FaLockOpen,
  FaStar,
  FaToggleOn,
  FaToggleOff,
  FaGraduationCap,
  FaCheckCircle
} from "react-icons/fa";

interface Classroom {
  id: string;
  name: string;
  yearLevel: string;
  room: string;
}

interface DashboardData {
  stats: {
    totalStudents: number;
    pendingGrading: number;
    unlockedMaterials: number;
    totalGames: number;
  };
  attendance: {
    present: number;
    late: number;
    leave: number;
    absent: number;
  };
  recentSubmissions: {
    id: string;
    assignmentTitle: string;
    studentName: string;
    submittedAt: Date;
  }[];
  materials: {
    id: string;
    title: string;
    type: string;
    isLocked: boolean;
  }[];
  leaderboard: {
    rank: number;
    studentName: string;
    totalPoints: number;
  }[];
}

export default function TeacherDashboard() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [summaryData, setSummaryData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoginToast, setShowLoginToast] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [selectedYearLevel, setSelectedYearLevel] = useState<string>("ALL");

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

  // โหลดห้องเรียนทั้งหมดในการเปิดหน้าแรก
  useEffect(() => {
    const fetchClasses = async () => {
      const classes = await getTeacherClassrooms();
      setClassrooms(classes);
      setSelectedClassId("ALL");
      setSelectedYearLevel("ALL");
    };
    fetchClasses();
  }, []);

  // ดึงระดับชั้นปีที่ไม่ซ้ำกัน
  const uniqueYearLevels = Array.from(new Set(classrooms.map(c => c.yearLevel))).sort();

  // ดึงห้องเรียนย่อยที่อยู่ในระดับชั้นปีที่เลือก
  const availableRooms = selectedYearLevel === "ALL" 
    ? classrooms 
    : classrooms.filter(c => c.yearLevel === selectedYearLevel);

  // เมื่อผู้ใช้เปลี่ยนระดับชั้นปี
  const handleYearLevelChange = (year: string) => {
    setSelectedYearLevel(year);
    if (year === "ALL") {
      setSelectedClassId("ALL");
    } else {
      const firstClassInYear = classrooms.find(c => c.yearLevel === year);
      if (firstClassInYear) {
        setSelectedClassId(firstClassInYear.id);
      }
    }
  };

  // โหลดข้อมูล Dashboard รายห้องเมื่อคลาสเปลี่ยน
  useEffect(() => {
    if (selectedClassId) {
      loadSummary();
    }
  }, [selectedClassId]);

  const loadSummary = async () => {
    setIsLoading(true);
    const data = await getDashboardSummaryData(selectedClassId);
    if (data) {
      setSummaryData(data as DashboardData);
    }
    setIsLoading(false);
  };

  // ติ๊กสลับเปิด/ปิดสื่อการสอนหน้าแดชบอร์ดเลย
  const handleToggleMaterial = (materialId: string, currentLockStatus: boolean) => {
    const newLockStatus = !currentLockStatus;
    
    // อัปเดตสเตตหน้าจอชั่วคราว
    if (summaryData) {
      setSummaryData({
        ...summaryData,
        materials: summaryData.materials.map(m => 
          m.id === materialId ? { ...m, isLocked: newLockStatus } : m
        )
      });
    }

    startTransition(async () => {
      const res = await toggleMaterialLock(materialId, newLockStatus);
      if (!res.success) {
        // ย้อนกลับ
        loadSummary();
      } else {
        // ส่งข้อความ Real-time แจ้งฝั่งนักเรียนให้ซิงก์ข้อมูลทันที
        const bc = new BroadcastChannel("lms-channel");
        bc.postMessage({ type: "MATERIAL_TOGGLED", materialId, isLocked: newLockStatus });
        bc.close();
      }
    });
  };

  // คำนวณความกว้างสัดส่วนกราฟแบบ Segmented Bar Chart
  const getAttPercent = () => {
    if (!summaryData) return { present: 0, late: 0, leave: 0, absent: 0, total: 0 };
    const att = summaryData.attendance;
    const total = att.present + att.late + att.leave + att.absent;
    if (total === 0) return { present: 0, late: 0, leave: 0, absent: 0, total: 0 };
    return {
      present: (att.present / total) * 100,
      late: (att.late / total) * 100,
      leave: (att.leave / total) * 100,
      absent: (att.absent / total) * 100,
      total
    };
  };

  const attPercent = getAttPercent();

  // จัดกลุ่มห้องเรียนตามระดับชั้นเพื่อสร้าง dropdown แยก ม.3 / 1
  const currentSelectedClass = classrooms.find(c => c.id === selectedClassId);

  if (isLoading || !summaryData) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-semibold animate-pulse">กำลังโหลดข้อมูลแดชบอร์ด...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 relative">
      
      {/* Toast แจ้งเตือนสิทธิ์ล็อกอินสำเร็จเลียนแบบรูปภาพเดโม่ */}
      {showLoginToast && (
        <div className="fixed top-5 right-5 z-[99999] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-2xl flex items-center gap-3.5 max-w-sm animate-in slide-in-from-top-6 duration-300 border-l-[5px] border-l-slate-800 dark:border-l-emerald-500">
          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 shrink-0 text-base">
            <FaCheckCircle className="text-emerald-500" />
          </div>
          <div className="text-left">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 tracking-tight">เข้าสู่ระบบสำเร็จ</h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-400 font-semibold mt-0.5">ยินดีต้อนรับคุณครูเข้าสู่ระบบจัดการ</p>
          </div>
          <button 
            onClick={() => setShowLoginToast(false)} 
            className="text-slate-300 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-300 font-bold ml-2 text-base outline-none cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}
      
      {/* 
        ส่วนที่ 1: แถบสถิติภาพรวม (Stats Grid) สีสันสดใส ชัดเจน โดดเด่น
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* สถิติ 1: จำนวนนักเรียน -> สีเขียวมรกต (Emerald / Teal) */}
        <Link 
          href="/teacher/classrooms"
          className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-500/20 border border-emerald-400/30 flex items-center justify-between group hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 cursor-pointer"
        >
          <div className="absolute -top-10 -left-10 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          <div className="absolute -right-3 -bottom-3 text-white/10 text-6xl pointer-events-none transform -rotate-12 group-hover:scale-110 group-hover:text-white/15 transition-all duration-300">
            <FaUsers />
          </div>
          <div className="space-y-1 text-left relative z-10">
            <h3 className="text-[26px] font-black text-white tracking-tight drop-shadow-sm leading-tight">
              {summaryData?.stats.totalStudents ?? 0} คน
            </h3>
            <p className="text-[11px] font-semibold text-emerald-100/90">
              {selectedClassId === "ALL" ? "จำนวนนักเรียนในระบบทั้งหมด" : "จำนวนนักเรียนในห้องเรียนนี้"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md text-white border border-white/30 flex items-center justify-center text-xl shrink-0 group-hover:bg-white group-hover:text-emerald-600 shadow-md transition-all duration-200 relative z-10">
            <FaUsers />
          </div>
        </Link>

        {/* สถิติ 2: การบ้านรอตรวจ -> สีฟ้าครามสดใส (Sky / Blue) */}
        <Link 
          href="/teacher/grading"
          className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 border border-sky-400/30 flex items-center justify-between group hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 cursor-pointer"
        >
          <div className="absolute -top-10 -left-10 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          <div className="absolute -right-3 -bottom-3 text-white/10 text-6xl pointer-events-none transform -rotate-12 group-hover:scale-110 group-hover:text-white/15 transition-all duration-300">
            <FaFileSignature />
          </div>
          <div className="space-y-1 text-left relative z-10">
            <h3 className="text-[26px] font-black text-white tracking-tight drop-shadow-sm leading-tight">
              {summaryData?.stats.pendingGrading ?? 0} งาน
            </h3>
            <p className="text-[11px] font-semibold text-sky-100/90">การบ้านที่รอตรวจ</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md text-white border border-white/30 flex items-center justify-center text-xl shrink-0 group-hover:bg-white group-hover:text-blue-600 shadow-md transition-all duration-200 relative z-10">
            <FaFileSignature />
          </div>
        </Link>

        {/* สถิติ 3: บทเรียนที่เปิดให้ดู -> สีม่วงสดเข้ม (Purple / Violet) */}
        <Link 
          href="/teacher/materials"
          className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-700 text-white shadow-lg shadow-purple-500/20 border border-purple-400/30 flex items-center justify-between group hover:shadow-xl hover:shadow-purple-500/30 hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 cursor-pointer"
        >
          <div className="absolute -top-10 -left-10 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          <div className="absolute -right-3 -bottom-3 text-white/10 text-6xl pointer-events-none transform -rotate-12 group-hover:scale-110 group-hover:text-white/15 transition-all duration-300">
            <FaFolderOpen />
          </div>
          <div className="space-y-1 text-left relative z-10">
            <h3 className="text-[26px] font-black text-white tracking-tight drop-shadow-sm leading-tight">
              {summaryData?.stats.unlockedMaterials ?? 0} บท
            </h3>
            <p className="text-[11px] font-semibold text-purple-100/90">บทเรียนที่เปิดให้นักเรียนดู</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md text-white border border-white/30 flex items-center justify-center text-xl shrink-0 group-hover:bg-white group-hover:text-purple-600 shadow-md transition-all duration-200 relative z-10">
            <FaFolderOpen />
          </div>
        </Link>

        {/* สถิติ 4: จำนวนมินิเกม -> สีส้มแอมเบอร์ประกาย (Orange / Amber / Rose) */}
        <Link 
          href="/teacher/leaderboard"
          className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 text-white shadow-lg shadow-orange-500/20 border border-orange-400/30 flex items-center justify-between group hover:shadow-xl hover:shadow-orange-500/30 hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 cursor-pointer"
        >
          <div className="absolute -top-10 -left-10 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          <div className="absolute -right-3 -bottom-3 text-white/10 text-6xl pointer-events-none transform -rotate-12 group-hover:scale-110 group-hover:text-white/15 transition-all duration-300">
            <FaGamepad />
          </div>
          <div className="space-y-1 text-left relative z-10">
            <h3 className="text-[26px] font-black text-white tracking-tight drop-shadow-sm leading-tight">
              {summaryData?.stats.totalGames ?? 1} เกม
            </h3>
            <p className="text-[11px] font-semibold text-orange-100/90">มินิเกมในระบบทั้งหมด</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md text-white border border-white/30 flex items-center justify-center text-xl shrink-0 group-hover:bg-white group-hover:text-orange-600 shadow-md transition-all duration-200 relative z-10">
            <FaGamepad />
          </div>
        </Link>

      </div>

      {/* 
        ส่วนที่ 2: แบนเนอร์ภาพรวมพร้อมปุ่มเชื่อมต่อ และดรอปดาวน์เลือกห้องเรียน
      */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 text-left w-full md:w-auto">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-800">
              ภาพรวมการเรียนการสอนรายวิชา วิทยาการคำนวณ
            </h2>
            
            {/* ดรอปดาวน์เลือกวิชาเรียนและห้องย่อย */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 w-full sm:w-auto">
              <CustomSelect
                options={[
                  { value: "ALL", label: "ทุกระดับชั้นปี" },
                  ...uniqueYearLevels.map((year) => ({
                    value: year,
                    label: year === "ม.3" ? "มัธยมศึกษาปีที่ 3" : year === "ม.2" ? "มัธยมศึกษาปีที่ 2" : "มัธยมศึกษาปีที่ 1"
                  }))
                ]}
                value={selectedYearLevel}
                onChange={(val) => handleYearLevelChange(val)}
                accentColor="emerald"
              />

              <CustomSelect
                options={[
                  { value: "ALL", label: "ดูทั้งหมด (ทุกห้องเรียน)" },
                  ...availableRooms.map((cls) => ({
                    value: cls.id,
                    label: `ห้อง ${cls.yearLevel}/${cls.room}`
                  }))
                ]}
                value={selectedClassId}
                onChange={(val) => setSelectedClassId(val)}
                accentColor="emerald"
              />
            </div>

          </div>
          <p className="text-[11px] text-slate-400 font-semibold">
            อัปเดตสถิติล่าสุดประจำวันที่ {new Date().toLocaleDateString("th-TH")} | สื่อบทเรียนเปิดสอนอยู่ {summaryData?.stats.unlockedMaterials ?? 0} รายการ
          </p>
        </div>

        {/* ปุ่มสีเขียวระบุสถานะ Live Sync */}
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold border border-emerald-100 shadow-sm select-none">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>เชื่อมต่อห้องเรียนแล้ว</span>
          </span>
        </div>
      </div>

      {/* 
        ส่วนที่ 3: แผงควบคุม 2 คอลัมน์ (ซ้ายกว้าง 2 ส่วน, ขวาแคบ 1 ส่วน) ดีไซน์ตรงกับรูป 100%
      */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* === คอลัมน์ด้านซ้าย === */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* การ์ด: สรุปการเข้าเรียนประจำวัน (Attendance) */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-left space-y-4 hover:shadow-md transition-all duration-200">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <FaUserCheck className="text-emerald-500" />
              <span>สรุปการเข้าเรียนประจำวัน (Daily Attendance Summary)</span>
            </h3>
            
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              สัดส่วนการเข้าเรียนของชั้นเรียนห้องเรียนปัจจุบัน (คำนวณแบบเรียลไทม์)
            </p>

            {/* Segmented bar chart */}
            <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
              {attPercent.total === 0 ? (
                <div className="w-full h-full bg-slate-200 dark:bg-slate-800 transition-all duration-300"></div>
              ) : (
                <>
                  <div style={{ width: `${attPercent.present}%` }} className="h-full bg-emerald-500 transition-all duration-300"></div>
                  <div style={{ width: `${attPercent.late}%` }} className="h-full bg-amber-500 transition-all duration-300"></div>
                  <div style={{ width: `${attPercent.leave}%` }} className="h-full bg-purple-500 transition-all duration-300"></div>
                  <div style={{ width: `${attPercent.absent}%` }} className="h-full bg-rose-500 transition-all duration-300"></div>
                </>
              )}
            </div>

            {attPercent.total === 0 && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold text-center -mt-1">
                ยังไม่มีการบันทึกข้อมูลการเข้าเรียนในวันนี้ (0 คน)
              </p>
            )}

            {/* การ์ดสถิติย่อขอบข้างหลากสี */}
            <div className="grid grid-cols-4 gap-2">
              {/* มาเรียน */}
              <div className="bg-emerald-50/40 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-100/80 dark:border-emerald-800/40 border-l-[3px] border-l-emerald-500 text-center hover:bg-emerald-100/40 dark:hover:bg-emerald-900/30 transition">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">{summaryData?.attendance.present ?? 0} คน</span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold block mt-0.5">มาเรียน</span>
              </div>
              {/* สาย */}
              <div className="bg-amber-50/40 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-100/80 dark:border-amber-800/40 border-l-[3px] border-l-amber-500 text-center hover:bg-amber-100/40 dark:hover:bg-amber-900/30 transition">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block">{summaryData?.attendance.late ?? 0} คน</span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold block mt-0.5">สาย</span>
              </div>
              {/* ลา */}
              <div className="bg-purple-50/40 dark:bg-purple-950/30 p-2.5 rounded-xl border border-purple-100/80 dark:border-purple-800/40 border-l-[3px] border-l-purple-500 text-center hover:bg-purple-100/40 dark:hover:bg-purple-900/30 transition">
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 block">{summaryData?.attendance.leave ?? 0} คน</span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold block mt-0.5">ลาป่วย/กิจ</span>
              </div>
              {/* ขาดเรียน */}
              <div className="bg-rose-50/40 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-100/80 dark:border-rose-800/40 border-l-[3px] border-l-rose-500 text-center hover:bg-rose-100/40 dark:hover:bg-rose-900/30 transition">
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 block">{summaryData?.attendance.absent ?? 0} คน</span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold block mt-0.5">ขาดเรียน</span>
              </div>
            </div>

            <Link 
              href="/teacher/attendance"
              className="w-full flex items-center justify-center gap-1.5 py-3.5 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 font-bold text-xs rounded-xl hover:bg-sky-100 dark:hover:bg-sky-900/50 hover:shadow transition-all shadow-xs border border-sky-100 dark:border-sky-800/50 active:scale-[0.99]"
            >
              <FaUserCheck />
              <span>ลงทะเบียน / บันทึกข้อมูลการเข้าเรียนประจำวัน</span>
            </Link>
          </div>

          {/* การ์ด: การบ้านรอดำเนินการตรวจ (Recent Submissions) */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-left space-y-4">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <FaFileSignature className="text-sky-500" />
              <span>การบ้านรอดำเนินการตรวจ (Recent Submissions)</span>
            </h3>

            {summaryData?.recentSubmissions.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">ไม่มีการบ้านค้างตรวจในห้องเรียนนี้</p>
            ) : (
              <div className="space-y-3">
                {summaryData?.recentSubmissions.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/90 transition">
                    <div className="flex items-center gap-3">
                      <FaFilePdf className="text-2xl text-rose-500 shrink-0" />
                      <div>
                        <h5 className="font-bold text-slate-700 dark:text-slate-200 text-xs">{sub.assignmentTitle}</h5>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
                          ส่งโดย: {sub.studentName} | เมื่อเวลา {new Date(sub.submittedAt).toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' })} น.
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/teacher/grading"
                      className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-lg text-[10px] shadow-sm flex items-center gap-0.5"
                    >
                      ตรวจ
                    </Link>
                  </div>
                ))}
              </div>
            )}

            <Link 
              href="/teacher/grading"
              className="w-full flex items-center justify-center gap-1.5 py-3.5 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 font-bold text-xs rounded-xl hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors shadow-sm border border-sky-100 dark:border-sky-800/50"
            >
              <FaFileSignature />
              <span>ไปที่แผงตรวจการบ้านทั้งหมด</span>
            </Link>
          </div>

        </div>

        {/* === คอลัมน์ด้านขวา === */}
        <div className="space-y-6">
          
          {/* การ์ด: สิทธิ์การเปิดเผยสื่อบทเรียน (Course Materials Lock) */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-left space-y-4">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <FaBookOpen className="text-purple-500" />
              <span>สิทธิ์การเปิดเผยสื่อบทเรียน (Course Materials Lock)</span>
            </h3>

            <p className="text-[10px] text-slate-400 font-semibold">
              กำหนดการปลดล็อกสื่อเสริมและสไลด์การสอน
            </p>

            {summaryData?.materials.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">ยังไม่มีสื่อบทเรียนที่อัปโหลดไว้</p>
            ) : (
              <div className="space-y-3">
                {summaryData?.materials.map((m) => (
                  <div key={m.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl">
                    <div className="min-w-0 flex-1">
                      <h5 className="font-bold text-slate-700 dark:text-slate-200 text-xs truncate">{m.title}</h5>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold block mt-0.5">{m.isLocked ? "ซ่อนอยู่" : "เปิดเรียนรู้"}</span>
                    </div>
                    
                    <button
                      onClick={() => handleToggleMaterial(m.id, m.isLocked)}
                      disabled={isPending}
                      className="text-2xl cursor-pointer shrink-0"
                    >
                      {m.isLocked ? (
                        <FaToggleOff className="text-slate-300 dark:text-slate-600" />
                      ) : (
                        <FaToggleOn className="text-sky-500" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Link 
              href="/teacher/materials"
              className="w-full flex items-center justify-center gap-1.5 py-3.5 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 font-bold text-xs rounded-xl hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors shadow-sm border border-sky-100 dark:border-sky-800/50"
            >
              <span>ไปที่แผงควบคุมสิทธิ์บทเรียน (Time-lock)</span>
            </Link>
          </div>

          {/* การ์ด: ทำเนียบเกียรติยศนักเรียน (Leaderboard) */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-left space-y-4">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <FaTrophy className="text-yellow-500" />
              <span>ทำเนียบเกียรติยศนักเรียน (Leaderboard)</span>
            </h3>

            {summaryData?.leaderboard.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">ยังไม่มีประวัติคะแนนสะสม</p>
            ) : (
              <div className="space-y-2.5">
                {summaryData?.leaderboard.map((student) => (
                  <div key={student.rank} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                        student.rank === 1 ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-950/50 dark:text-yellow-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}>
                        {student.rank}
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-700 dark:text-slate-200 text-xs">{student.studentName}</h5>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">ห้อง ม.3/1 • ม.3</span>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-black text-sky-600 dark:text-sky-400">{student.totalPoints.toLocaleString()} pts</span>
                  </div>
                ))}
              </div>
            )}

            <Link 
              href="/teacher/leaderboard"
              className="w-full flex items-center justify-center gap-1.5 py-3.5 bg-sky-50 text-sky-600 font-bold text-xs rounded-xl hover:bg-sky-100 hover:shadow transition-all shadow-xs border border-sky-100 active:scale-[0.99]"
            >
              <FaTrophy />
              <span>ไปที่แผงสถิติมินิเกมและคะแนนชั้นเรียน</span>
            </Link>
          </div>

        </div>

      </div>

    </div>
  );
}
