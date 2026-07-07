"use client";

import { useEffect, useState } from "react";
import { getStudentDefaultClass, getStudentAttendanceHistory } from "@/app/actions/student";
import { getStudentClassrooms } from "@/app/actions/classroom";
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
  PRESENT: { label: "มาเรียน", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", icon: <FaCheckCircle className="text-emerald-500" /> },
  LATE:    { label: "สาย",     color: "text-amber-600",   bg: "bg-amber-50 border-amber-200",   icon: <FaClock className="text-amber-500" /> },
  LEAVE:   { label: "ลา",      color: "text-purple-600",  bg: "bg-purple-50 border-purple-200",  icon: <FaStickyNote className="text-purple-500" /> },
  ABSENT:  { label: "ขาดเรียน", color: "text-rose-600",   bg: "bg-rose-50 border-rose-200",     icon: <FaTimesCircle className="text-rose-500" /> },
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
      const classes = await getStudentClassrooms();
      setClassrooms(classes);

      const defaultClass = await getStudentDefaultClass();
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FaUserCheck className="text-sky-500" />
            ประวัติการเข้าเรียนของฉัน
          </h1>
          <p className="text-sm text-slate-400 mt-1">บันทึกการเข้าเรียนรายวันทั้งหมดของคุณ</p>
        </div>

        {/* แสดงชื่อห้องเรียนที่เป็นปัจจุบันแบบคงที่ */}
        {classrooms.find(c => c.id === selectedClassId) && (
          <div className="px-4 py-2.5 bg-sky-50 border border-sky-150 rounded-xl text-xs font-black text-sky-700 select-none shadow-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
            <span>{classrooms.find(c => c.id === selectedClassId)?.name} ({classrooms.find(c => c.id === selectedClassId)?.yearLevel}/{classrooms.find(c => c.id === selectedClassId)?.room})</span>
          </div>
        )}
      </div>

      {/* ฟิลเตอร์จัดการช่วงเวลาและค้นหา (รายวัน/รายเดือน) */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex items-center gap-2 text-slate-700">
          <span className="text-sm font-extrabold">🔍 ค้นหาและกรองประวัติ</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          
          {/* เลือกประเภทการกรอง */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">เลือกช่วงเวลา</label>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => { setFilterType("all"); setSelectedDate(""); setSelectedMonth(""); }}
                className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg transition-all ${filterType === "all" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              >
                ทั้งหมด
              </button>
              <button
                onClick={() => { setFilterType("daily"); setSelectedMonth(""); }}
                className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg transition-all ${filterType === "daily" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              >
                รายวัน
              </button>
              <button
                onClick={() => { setFilterType("monthly"); setSelectedDate(""); }}
                className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg transition-all ${filterType === "monthly" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              >
                รายเดือน
              </button>
            </div>
          </div>

          {/* รายวัน input */}
          {filterType === "daily" && (
            <div className="space-y-1.5 text-left animate-in slide-in-from-top-2 duration-200">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">เลือกวันที่</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-sky-500 focus:bg-white transition"
              />
            </div>
          )}

          {/* รายเดือน select */}
          {filterType === "monthly" && (
            <div className="space-y-1.5 text-left animate-in slide-in-from-top-2 duration-200">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">เลือกเดือน</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-sky-500 focus:bg-white transition"
              >
                <option value="">-- เลือกเดือน --</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatThaiMonth(m)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Spacer สำหรับจัดกริดเมื่อเลือก ทั้งหมด */}
          {filterType === "all" && <div className="hidden sm:block"></div>}

          {/* ตัวกรองสถานะ */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">กรองสถานะ</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-sky-500 focus:bg-white transition"
            >
              <option value="ALL">ทั้งหมดทุกสถานะ</option>
              <option value="PRESENT">มาเรียน</option>
              <option value="LATE">สาย</option>
              <option value="LEAVE">ลา</option>
              <option value="ABSENT">ขาดเรียน</option>
            </select>
          </div>

          {/* ปุ่มล้างตัวกรอง */}
          <button
            onClick={() => {
              setFilterType("all");
              setSelectedDate("");
              setSelectedMonth("");
              setSelectedStatus("ALL");
            }}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition shadow-sm border border-slate-200"
          >
            ล้างตัวกรองทั้งหมด
          </button>

        </div>
      </div>

      {/* Summary Cards (เปลี่ยนเป็นยอดรวมตามการกรองจริง) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "มาเรียน", value: filteredSummary.present, color: "border-l-emerald-500", textColor: "text-emerald-600" },
          { label: "สาย",     value: filteredSummary.late,    color: "border-l-amber-500",   textColor: "text-amber-600" },
          { label: "ลา",      value: filteredSummary.leave,   color: "border-l-purple-500",  textColor: "text-purple-600" },
          { label: "ขาดเรียน", value: filteredSummary.absent, color: "border-l-rose-500",    textColor: "text-rose-600" },
        ].map((s) => (
          <div key={s.label} className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 border-l-[5px] ${s.color} text-left`}>
            <p className={`text-2xl font-black ${s.textColor}`}>{s.value} <span className="text-sm font-semibold">ครั้ง</span></p>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* อัตราการเข้าเรียน */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3 text-left">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <FaCalendarAlt className="text-sky-500" />
            อัตราการเข้าเรียนรวมในช่วงเวลาที่เลือก ({filteredSummary.total} วัน)
          </span>
          <span className={`text-lg font-black ${attendanceRate >= 80 ? "text-emerald-600" : "text-rose-600"}`}>
            {attendanceRate}%
          </span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${attendanceRate >= 80 ? "bg-emerald-500" : "bg-rose-500"}`}
            style={{ width: `${attendanceRate}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-400 font-semibold">
          {filteredSummary.total === 0 ? "ไม่มีข้อมูลสำหรับตัวกรองนี้" : attendanceRate >= 80 ? "✅ ผ่านเกณฑ์การเข้าเรียน (≥80%)" : "⚠️ ต่ำกว่าเกณฑ์การเข้าเรียน (80%)"}
        </p>
      </div>

      {/* รายการประวัติที่ผ่านการกรองแล้ว */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 text-left">
          <h2 className="text-sm font-bold text-slate-700">บันทึกรายวัน ({filteredRecords.length} รายการ)</h2>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">กำลังโหลดข้อมูล...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FaExclamationCircle className="text-5xl text-amber-400 mx-auto" />
            <p className="text-sm font-bold text-slate-500">ไม่พบประวัติการเข้าเรียนที่ตรงกับตัวกรอง</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filteredRecords.map((rec) => {
              const cfg = statusConfig[rec.status];
              return (
                <div key={rec.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition">
                  <div className="flex items-center gap-3 text-left">
                    <div className="text-lg">{cfg.icon}</div>
                    <div>
                      <p className="text-sm font-bold text-slate-700">
                        {new Date(rec.date).toLocaleDateString("th-TH", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                      {rec.note && (
                        <p className="text-[11px] text-slate-400 mt-0.5">📝 {rec.note}</p>
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
