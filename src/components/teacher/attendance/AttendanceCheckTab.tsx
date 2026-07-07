"use client";

import { AttendanceStatus } from "@prisma/client";
import { FaSave, FaExclamationCircle } from "react-icons/fa";

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

interface AttendanceCheckTabProps {
  students: AttendanceStudent[];
  isLoading: boolean;
  isPending: boolean;
  markAllAs: (status: AttendanceStatus) => void;
  handleStatusChange: (studentId: string, status: AttendanceStatus) => void;
  handleNoteChange: (studentId: string, note: string) => void;
  handleSave: () => void;
}

export default function AttendanceCheckTab({
  students,
  isLoading,
  isPending,
  markAllAs,
  handleStatusChange,
  handleNoteChange,
  handleSave,
}: AttendanceCheckTabProps) {
  // คำนวณสถิติเข้าเรียนแบบเรียลไทม์เพื่อเรนเดอร์กราฟแท่ง
  const totalStudents = students.length;
  const presentCount = students.filter((s) => s.status === "PRESENT").length;
  const lateCount = students.filter((s) => s.status === "LATE").length;
  const leaveCount = students.filter((s) => s.status === "LEAVE").length;
  const absentCount = students.filter((s) => s.status === "ABSENT").length;

  const presentPercent = totalStudents > 0 ? (presentCount / totalStudents) * 100 : 100;
  const latePercent = totalStudents > 0 ? (lateCount / totalStudents) * 100 : 0;
  const leavePercent = totalStudents > 0 ? (leaveCount / totalStudents) * 100 : 0;
  const absentPercent = totalStudents > 0 ? (absentCount / totalStudents) * 100 : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
      {/* === ส่วนซ้าย: ตารางรายชื่อเช็คชื่อ === */}
      <div className="lg:col-span-2 space-y-6 text-left">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
            <h3 className="font-bold text-slate-800">รายชื่อนักเรียนเช็คชื่อ</h3>

            {/* ดำเนินการเช็คชื่อทั้งหมด */}
            <div className="flex gap-2">
              <button
                onClick={() => markAllAs(AttendanceStatus.PRESENT)}
                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 transition"
              >
                เช็คมาทุกคน
              </button>
              <button
                onClick={() => markAllAs(AttendanceStatus.ABSENT)}
                className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold hover:bg-rose-100 transition"
              >
                เช็คขาดทุกคน
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-slate-400">กำลังดึงข้อมูลนักเรียน...</div>
          ) : students.length === 0 ? (
            <div className="py-12 text-center text-slate-400">ไม่มีนักเรียนในห้องเรียนนี้</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-200">
                    <th className="pb-3 font-medium">ชื่อ-นามสกุล</th>
                    <th className="pb-3 font-medium">ทำรายการเช็คชื่อ</th>
                    <th className="pb-3 font-medium">หมายเหตุ (ถ้ามี)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((item) => (
                    <tr key={item.student.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs">
                            {item.student.name.charAt(0)}
                          </div>
                          <span className="font-bold text-slate-700">{item.student.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5">
                        <div className="flex gap-1.5">
                          {/* มาเรียน */}
                          <button
                            onClick={() => handleStatusChange(item.student.id, AttendanceStatus.PRESENT)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                              item.status === "PRESENT"
                                ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            มา
                          </button>
                          {/* สาย */}
                          <button
                            onClick={() => handleStatusChange(item.student.id, AttendanceStatus.LATE)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                              item.status === "LATE"
                                ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            สาย
                          </button>
                          {/* ลา */}
                          <button
                            onClick={() => handleStatusChange(item.student.id, AttendanceStatus.LEAVE)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                              item.status === "LEAVE"
                                ? "bg-purple-500 text-white border-purple-500 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            ลา
                          </button>
                          {/* ขาด */}
                          <button
                            onClick={() => handleStatusChange(item.student.id, AttendanceStatus.ABSENT)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                              item.status === "ABSENT"
                                ? "bg-rose-500 text-white border-rose-500 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            ขาด
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5">
                        <input
                          type="text"
                          value={item.note || ""}
                          disabled={isPending}
                          onChange={(e) => handleNoteChange(item.student.id, e.target.value)}
                          placeholder="ป่วย, ติดธุระ..."
                          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-full focus:outline-none focus:bg-white focus:border-sky-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ปุ่มบันทึกการเช็คชื่อ */}
          {students.length > 0 && (
            <div className="pt-6 border-t border-slate-100 mt-4 flex justify-end">
              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex items-center gap-2 px-5 py-3 bg-sky-500 text-white font-bold rounded-xl hover:bg-sky-600 transition shadow-md disabled:opacity-50"
              >
                <FaSave />
                <span>{isPending ? "กำลังบันทึก..." : "บันทึกการเข้าเรียน"}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* === ส่วนขวา: สถิติกราฟแบบเรียลไทม์ === */}
      <div className="space-y-6 text-left">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
          <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3">สถิติห้องเรียนประจำวัน</h3>

          {/* กราฟแถบสัดส่วน Segmented Bar Chart */}
          <div className="space-y-1.5">
            <span className="text-xs text-slate-400 font-bold block">สัดส่วนการเข้าชั้นเรียนวันนี้:</span>
            <div className="w-full h-5 rounded-full overflow-hidden flex bg-slate-100">
              <div style={{ width: `${presentPercent}%` }} className="h-full bg-emerald-500 transition-all duration-300" title="มาเรียน"></div>
              <div style={{ width: `${latePercent}%` }} className="h-full bg-amber-500 transition-all duration-300" title="สาย"></div>
              <div style={{ width: `${leavePercent}%` }} className="h-full bg-purple-500 transition-all duration-300" title="ลา"></div>
              <div style={{ width: `${absentPercent}%` }} className="h-full bg-rose-500 transition-all duration-300" title="ขาดเรียน"></div>
            </div>
          </div>

          {/* การ์ดตัวเลขสรุปแยกตามสถานะ */}
          <div className="grid grid-cols-2 gap-3">
            {/* มาเรียน */}
            <div className="bg-emerald-50/50 p-4 border border-emerald-100 rounded-xl text-center">
              <span className="text-xl font-black text-emerald-600 block">{presentCount} คน</span>
              <span className="text-[10px] font-bold text-slate-500">มาเรียน ({presentPercent.toFixed(0)}%)</span>
            </div>
            {/* สาย */}
            <div className="bg-amber-50/50 p-4 border border-amber-100 rounded-xl text-center">
              <span className="text-xl font-black text-amber-600 block">{lateCount} คน</span>
              <span className="text-[10px] font-bold text-slate-500">มาสาย ({latePercent.toFixed(0)}%)</span>
            </div>
            {/* ลา */}
            <div className="bg-purple-50/50 p-4 border border-purple-100 rounded-xl text-center">
              <span className="text-xl font-black text-purple-600 block">{leaveCount} คน</span>
              <span className="text-[10px] font-bold text-slate-500">ใบลา ({leavePercent.toFixed(0)}%)</span>
            </div>
            {/* ขาด */}
            <div className="bg-rose-50/50 p-4 border border-rose-100 rounded-xl text-center">
              <span className="text-xl font-black text-rose-600 block">{absentCount} คน</span>
              <span className="text-[10px] font-bold text-slate-500">ขาดเรียน ({absentPercent.toFixed(0)}%)</span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 leading-relaxed">
            👉 <strong>สัดส่วนการมาเรียนจริง:</strong> คิดเป็น {((presentCount + lateCount) / (totalStudents || 1) * 100).toFixed(0)}% ของนักเรียนทั้งหมดในห้องเรียน
          </div>
        </div>
      </div>
    </div>
  );
}
