"use client";

import { useEffect, useState } from "react";
import { getStudentDefaultClass, getStudentAttendanceHistory } from "@/app/actions/student";
import { getStudentClassrooms } from "@/app/actions/classroom";
import CustomSelect from "@/components/ui/CustomSelect";
import {
  FaUserCheck,
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
  FaTimesCircle,
  FaExclamationCircle,
  FaStickyNote,
} from "react-icons/fa";

type AttendanceStatus = "PRESENT" | "LATE" | "LEAVE" | "ABSENT";

interface AttendanceRecord {
  id: string;
  date: Date;
  status: AttendanceStatus;
  note: string | null;
}

interface Summary {
  total: number;
  present: number;
  late: number;
  leave: number;
  absent: number;
}

interface Classroom {
  id: string;
  name: string;
  yearLevel: string;
  room: string;
}

const statusConfig: Record<AttendanceStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  PRESENT: { label: "มาเรียน", color: "text-emerald-600 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60", icon: <FaCheckCircle className="text-emerald-500 dark:text-emerald-400" /> },
  LATE:    { label: "สาย",     color: "text-amber-600 dark:text-amber-300",   bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60",   icon: <FaClock className="text-amber-500 dark:text-amber-400" /> },
  LEAVE:   { label: "ลาป่วย/ลากิจ", color: "text-purple-600 dark:text-purple-300",  bg: "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/60",  icon: <FaStickyNote className="text-purple-500 dark:text-purple-400" /> },
  ABSENT:  { label: "ขาดเรียน", color: "text-rose-600 dark:text-rose-300",   bg: "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60",     icon: <FaTimesCircle className="text-rose-500 dark:text-rose-400" /> },
};

export default function StudentAttendanceHistoryPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, present: 0, late: 0, leave: 0, absent: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // ฟิลเตอร์ประเภทเวลา วัน เดือน สถานะ
  const [filterType, setFilterType] = useState<"all" | "daily" | "monthly">("all");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // โหลดห้องเรียนทั้งหมด
  useEffect(() => {
    const load = async () => {
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
    load();
  }, []);

  // โหลดประวัติเมื่อ class เปลี่ยน
  useEffect(() => {
    if (!selectedClassId) return;
    const load = async () => {
      setIsLoading(true);
      const data = await getStudentAttendanceHistory(selectedClassId) as { records: AttendanceRecord[]; summary: Summary };
      setRecords(data.records || []);
      setSummary(data.summary || { total: 0, present: 0, late: 0, leave: 0, absent: 0 });
      setIsLoading(false);
    };
    load();
  }, [selectedClassId]);

  // ดึงรายการเดือนที่ไม่ซ้ำกันจากข้อมูลประวัติการเข้าเรียนทั้งหมดเพื่อแสดงใน dropdown
  const availableMonths = Array.from(
    new Set(
      records.map((r) => {
        const d = new Date(r.date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        return `${year}-${month}`;
      })
    )
  ).sort().reverse();

  // แปลงปี-เดือนให้เป็นชื่อเดือนไทย (เช่น 2026-07 -> กรกฎาคม 2569)
  const formatThaiMonth = (yearMonthStr: string) => {
    const [year, month] = yearMonthStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
  };

  // กรองข้อมูลประวัติตามฟิลเตอร์ที่นักเรียนเลือก
  const filteredRecords = records.filter((rec) => {
    // 1. กรองตามสถานะ
    if (selectedStatus !== "ALL" && rec.status !== selectedStatus) {
      return false;
    }

    // 2. กรองตามประเภทช่วงเวลา
    const recDate = new Date(rec.date);
    if (filterType === "daily" && selectedDate) {
      const filterD = new Date(selectedDate);
      return (
        recDate.getFullYear() === filterD.getFullYear() &&
        recDate.getMonth() === filterD.getMonth() &&
        recDate.getDate() === filterD.getDate()
      );
    }

    if (filterType === "monthly" && selectedMonth) {
      const [fYear, fMonth] = selectedMonth.split("-");
      return (
        recDate.getFullYear() === parseInt(fYear) &&
        String(recDate.getMonth() + 1).padStart(2, "0") === fMonth
      );
    }

    return true;
  });

  // คำนวณยอดสรุป (Summary) ใหม่ตามผลลัพธ์การกรองจริง
  const filteredSummary = filteredRecords.reduce(
    (acc, curr) => {
      acc.total += 1;
      if (curr.status === "PRESENT") acc.present += 1;
      else if (curr.status === "LATE") acc.late += 1;
      else if (curr.status === "LEAVE") acc.leave += 1;
      else if (curr.status === "ABSENT") acc.absent += 1;
      return acc;
    },
    { total: 0, present: 0, late: 0, leave: 0, absent: 0 }
  );

  const attendanceRate = filteredSummary.total > 0
    ? Math.round(((filteredSummary.present + filteredSummary.late) / filteredSummary.total) * 100)
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FaUserCheck className="text-sky-500 dark:text-sky-400" />
            ประวัติการเข้าเรียนของฉัน
          </h1>
          <p className="text-sm text-slate-400 dark:text-slate-400 mt-1">บันทึกการเข้าเรียนรายวันทั้งหมดของคุณ</p>
        </div>

        {/* แสดงชื่อห้องเรียนที่เป็นปัจจุบันแบบคงที่ */}
        {classrooms.find(c => c.id === selectedClassId) && (
          <div className="px-4 py-2.5 bg-sky-50 dark:bg-sky-950/60 border border-sky-100 dark:border-sky-800/60 rounded-xl text-xs font-black text-sky-700 dark:text-sky-300 select-none shadow-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
            <span>{classrooms.find(c => c.id === selectedClassId)?.name} ({classrooms.find(c => c.id === selectedClassId)?.yearLevel}/{classrooms.find(c => c.id === selectedClassId)?.room})</span>
          </div>
        )}
      </div>

      {/* ฟิลเตอร์จัดการช่วงเวลาและค้นหา (รายวัน/รายเดือน) */}
      <div className="bg-white dark:bg-slate-900/90 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
          <span className="text-sm font-extrabold">🔍 ค้นหาและกรองประวัติ</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          
          {/* เลือกประเภทการกรอง */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">เลือกช่วงเวลา</label>
            <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
              <button
                onClick={() => { setFilterType("all"); setSelectedDate(""); setSelectedMonth(""); }}
                className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg transition-all ${filterType === "all" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
              >
                ทั้งหมด
              </button>
              <button
                onClick={() => { setFilterType("daily"); setSelectedMonth(""); }}
                className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg transition-all ${filterType === "daily" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
              >
                รายวัน
              </button>
              <button
                onClick={() => { setFilterType("monthly"); setSelectedDate(""); }}
                className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg transition-all ${filterType === "monthly" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
              >
                รายเดือน
              </button>
            </div>
          </div>

          {/* รายวัน input */}
          {filterType === "daily" && (
            <div className="space-y-1.5 text-left animate-in slide-in-from-top-2 duration-200">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">เลือกวันที่</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-sky-500 focus:bg-white dark:focus:bg-slate-800 transition"
              />
            </div>
          )}

          {/* รายเดือน select */}
          {filterType === "monthly" && (
            <div className="space-y-1.5 text-left animate-in slide-in-from-top-2 duration-200">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">เลือกเดือน</label>
              <CustomSelect
                options={[
                  { value: "", label: "-- เลือกเดือน --" },
                  ...availableMonths.map((m) => ({
                    value: m,
                    label: formatThaiMonth(m)
                  }))
                ]}
                value={selectedMonth}
                onChange={(val) => setSelectedMonth(val)}
                accentColor="blue"
              />
            </div>
          )}

          {/* Spacer สำหรับจัดกริดเมื่อเลือก ทั้งหมด */}
          {filterType === "all" && <div className="hidden sm:block"></div>}

          {/* ตัวกรองสถานะ */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">กรองสถานะ</label>
            <CustomSelect
              options={[
                { value: "ALL", label: "ทั้งหมดทุกสถานะ" },
                { value: "PRESENT", label: "มาเรียน" },
                { value: "LATE", label: "สาย" },
                { value: "LEAVE", label: "ลาป่วย/ลากิจ" },
                { value: "ABSENT", label: "ขาดเรียน" }
              ]}
              value={selectedStatus}
              onChange={(val) => setSelectedStatus(val)}
              accentColor="blue"
            />
          </div>

          {/* ปุ่มล้างตัวกรอง */}
          <button
            onClick={() => {
              setFilterType("all");
              setSelectedDate("");
              setSelectedMonth("");
              setSelectedStatus("ALL");
            }}
            className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl transition shadow-sm border border-slate-200 dark:border-slate-700"
          >
            ล้างตัวกรองทั้งหมด
          </button>

        </div>
      </div>

      {/* Summary Cards (เปลี่ยนเป็นยอดรวมตามการกรองจริง) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { 
            label: "มาเรียน", 
            value: filteredSummary.present, 
            cardStyle: "bg-white dark:bg-emerald-950/30 border-slate-200/80 dark:border-emerald-800/60 border-l-emerald-500 dark:border-l-emerald-400 shadow-sm dark:shadow-emerald-950/20", 
            textColor: "text-emerald-600 dark:text-emerald-300",
            labelColor: "text-slate-600 dark:text-emerald-200 font-bold",
            icon: <FaCheckCircle className="text-emerald-500 dark:text-emerald-400 text-base" />
          },
          { 
            label: "สาย",     
            value: filteredSummary.late,    
            cardStyle: "bg-white dark:bg-amber-950/30 border-slate-200/80 dark:border-amber-800/60 border-l-amber-500 dark:border-l-amber-400 shadow-sm dark:shadow-amber-950/20", 
            textColor: "text-amber-600 dark:text-amber-300",
            labelColor: "text-slate-600 dark:text-amber-200 font-bold",
            icon: <FaClock className="text-amber-500 dark:text-amber-400 text-base" />
          },
          { 
            label: "ลา",      
            value: filteredSummary.leave,   
            cardStyle: "bg-white dark:bg-purple-950/30 border-slate-200/80 dark:border-purple-800/60 border-l-purple-500 dark:border-l-purple-400 shadow-sm dark:shadow-purple-950/20", 
            textColor: "text-purple-600 dark:text-purple-300",
            labelColor: "text-slate-600 dark:text-purple-200 font-bold",
            icon: <FaStickyNote className="text-purple-500 dark:text-purple-400 text-base" />
          },
          { 
            label: "ขาดเรียน", 
            value: filteredSummary.absent, 
            cardStyle: "bg-white dark:bg-rose-950/30 border-slate-200/80 dark:border-rose-800/60 border-l-rose-500 dark:border-l-rose-400 shadow-sm dark:shadow-rose-950/20", 
            textColor: "text-rose-600 dark:text-rose-300",
            labelColor: "text-slate-600 dark:text-rose-200 font-bold",
            icon: <FaTimesCircle className="text-rose-500 dark:text-rose-400 text-base" />
          },
        ].map((s) => (
          <div key={s.label} className={`p-4 rounded-2xl border border-l-[5px] ${s.cardStyle} text-left transition-all duration-200`}>
            <div className="flex items-center justify-between">
              <p className={`text-2xl font-black ${s.textColor}`}>{s.value} <span className="text-sm font-semibold opacity-85">ครั้ง</span></p>
              <div className="opacity-80">{s.icon}</div>
            </div>
            <p className={`text-xs mt-1.5 ${s.labelColor}`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* อัตราการเข้าเรียน */}
      <div className="bg-white dark:bg-slate-900/90 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-3 text-left">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <FaCalendarAlt className="text-sky-500 dark:text-sky-400" />
            อัตราการเข้าเรียนรวมในช่วงเวลาที่เลือก ({filteredSummary.total} วัน)
          </span>
          <span className={`text-lg font-black ${attendanceRate >= 80 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {attendanceRate}%
          </span>
        </div>
        <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${attendanceRate >= 80 ? "bg-emerald-500 dark:bg-emerald-400" : "bg-rose-500 dark:bg-rose-400"}`}
            style={{ width: `${attendanceRate}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
          {filteredSummary.total === 0 ? "ไม่มีข้อมูลสำหรับตัวกรองนี้" : attendanceRate >= 80 ? "✅ ผ่านเกณฑ์การเข้าเรียน (≥80%)" : "⚠️ ต่ำกว่าเกณฑ์การเข้าเรียน (80%)"}
        </p>
      </div>

      {/* รายการประวัติที่ผ่านการกรองแล้ว */}
      <div className="bg-white dark:bg-slate-900/90 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 text-left">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">บันทึกรายวัน ({filteredRecords.length} รายการ)</h2>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">กำลังโหลดข้อมูล...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FaExclamationCircle className="text-5xl text-amber-400 mx-auto" />
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">ไม่พบประวัติการเข้าเรียนที่ตรงกับตัวกรอง</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredRecords.map((rec) => {
              const cfg = statusConfig[rec.status];
              return (
                <div key={rec.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition">
                  <div className="flex items-center gap-3 text-left">
                    <div className="text-lg">{cfg.icon}</div>
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {new Date(rec.date).toLocaleDateString("th-TH", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                      {rec.note && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-0.5">📝 {rec.note}</p>
                      )}
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
