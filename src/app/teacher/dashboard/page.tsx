"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { getTeacherClassrooms } from "@/app/actions/classroom";
import { getDashboardSummaryData, toggleMaterialLock } from "@/app/actions/teacher";
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
  const [showLoginToast, setShowLoginToast] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [selectedYearLevel, setSelectedYearLevel] = useState<string>("");

  // ปิด Toast หลังจากโหลดหน้า 6 วินาที
  useEffect(() => {
    const timer = setTimeout(() => setShowLoginToast(false), 6000);
    return () => clearTimeout(timer);
  }, []);

  // โหลดห้องเรียนทั้งหมดในการเปิดหน้าแรก
  useEffect(() => {
    const fetchClasses = async () => {
      const classes = await getTeacherClassrooms();
      setClassrooms(classes);
      if (classes.length > 0) {
        setSelectedClassId(classes[0].id);
        setSelectedYearLevel(classes[0].yearLevel);
      } else {
        setIsLoading(false);
      }
    };
    fetchClasses();
  }, []);

  // ดึงระดับชั้นปีที่ไม่ซ้ำกัน
  const uniqueYearLevels = Array.from(new Set(classrooms.map(c => c.yearLevel))).sort();

  // ดึงห้องเรียนย่อยที่อยู่ในระดับชั้นปีที่เลือก
  const availableRooms = classrooms.filter(c => c.yearLevel === selectedYearLevel);

  // เมื่อผู้ใช้เปลี่ยนระดับชั้นปี
  const handleYearLevelChange = (year: string) => {
    setSelectedYearLevel(year);
    const firstClassInYear = classrooms.find(c => c.yearLevel === year);
    if (firstClassInYear) {
      setSelectedClassId(firstClassInYear.id);
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
    if (!summaryData) return { present: 100, late: 0, leave: 0, absent: 0 };
    const att = summaryData.attendance;
    const total = att.present + att.late + att.leave + att.absent;
    if (total === 0) return { present: 100, late: 0, leave: 0, absent: 0 }; // Default เป็นมาเรียนทั้งหมดถ้ายังไม่มีใครเช็คชื่อ
    return {
      present: (att.present / total) * 100,
      late: (att.late / total) * 100,
      leave: (att.leave / total) * 100,
      absent: (att.absent / total) * 100
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
        <div className="fixed top-5 right-5 z-[60] bg-white border border-slate-200 p-4 rounded-2xl shadow-xl flex items-center gap-3.5 max-w-sm animate-in slide-in-from-top-6 duration-300 border-l-[5px] border-l-slate-800">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 shrink-0 text-base">
            <FaCheckCircle className="text-emerald-500" />
          </div>
          <div className="text-left">
            <h4 className="text-xs font-black text-slate-800 tracking-tight">เข้าสู่ระบบสำเร็จ</h4>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">ยินดีต้อนรับคุณครูเข้าสู่ระบบจัดการ</p>
          </div>
          <button 
            onClick={() => setShowLoginToast(false)} 
            className="text-slate-300 hover:text-slate-500 font-bold ml-2 text-base outline-none"
          >
            &times;
          </button>
        </div>
      )}
      
      {/* 
        ส่วนที่ 1: แถบสถิติภาพรวม (Stats Grid) ดีไซน์ขอบโค้ง border-l และเงาแบบรูปภาพตัวอย่าง 100%
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* สถิติ 1: จำนวนนักเรียน */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-l-[5px] border-l-emerald-500 flex items-center justify-between group hover:shadow-md transition">
          <div className="space-y-1">
            <h3 className="text-[25px] font-black text-slate-800 tracking-tight">
              {summaryData?.stats.totalStudents ?? 0} คน
            </h3>
            <p className="text-[11px] font-bold text-slate-400">จำนวนนักเรียนในระบบทั้งหมด</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center text-lg shrink-0">
            <FaUsers />
          </div>
        </div>

        {/* สถิติ 2: งานรอตรวจ */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-l-[5px] border-l-sky-500 flex items-center justify-between group hover:shadow-md transition">
          <div className="space-y-1">
            <h3 className="text-[25px] font-black text-slate-800 tracking-tight">
              {summaryData?.stats.pendingGrading ?? 0} งาน
            </h3>
            <p className="text-[11px] font-bold text-slate-400">การบ้านที่รอตรวจ</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-500 flex items-center justify-center text-lg shrink-0">
            <FaFileSignature />
          </div>
        </div>

        {/* สถิติ 3: บทเรียนที่เปิดอยู่ */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-l-[5px] border-l-purple-500 flex items-center justify-between group hover:shadow-md transition">
          <div className="space-y-1">
            <h3 className="text-[25px] font-black text-slate-800 tracking-tight">
              {summaryData?.stats.unlockedMaterials ?? 0} บท
            </h3>
            <p className="text-[11px] font-bold text-slate-400">บทเรียนที่เปิดให้นักเรียนดู</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-500 flex items-center justify-center text-lg shrink-0">
            <FaFolderOpen />
          </div>
        </div>

        {/* สถิติ 4: จำนวนมินิเกม */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-l-[5px] border-l-orange-500 flex items-center justify-between group hover:shadow-md transition">
          <div className="space-y-1">
            <h3 className="text-[25px] font-black text-slate-800 tracking-tight">
              {summaryData?.stats.totalGames ?? 1} เกม
            </h3>
            <p className="text-[11px] font-bold text-slate-400">มินิเกมในระบบทั้งหมด</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center text-lg shrink-0">
            <FaGamepad />
          </div>
        </div>

      </div>

      {/* 
        ส่วนที่ 2: แบนเนอร์ภาพรวมพร้อมปุ่มเชื่อมต่อ และดรอปดาวน์เลือกห้องเรียน ม.3/1 (เหมือนสไลด์ดีไซน์)
      */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 text-left w-full md:w-auto">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-800">
              ภาพรวมการเรียนการสอนรายวิชา วิทยาการคำนวณ
            </h2>
            
            {/* ดรอปดาวน์เลือกวิชาเรียนและห้องย่อยตามเดโม่ */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <select
                value={selectedYearLevel}
                onChange={(e) => handleYearLevelChange(e.target.value)}
                className="flex-1 sm:flex-initial px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none cursor-pointer text-slate-700 hover:bg-slate-100 transition"
              >
                {uniqueYearLevels.map((year) => (
                  <option key={year} value={year}>
                    {year === "ม.3" ? "มัธยมศึกษาปีที่ 3" : year === "ม.2" ? "มัธยมศึกษาปีที่ 2" : "มัธยมศึกษาปีที่ 1"}
                  </option>
                ))}
              </select>

              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="flex-1 sm:flex-initial px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none cursor-pointer text-slate-700 hover:bg-slate-100 transition"
              >
                {availableRooms.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    ห้อง {cls.room}
                  </option>
                ))}
              </select>
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
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-left space-y-4">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <FaUserCheck className="text-emerald-500" />
              <span>สรุปการเข้าเรียนประจำวัน (Daily Attendance Summary)</span>
            </h3>
            
            <p className="text-xs text-slate-400 font-semibold">
              สัดส่วนการเข้าเรียนของชั้นเรียนห้องเรียนปัจจุบัน (คำนวณแบบเรียลไทม์)
            </p>

            {/* Segmented bar chart */}
            <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-50 border border-slate-100">
              <div style={{ width: `${attPercent.present}%` }} className="h-full bg-emerald-500 transition-all duration-300"></div>
              <div style={{ width: `${attPercent.late}%` }} className="h-full bg-amber-500 transition-all duration-300"></div>
              <div style={{ width: `${attPercent.leave}%` }} className="h-full bg-purple-500 transition-all duration-300"></div>
              <div style={{ width: `${attPercent.absent}%` }} className="h-full bg-rose-500 transition-all duration-300"></div>
            </div>

            {/* การ์ดสถิติย่อขอบข้างหลากสี */}
            <div className="grid grid-cols-4 gap-2">
              {/* มาเรียน */}
              <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 border-l-[3px] border-l-emerald-500 text-center">
                <span className="text-xs font-bold text-emerald-600 block">{summaryData?.attendance.present ?? 0} คน</span>
                <span className="text-[9px] text-slate-400 font-bold block mt-0.5">มาเรียน</span>
              </div>
              {/* สาย */}
              <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 border-l-[3px] border-l-amber-500 text-center">
                <span className="text-xs font-bold text-amber-600 block">{summaryData?.attendance.late ?? 0} คน</span>
                <span className="text-[9px] text-slate-400 font-bold block mt-0.5">สาย</span>
              </div>
              {/* ลา */}
              <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 border-l-[3px] border-l-purple-500 text-center">
                <span className="text-xs font-bold text-purple-600 block">{summaryData?.attendance.leave ?? 0} คน</span>
                <span className="text-[9px] text-slate-400 font-bold block mt-0.5">ลา</span>
              </div>
              {/* ขาดเรียน */}
              <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 border-l-[3px] border-l-rose-500 text-center">
                <span className="text-xs font-bold text-rose-600 block">{summaryData?.attendance.absent ?? 0} คน</span>
                <span className="text-[9px] text-slate-400 font-bold block mt-0.5">ขาดเรียน</span>
              </div>
            </div>

            <Link 
              href="/teacher/attendance"
              className="w-full flex items-center justify-center gap-1.5 py-3.5 bg-sky-50 text-sky-600 font-bold text-xs rounded-xl hover:bg-sky-100 transition-colors shadow-sm border border-sky-100"
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
                  <div key={sub.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100/50 transition">
                    <div className="flex items-center gap-3">
                      <FaFilePdf className="text-2xl text-rose-500 shrink-0" />
                      <div>
                        <h5 className="font-bold text-slate-700 text-xs">{sub.assignmentTitle}</h5>
                        <p className="text-[9px] text-slate-400 font-semibold mt-0.5">
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
              className="w-full flex items-center justify-center gap-1.5 py-3.5 bg-sky-50 text-sky-600 font-bold text-xs rounded-xl hover:bg-sky-100 transition-colors shadow-sm border border-sky-100"
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
                  <div key={m.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="min-w-0 flex-1">
                      <h5 className="font-bold text-slate-700 text-xs truncate">{m.title}</h5>
                      <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">{m.isLocked ? "ซ่อนอยู่" : "เปิดเรียนรู้"}</span>
                    </div>
                    
                    <button
                      onClick={() => handleToggleMaterial(m.id, m.isLocked)}
                      disabled={isPending}
                      className="text-2xl cursor-pointer shrink-0"
                    >
                      {m.isLocked ? (
                        <FaToggleOff className="text-slate-300" />
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
              className="w-full flex items-center justify-center gap-1.5 py-3.5 bg-sky-50 text-sky-600 font-bold text-xs rounded-xl hover:bg-sky-100 transition-colors shadow-sm border border-sky-100"
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
                  <div key={student.rank} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                        student.rank === 1 ? "bg-yellow-100 text-yellow-600" : "bg-slate-100 text-slate-500"
                      }`}>
                        {student.rank}
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-700 text-xs">{student.studentName}</h5>
                        <span className="text-[9px] text-slate-400 font-semibold">ห้อง ม.3/1 • ม.3</span>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-black text-sky-600">{student.totalPoints.toLocaleString()} pts</span>
                  </div>
                ))}
              </div>
            )}

            <Link 
              href="/teacher/grading"
              className="w-full flex items-center justify-center gap-1.5 py-3.5 bg-sky-50 text-sky-600 font-bold text-xs rounded-xl hover:bg-sky-100 transition-colors shadow-sm border border-sky-100"
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
