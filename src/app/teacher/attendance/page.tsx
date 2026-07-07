"use client";

import { useEffect, useState, useTransition } from "react";
import { getTeacherClassrooms } from "@/app/actions/classroom";
import { getAttendanceData, saveAttendance, getAttendanceHistoryLogs } from "@/app/actions/teacher";
import { 
  FaUserCheck, 
  FaHistory, 
  FaExclamationCircle, 
  FaCheckCircle 
} from "react-icons/fa";
import { AttendanceStatus } from "@prisma/client";
import AttendanceCheckTab from "@/components/teacher/attendance/AttendanceCheckTab";
import AttendanceHistoryTab from "@/components/teacher/attendance/AttendanceHistoryTab";

interface Classroom {
  id: string;
  name: string;
  yearLevel: string;
  room: string;
}

interface Student {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface AttendanceStudent {
  student: Student;
  status: AttendanceStatus | null;
  note: string;
}

export default function TeacherAttendancePage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  // จัดการเขตเวลา (Timezone-safe) เพื่อให้แสดงผลวันปัจจุบันตามเขตเวลาฝั่งไคลเอนต์เสมอ
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // === State สำหรับระบบประวัติการเช็คชื่อย้อนหลัง ===
  const [activeTab, setActiveTab] = useState<"check" | "history">("check");
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  useEffect(() => {
    // โหลดห้องเรียนทั้งหมดของคุณครูเพื่อสร้างดรอปดาวน์เลือกห้อง
    const fetchClasses = async () => {
      const classes = await getTeacherClassrooms();
      setClassrooms(classes);
      if (classes.length > 0) {
        setSelectedClassId(classes[0].id);
      }
    };
    fetchClasses();
  }, []);

  const loadHistoryLogs = async () => {
    setIsHistoryLoading(true);
    const data = await getAttendanceHistoryLogs();
    setHistoryLogs(data);
    setIsHistoryLoading(false);
  };

  useEffect(() => {
    if (activeTab === "history") {
      loadHistoryLogs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedClassId && activeTab === "check") {
      loadAttendance();
    }
  }, [selectedClassId, selectedDate, activeTab]);

  const loadAttendance = async () => {
    setIsLoading(true);
    const data = await getAttendanceData(selectedClassId, selectedDate);
    if (data) {
      setStudents(data as AttendanceStudent[]);
    }
    setIsLoading(false);
  };

  const showToast = (type: "success" | "error", text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // เปลี่ยนสถานะรายคนในสเตต
  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setStudents(prev => prev.map(s => 
      s.student.id === studentId 
        ? { ...s, status: s.status === status ? null : status } 
        : s
    ));
  };

  // เปลี่ยนหมายเหตุรายคนในสเตต
  const handleNoteChange = (studentId: string, note: string) => {
    setStudents(prev => prev.map(s => 
      s.student.id === studentId ? { ...s, note } : s
    ));
  };

  // เลือกเช็คชื่อสถานะเดียวกันให้กับนักเรียนทุกคน
  const markAllAs = (status: AttendanceStatus) => {
    setStudents(prev => prev.map(s => ({ ...s, status })));
  };

  // บันทึกการเข้าเรียน
  const handleSave = () => {
    const records = students.map(s => ({
      studentId: s.student.id,
      status: s.status || AttendanceStatus.PRESENT,
      note: s.note
    }));

    startTransition(async () => {
      const res = await saveAttendance(selectedClassId, selectedDate, records);
      if (res.success) {
        showToast("success", "บันทึกข้อมูลการเช็คชื่อเรียบร้อยแล้ว");
        loadAttendance();
      } else {
        showToast("error", res.error || "เกิดข้อผิดพลาด");
      }
    });
  };

  // ดึงรายละเอียดข้อมูลย้อนหลังกลับมาแสดงผลพร้อมแก้ไข
  const handleViewPastDetails = (classId: string, dateStr: string) => {
    setSelectedClassId(classId);
    setSelectedDate(dateStr);
    setActiveTab("check");
  };

  return (
    <div className="space-y-8">
      {/* Toast Alert */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 ${
          toastMsg.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
            : "bg-rose-50 border-rose-200 text-rose-800"
        }`}>
          {toastMsg.type === "success" ? <FaCheckCircle className="text-lg shrink-0" /> : <FaExclamationCircle className="text-lg shrink-0" />}
          <span className="text-sm font-semibold">{toastMsg.text}</span>
        </div>
      )}

      {/* ส่วนหัวและตัวเลือกแท็บ */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FaUserCheck className="text-emerald-500" /> เช็คชื่อเข้าเรียนประจำวัน
          </h1>
          <p className="text-sm text-slate-500">ลงชื่อและติดตามเวลาเข้าเรียนของนักเรียน</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Tab Switcher Buttons */}
          <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("check")}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeTab === "check"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <FaUserCheck className="text-[10px]" />
              <span>บันทึกเช็คชื่อ</span>
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeTab === "history"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <FaHistory className="text-[10px]" />
              <span>ประวัติย้อนหลัง</span>
            </button>
          </div>

          {activeTab === "check" && classrooms.length > 0 && (
            <div className="flex items-center gap-2.5">
              {/* ตัวเลือกห้องเรียน */}
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer text-slate-700 shadow-sm"
              >
                {classrooms.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.yearLevel}/{cls.room})
                  </option>
                ))}
              </select>

              {/* เลือกวันที่ */}
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none text-slate-700 shadow-sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {classrooms.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border text-center text-slate-500">
          <FaExclamationCircle className="text-5xl mx-auto text-amber-500 mb-4" />
          <p className="text-lg font-bold">ไม่พบวิชาหรือห้องเรียนของคุณครู</p>
          <p className="text-sm opacity-75 mt-1">กรุณาสร้างห้องเรียนก่อนเข้าไปบันทึกเช็คชื่อครับ</p>
        </div>
      ) : activeTab === "check" ? (
        <AttendanceCheckTab
          students={students}
          isLoading={isLoading}
          isPending={isPending}
          markAllAs={markAllAs}
          handleStatusChange={handleStatusChange}
          handleNoteChange={handleNoteChange}
          handleSave={handleSave}
        />
      ) : (
        <AttendanceHistoryTab
          historyLogs={historyLogs}
          isLoading={isHistoryLoading}
          onViewDetails={handleViewPastDetails}
        />
      )}
    </div>
  );
}
