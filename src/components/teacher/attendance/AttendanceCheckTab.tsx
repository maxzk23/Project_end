"use client";

import { AttendanceStatus } from "@prisma/client";
import { FaSave, FaExclamationCircle, FaLock, FaUnlockAlt } from "react-icons/fa";

interface Student {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface AttendanceStudent {
  student: Student;
  classId?: string;
  classroomName?: string;
  status: AttendanceStatus | null;
  note: string;
}

interface AttendanceCheckTabProps {
  students: AttendanceStudent[];
  isLoading: boolean;
  isPending: boolean;
  isLocked: boolean;
  onUnlockClick: () => void;
  markAllAs: (status: AttendanceStatus) => void;
  handleStatusChange: (studentId: string, status: AttendanceStatus) => void;
  handleNoteChange: (studentId: string, note: string) => void;
  handleSave: () => void;
}

export default function AttendanceCheckTab({
  students,
  isLoading,
  isPending,
  isLocked,
  onUnlockClick,
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

  const hasRecords = students.some(s => s.status !== null);
  const presentPercent = totalStudents > 0 && hasRecords ? (presentCount / totalStudents) * 100 : 0;
  const latePercent = totalStudents > 0 && hasRecords ? (lateCount / totalStudents) * 100 : 0;
  const leavePercent = totalStudents > 0 && hasRecords ? (leaveCount / totalStudents) * 100 : 0;
  const absentPercent = totalStudents > 0 && hasRecords ? (absentCount / totalStudents) * 100 : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
      {/* === ส่วนซ้าย: ตารางรายชื่อเช็คชื่อ === */}
      <div className="lg:col-span-2 space-y-6 text-left">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          
          {/* แถบแจ้งเตือนสถานะล็อก */}
          {isLocked && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl mb-5 flex justify-between items-center flex-wrap gap-3">
              <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200 text-xs font-bold">
                <FaLock className="text-amber-600 dark:text-amber-400 text-sm shrink-0" />
                <span>รายการเช็คชื่อของวันนี้ถูกล็อกไว้แล้ว (ป้องกันการแก้ไขโดยไม่ได้รับอนุญาต)</span>
              </div>
              <button
                type="button"
                onClick={onUnlockClick}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-xs font-bold shadow-sm hover:shadow hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
              >
                <FaUnlockAlt />
                <span>ปลดล็อกเพื่อแก้ไข</span>
              </button>
            </div>
          )}

          <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>รายชื่อนักเรียนเช็คชื่อ</span>
              {isLocked && (
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-slate-200 dark:border-slate-700">
                  🔒 Locked
                </span>
              )}
            </h3>

            {/* ดำเนินการเช็คชื่อทั้งหมด */}
            <div className="flex gap-2">
              <button
                onClick={() => markAllAs(AttendanceStatus.PRESENT)}
                disabled={isLocked || isPending}
                className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                เช็คมาทุกคน
              </button>
              <button
                onClick={() => markAllAs(AttendanceStatus.ABSENT)}
                disabled={isLocked || isPending}
                className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 rounded-lg text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-900/50 transition disabled:opacity-40 disabled:cursor-not-allowed"
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
            <>
              {/* Mobile Card List (< md) */}
              <div className="space-y-3.5 md:hidden">
                {students.map((item) => (
                  <div key={item.student.id} className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm border border-sky-200 shrink-0">
                        {item.student.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-slate-800 text-sm block truncate">{item.student.name}</span>
                        {item.classroomName && (
                          <span className="text-[11px] text-slate-400 font-semibold block truncate">{item.classroomName}</span>
                        )}
                      </div>
                    </div>

                    {/* 4 ปุ่มเลือกสถานะ */}
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      <button
                        onClick={() => handleStatusChange(item.student.id, AttendanceStatus.PRESENT)}
                        disabled={isLocked || isPending}
                        className={`py-2 rounded-xl text-xs font-extrabold border transition flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed ${
                          item.status === "PRESENT"
                            ? "bg-emerald-500 text-white border-emerald-500 shadow-xs"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        มา
                      </button>
                      <button
                        onClick={() => handleStatusChange(item.student.id, AttendanceStatus.LATE)}
                        disabled={isLocked || isPending}
                        className={`py-2 rounded-xl text-xs font-extrabold border transition flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed ${
                          item.status === "LATE"
                            ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        สาย
                      </button>
                      <button
                        onClick={() => handleStatusChange(item.student.id, AttendanceStatus.LEAVE)}
                        disabled={isLocked || isPending}
                        className={`py-2 rounded-xl text-[11px] font-extrabold border transition flex items-center justify-center text-center leading-tight disabled:opacity-60 disabled:cursor-not-allowed ${
                          item.status === "LEAVE"
                            ? "bg-purple-500 text-white border-purple-500 shadow-xs"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        ลาป่วย/ลากิจ
                      </button>
                      <button
                        onClick={() => handleStatusChange(item.student.id, AttendanceStatus.ABSENT)}
                        disabled={isLocked || isPending}
                        className={`py-2 rounded-xl text-xs font-extrabold border transition flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed ${
                          item.status === "ABSENT"
                            ? "bg-rose-500 text-white border-rose-500 shadow-xs"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        ขาด
                      </button>
                    </div>

                    {/* ช่องระบุหมายเหตุ */}
                    <input
                      type="text"
                      value={item.note || ""}
                      disabled={isLocked || isPending}
                      onChange={(e) => handleNoteChange(item.student.id, e.target.value)}
                      placeholder="หมายเหตุ (ถ้ามี)..."
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-sky-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                ))}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto">
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
                            <div>
                              <span className="font-bold text-slate-700 block">{item.student.name}</span>
                              {item.classroomName && (
                                <span className="text-[10px] text-slate-400 font-semibold">{item.classroomName}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5">
                          <div className="flex gap-1.5">
                            {/* มาเรียน */}
                            <button
                              onClick={() => handleStatusChange(item.student.id, AttendanceStatus.PRESENT)}
                              disabled={isLocked || isPending}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition disabled:opacity-60 disabled:cursor-not-allowed ${
                                item.status === "PRESENT"
                                  ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                              }`}
                            >
                              มา
                            </button>
                            {/* สาย */}
                            <button
                              onClick={() => handleStatusChange(item.student.id, AttendanceStatus.LATE)}
                              disabled={isLocked || isPending}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition disabled:opacity-60 disabled:cursor-not-allowed ${
                                item.status === "LATE"
                                  ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                              }`}
                            >
                              สาย
                            </button>
                            {/* ลาป่วย/ลากิจ */}
                            <button
                              onClick={() => handleStatusChange(item.student.id, AttendanceStatus.LEAVE)}
                              disabled={isLocked || isPending}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition disabled:opacity-60 disabled:cursor-not-allowed ${
                                item.status === "LEAVE"
                                  ? "bg-purple-500 text-white border-purple-500 shadow-sm"
                                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                              }`}
                            >
                              ลาป่วย/ลากิจ
                            </button>
                            {/* ขาด */}
                            <button
                              onClick={() => handleStatusChange(item.student.id, AttendanceStatus.ABSENT)}
                              disabled={isLocked || isPending}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition disabled:opacity-60 disabled:cursor-not-allowed ${
                                item.status === "ABSENT"
                                  ? "bg-rose-500 text-white border-rose-500 shadow-sm"
                                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
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
                            disabled={isLocked || isPending}
                            onChange={(e) => handleNoteChange(item.student.id, e.target.value)}
                            placeholder="ป่วย, ติดธุระ..."
                            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-xs w-full focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-sky-500 disabled:opacity-60 disabled:cursor-not-allowed"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ปุ่มบันทึกการเช็คชื่อ */}
          {students.length > 0 && (
            <div className="pt-6 border-t border-slate-100 mt-4 flex justify-between items-center flex-wrap gap-3">
              {isLocked ? (
                <div className="flex items-center gap-2 text-xs text-amber-700 font-bold bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
                  <FaLock />
                  <span>รายการนี้ถูกล็อกแล้ว หากต้องการแก้ไขกรุณากดปลดล็อก</span>
                </div>
              ) : (
                <div></div>
              )}
              
              <button
                onClick={handleSave}
                disabled={isLocked || isPending}
                className="flex items-center gap-2 px-5 py-3 bg-sky-500 text-white font-bold rounded-xl hover:bg-sky-600 transition shadow-md disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
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
          <h3 className="font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">สถิติห้องเรียนประจำวัน</h3>

          {/* กราฟแถบสัดส่วน Segmented Bar Chart */}
          <div className="space-y-1.5">
            <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold block">สัดส่วนการเข้าชั้นเรียนวันนี้:</span>
            <div className="w-full h-5 rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
              {!hasRecords || totalStudents === 0 ? (
                <div className="w-full h-full bg-slate-200 dark:bg-slate-800 transition-all duration-300"></div>
              ) : (
                <>
                  <div style={{ width: `${presentPercent}%` }} className="h-full bg-emerald-500 transition-all duration-300" title="มาเรียน"></div>
                  <div style={{ width: `${latePercent}%` }} className="h-full bg-amber-500 transition-all duration-300" title="สาย"></div>
                  <div style={{ width: `${leavePercent}%` }} className="h-full bg-purple-500 transition-all duration-300" title="ลาป่วย/ลากิจ"></div>
                  <div style={{ width: `${absentPercent}%` }} className="h-full bg-rose-500 transition-all duration-300" title="ขาดเรียน"></div>
                </>
              )}
            </div>
            {!hasRecords && totalStudents > 0 && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium text-center pt-1">
                ยังไม่มีการบันทึกข้อมูลเช็คชื่อประจำวันนี้
              </p>
            )}
          </div>

          {/* การ์ดตัวเลขสรุปแยกตามสถานะ */}
          <div className="grid grid-cols-2 gap-3">
            {/* มาเรียน */}
            <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-4 border border-emerald-200/80 dark:border-emerald-800/40 rounded-2xl text-center hover:bg-emerald-100/50 dark:hover:bg-emerald-950/50 transition-all shadow-2xs">
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 block">{presentCount} คน</span>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mt-1">มาเรียน ({presentPercent.toFixed(0)}%)</span>
            </div>
            {/* สาย */}
            <div className="bg-amber-50/60 dark:bg-amber-950/30 p-4 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl text-center hover:bg-amber-100/50 dark:hover:bg-amber-950/50 transition-all shadow-2xs">
              <span className="text-xl font-black text-amber-600 dark:text-amber-400 block">{lateCount} คน</span>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mt-1">มาสาย ({latePercent.toFixed(0)}%)</span>
            </div>
            {/* ลาป่วย/ลากิจ */}
            <div className="bg-purple-50/60 dark:bg-purple-950/30 p-4 border border-purple-200/80 dark:border-purple-800/40 rounded-2xl text-center hover:bg-purple-100/50 dark:hover:bg-purple-950/50 transition-all shadow-2xs">
              <span className="text-xl font-black text-purple-600 dark:text-purple-400 block">{leaveCount} คน</span>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mt-1">ลาป่วย/ลากิจ ({leavePercent.toFixed(0)}%)</span>
            </div>
            {/* ขาด */}
            <div className="bg-rose-50/60 dark:bg-rose-950/30 p-4 border border-rose-200/80 dark:border-rose-800/40 rounded-2xl text-center hover:bg-rose-100/50 dark:hover:bg-rose-950/50 transition-all shadow-2xs">
              <span className="text-xl font-black text-rose-600 dark:text-rose-400 block">{absentCount} คน</span>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mt-1">ขาดเรียน ({absentPercent.toFixed(0)}%)</span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-600 dark:text-slate-300 leading-relaxed shadow-xs">
            👉 <strong className="text-slate-800 dark:text-slate-100">สัดส่วนการมาเรียนจริง:</strong> คิดเป็น {((presentCount + lateCount) / (totalStudents || 1) * 100).toFixed(0)}% ของนักเรียนทั้งหมดในห้องเรียน
          </div>
        </div>
      </div>
    </div>
  );
}
