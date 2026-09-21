"use client";

import { useState, useTransition } from "react";
import {
  FaChartPie,
  FaCheckCircle,
  FaExclamationCircle,
  FaExclamationTriangle,
  FaHourglassHalf,
  FaBell,
  FaSearch,
  FaUserGraduate,
  FaFolderOpen,
  FaFileAlt,
  FaExternalLinkAlt,
  FaPhoneAlt,
  FaChevronDown,
  FaChevronUp,
  FaTimes,
  FaTable,
  FaThList,
  FaLink,
  FaCheck,
  FaClock
} from "react-icons/fa";
import { sendAssignmentReminder, sendStudentMissingReminder } from "@/app/actions/teacher";
import { renderAvatarHelper } from "@/components/profile/ProfileSettings";

interface TrackingData {
  classrooms: any[];
  students: any[];
  assignments: any[];
  studentProgress: any[];
  overallStats: {
    totalStudents: number;
    totalAssignments: number;
    totalExpectedSubmissions: number;
    totalActualSubmissions: number;
    overallPercentage: number;
    completedStudentsCount: number;
    atRiskStudentsCount: number;
    onTimeSubmissions: number;
    lateSubmissions: number;
    gradedSubmissions: number;
    pendingSubmissions: number;
  };
}

interface Props {
  data: TrackingData | null;
  isLoading: boolean;
  onRefresh: () => void;
  showToast: (type: "success" | "error", text: string) => void;
}

export default function StudentTrackingView({ data, isLoading, onRefresh, showToast }: Props) {
  const [subView, setSubView] = useState<"assignments" | "students" | "matrix">("assignments");
  const [expandedAsmIds, setExpandedAsmIds] = useState<Set<string>>(new Set());
  const [studentSearch, setStudentSearch] = useState("");
  const [studentFilter, setStudentFilter] = useState<"all" | "missing" | "completed">("all");
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [isPending, startTransition] = useTransition();

  if (isLoading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-500 text-sm font-medium animate-pulse">กำลังประมวลผลข้อมูลการติดตามผลงาน...</p>
      </div>
    );
  }

  if (!data || data.assignments.length === 0) {
    return (
      <div className="bg-white p-14 rounded-3xl border border-slate-150 shadow-sm text-center text-slate-400 space-y-3">
        <FaFolderOpen className="text-6xl mx-auto text-slate-200" />
        <p className="text-lg font-bold text-slate-700">ยังไม่มีข้อมูลการมอบหมายงานในห้องนี้</p>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          เมื่อคุณครูสร้างการบ้านและมอบหมายให้นักเรียนแล้ว ระบบจะนำสถิติการส่งงานและเปอร์เซ็นต์ความคืบหน้ามาแสดงผลที่นี่
        </p>
      </div>
    );
  }

  const { overallStats, assignments, studentProgress } = data;

  const toggleExpand = (id: string) => {
    setExpandedAsmIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ส่งแจ้งเตือนตามงานทุกคนที่ค้างในใบงานนั้น (1-Click Reminder)
  const handleRemindAllMissing = (asmId: string, asmTitle: string) => {
    if (!confirm(`คุณครูต้องการส่งการแจ้งเตือนเตือนนักเรียนทุกคนที่ยังไม่ส่งงาน "${asmTitle}" ใช่หรือไม่?`)) return;

    startTransition(async () => {
      const res = await sendAssignmentReminder(asmId);
      if (res.success) {
        showToast("success", res.message || "ส่งแจ้งเตือนสำเร็จ");
        onRefresh();
      } else {
        showToast("error", res.error || "ไม่สามารถส่งแจ้งเตือนได้");
      }
    });
  };

  // ส่งแจ้งเตือนตามงานค้างให้นักเรียนรายบุคคล
  const handleRemindSingleStudent = (student: any) => {
    const missingTitles = student.missingAssignments.map((m: any) => m.title);
    if (missingTitles.length === 0) {
      showToast("success", "นักเรียนคนนี้ส่งงานครบทุกชิ้นแล้ว");
      return;
    }

    startTransition(async () => {
      const res = await sendStudentMissingReminder(student.studentId, missingTitles);
      if (res.success) {
        showToast("success", `ส่งแจ้งเตือนงานค้างถึง ${student.name} เรียบร้อยแล้ว`);
      } else {
        showToast("error", res.error || "เกิดข้อผิดพลาดในการส่งแจ้งเตือน");
      }
    });
  };

  // กรองรายชื่อนักเรียน
  const filteredStudents = studentProgress.filter(s => {
    const matchSearch =
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.rollNumber && s.rollNumber.toString().includes(studentSearch)) ||
      (s.studentCode && s.studentCode.toLowerCase().includes(studentSearch.toLowerCase()));

    if (!matchSearch) return false;

    if (studentFilter === "missing") return s.missingCount > 0;
    if (studentFilter === "completed") return s.isComplete;
    return true;
  });

  return (
    <div className="space-y-6">

      {/* 1. สถิติเปอร์เซ็นต์ภาพรวม (KPI Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: เปอร์เซ็นต์การส่งงานรวมทั้งห้อง */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-5 text-white shadow-lg shadow-orange-500/15 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-100">อัตราการส่งงานรวม</span>
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-sm">
              <FaChartPie />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-black tracking-tight">{overallStats.overallPercentage}%</span>
              <span className="text-xs text-amber-100 font-semibold">ส่งแล้ว</span>
            </div>
            {/* Progress Bar Mini */}
            <div className="w-full bg-black/20 rounded-full h-2 mt-2.5 overflow-hidden">
              <div
                className="bg-white h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.min(100, overallStats.overallPercentage)}%` }}
              />
            </div>
            <p className="text-[11px] text-amber-100 mt-2">
              ส่งแล้ว <span className="font-bold">{overallStats.totalActualSubmissions}</span> จากที่สั่งทั้งหมด{" "}
              <span className="font-bold">{overallStats.totalExpectedSubmissions}</span> ครั้ง
            </p>
          </div>
        </div>

        {/* Card 2: นักเรียนที่ส่งครบ 100% */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:border-emerald-200 transition flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">ส่งงานครบ 100%</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm">
              <FaCheckCircle />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-emerald-600">
                {overallStats.completedStudentsCount}
              </span>
              <span className="text-xs text-slate-400 font-bold">
                / {overallStats.totalStudents} คน
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              คิดเป็น{" "}
              <span className="font-bold text-emerald-600">
                {overallStats.totalStudents > 0
                  ? Math.round((overallStats.completedStudentsCount / overallStats.totalStudents) * 100)
                  : 0}%
              </span>{" "}
              ของนักเรียนทั้งหมด
            </p>
          </div>
        </div>

        {/* Card 3: ค้างส่งงาน / ต้องเร่งติดตาม */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:border-rose-200 transition flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">ยังมีงานค้างส่ง</span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center text-sm">
              <FaExclamationTriangle />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-rose-600">
                {overallStats.atRiskStudentsCount}
              </span>
              <span className="text-xs text-slate-400 font-bold">คน</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {overallStats.atRiskStudentsCount > 0 ? (
                <span className="text-rose-500 font-semibold">แนะนำให้กดส่งแจ้งเตือนตามงาน</span>
              ) : (
                <span className="text-emerald-600 font-semibold">ไม่มีนักเรียนค้างงานเลย เยี่ยมมาก!</span>
              )}
            </p>
          </div>
        </div>

        {/* Card 4: ส่งตรงเวลา vs ส่งล่าช้า */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:border-sky-200 transition flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">การส่งตรงเวลา</span>
            <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center text-sm">
              <FaClock />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-sky-600">
                {overallStats.onTimeSubmissions}
              </span>
              <span className="text-xs text-slate-400 font-bold">
                / {overallStats.totalActualSubmissions} งาน
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              ส่งช้ากว่ากำหนด <span className="font-bold text-amber-600">{overallStats.lateSubmissions}</span> ครั้ง
            </p>
          </div>
        </div>
      </div>

      {/* 2. เมนูย่อย (Sub-view switchers) */}
      <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1 w-fit border border-slate-200/80 dark:border-slate-700 shadow-xs">
        <button
          onClick={() => setSubView("assignments")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
            subView === "assignments"
              ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <FaThList className="text-[11px]" />
          <span>ตามรายใบงาน ({assignments.length})</span>
        </button>
        <button
          onClick={() => setSubView("students")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
            subView === "students"
              ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <FaUserGraduate className="text-[11px]" />
          <span>ตามรายนักเรียน ({studentProgress.length})</span>
        </button>
        <button
          onClick={() => setSubView("matrix")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
            subView === "matrix"
              ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <FaTable className="text-[11px]" />
          <span>ตารางภาพรวม (Matrix)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3.1 มุมมองที่ 1: รายใบงาน (By Assignment) */}
      {/* ========================================================================= */}
      {subView === "assignments" && (
        <div className="space-y-4">
          {assignments.map(asm => {
            const isOpen = expandedAsmIds.has(asm.id);
            const isHighCompletion = asm.percentage >= 80;
            const isLowCompletion = asm.percentage < 50;

            return (
              <div
                key={asm.id}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden transition hover:shadow-md hover:border-slate-300"
              >
                {/* Assignment Main Row */}
                <div className="p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg shrink-0 ${
                          asm.isGoogleForm ? "bg-purple-100 text-purple-600" : "bg-orange-100 text-orange-600"
                        }`}
                      >
                        {asm.isGoogleForm ? <FaLink /> : <FaFileAlt />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-extrabold text-slate-800 text-base">{asm.title}</h3>
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                            {asm.classroomName}
                          </span>
                          {asm.dueDate && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium flex items-center gap-1">
                              <FaClock className="text-[9px]" /> กำหนดส่ง:{" "}
                              {new Date(asm.dueDate).toLocaleDateString("th-TH")}
                            </span>
                          )}
                        </div>
                        {asm.description && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-1">{asm.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Progress Percentage Badge */}
                    <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                      <div className="text-right">
                        <div className="flex items-baseline gap-1 justify-end">
                          <span
                            className={`text-2xl font-black ${
                              isHighCompletion
                                ? "text-emerald-600"
                                : isLowCompletion
                                ? "text-rose-600"
                                : "text-amber-600"
                            }`}
                          >
                            {asm.percentage}%
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-semibold">
                          ส่งแล้ว {asm.submittedCount} / {asm.totalEnrolled} คน
                        </p>
                      </div>

                      <button
                        onClick={() => toggleExpand(asm.id)}
                        className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 flex items-center justify-center transition"
                        title="ดูรายละเอียดการส่งงาน"
                      >
                        {isOpen ? <FaChevronUp /> : <FaChevronDown />}
                      </button>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
                      {/* ส่วนที่ตรวจแล้ว (เขียว) */}
                      <div
                        className="bg-emerald-500 h-full transition-all duration-500"
                        style={{
                          width: `${
                            asm.totalEnrolled > 0 ? (asm.gradedCount / asm.totalEnrolled) * 100 : 0
                          }%`
                        }}
                        title={`ตรวจแล้ว: ${asm.gradedCount} คน`}
                      />
                      {/* ส่วนที่รอตรวจ (ส้ม) */}
                      <div
                        className="bg-amber-400 h-full transition-all duration-500"
                        style={{
                          width: `${
                            asm.totalEnrolled > 0 ? (asm.pendingCount / asm.totalEnrolled) * 100 : 0
                          }%`
                        }}
                        title={`รอตรวจ: ${asm.pendingCount} คน`}
                      />
                    </div>

                    {/* Legend & 1-Click Reminder */}
                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1 gap-2">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> ตรวจแล้ว ({asm.gradedCount})
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> รอตรวจ ({asm.pendingCount})
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-200" /> ยังไม่ส่ง ({asm.missingCount})
                        </span>
                      </div>

                      {asm.missingCount > 0 && (
                        <button
                          disabled={isPending}
                          onClick={() => handleRemindAllMissing(asm.id, asm.title)}
                          className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg border border-rose-200 transition text-[11px] shadow-xs active:scale-95 disabled:opacity-50"
                        >
                          <FaBell className="text-rose-500 animate-bounce" />
                          <span>แจ้งเตือนตามงานทุกคนที่ยังไม่ส่ง ({asm.missingCount} คน)</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details: ส่งแล้ว vs ยังไม่ส่ง */}
                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-5 sm:p-6 space-y-5">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* ฝั่งซ้าย: คนที่ยังไม่ส่ง (Missing Students) */}
                      <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-xs space-y-3">
                        <div className="flex items-center justify-between border-b border-rose-100 pb-2.5">
                          <h4 className="font-extrabold text-sm text-rose-800 flex items-center gap-2">
                            <FaExclamationCircle className="text-rose-500" />
                            <span>รายชื่อที่ยังไม่ส่งงาน ({asm.missingStudents.length} คน)</span>
                          </h4>
                        </div>

                        {asm.missingStudents.length === 0 ? (
                          <div className="py-8 text-center text-emerald-600 font-bold text-xs space-y-1">
                            <FaCheckCircle className="text-2xl mx-auto text-emerald-500" />
                            <p>ส่งครบ 100% แล้วทุกคน! 🎉</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                            {asm.missingStudents.map((ms: any) => (
                              <div
                                key={ms.id}
                                className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/40 border border-rose-100/60 hover:bg-rose-50 transition"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {renderAvatarHelper(ms.avatarUrl, ms.name, "w-8 h-8 text-xs")}
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-800 truncate">{ms.name}</p>
                                    <p className="text-[10px] text-slate-400">
                                      รหัส: {ms.studentId || "-"}
                                      {ms.parentPhone && ` • โทร: ${ms.parentPhone}`}
                                    </p>
                                  </div>
                                </div>
                                {ms.parentPhone && (
                                  <a
                                    href={`tel:${ms.parentPhone}`}
                                    className="p-1.5 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs shrink-0"
                                    title={`โทรติดต่อผู้ปกครอง: ${ms.parentPhone}`}
                                  >
                                    <FaPhoneAlt />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* ฝั่งขวา: คนที่ส่งแล้ว (Submitted Students) */}
                      <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs space-y-3">
                        <div className="flex items-center justify-between border-b border-emerald-100 pb-2.5">
                          <h4 className="font-extrabold text-sm text-emerald-800 flex items-center gap-2">
                            <FaCheckCircle className="text-emerald-500" />
                            <span>รายชื่อที่ส่งงานแล้ว ({asm.submissions.length} คน)</span>
                          </h4>
                        </div>

                        {asm.submissions.length === 0 ? (
                          <div className="py-8 text-center text-slate-400 text-xs space-y-1">
                            <FaHourglassHalf className="text-2xl mx-auto text-slate-300" />
                            <p>ยังไม่มีนักเรียนส่งงานนี้</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                            {asm.submissions.map((sub: any) => {
                              const isGraded = sub.status === "GRADED";
                              return (
                                <div
                                  key={sub.id}
                                  className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/40 border border-emerald-100/60 hover:bg-emerald-50 transition"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    {renderAvatarHelper(sub.avatarUrl, sub.studentName, "w-8 h-8 text-xs")}
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-slate-800 truncate">{sub.studentName}</p>
                                      <p className="text-[10px] text-slate-400">
                                        ส่งเมื่อ:{" "}
                                        {new Date(sub.submittedAt).toLocaleTimeString("th-TH", {
                                          hour: "2-digit",
                                          minute: "2-digit"
                                        })}
                                        {sub.isLate && <span className="text-rose-500 font-bold ml-1">(ส่งช้า)</span>}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {isGraded ? (
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-extrabold text-[10px]">
                                        {sub.score !== null ? `${sub.score}/${asm.maxPoints}` : "ตรวจแล้ว"}
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">
                                        รอตรวจ
                                      </span>
                                    )}

                                    {sub.fileUrl && (
                                      <a
                                        href={sub.fileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="p-1.5 rounded-lg bg-white border border-slate-200 text-sky-600 hover:bg-sky-50 text-xs"
                                        title="เปิดดูไฟล์งาน"
                                      >
                                        <FaExternalLinkAlt />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3.2 มุมมองที่ 2: รายนักเรียน (By Student) */}
      {/* ========================================================================= */}
      {subView === "students" && (
        <div className="space-y-4">
          {/* Controls: ค้นหา & ตัวกรอง */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input
                type="text"
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                placeholder="ค้นหาชื่อ, เลขที่, รหัสนักเรียน..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-orange-400"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 self-start sm:self-center overflow-x-auto no-scrollbar">
              {[
                { key: "all", label: `ทั้งหมด (${studentProgress.length})` },
                {
                  key: "missing",
                  label: `⚠️ ค้างส่งงาน (${studentProgress.filter(s => s.missingCount > 0).length})`
                },
                {
                  key: "completed",
                  label: `🌟 ส่งครบ 100% (${studentProgress.filter(s => s.isComplete).length})`
                }
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setStudentFilter(f.key as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    studentFilter === f.key
                      ? "bg-slate-800 text-white shadow-xs"
                      : "bg-white text-slate-500 border border-slate-200/80 hover:bg-slate-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Student Grid Cards */}
          {filteredStudents.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-150 text-center text-slate-400 space-y-2">
              <FaUserGraduate className="text-4xl mx-auto text-slate-300 mb-2" />
              <p className="text-base font-bold text-slate-700">ไม่พบนักเรียนตามเงื่อนไขที่ค้นหา</p>
              <p className="text-xs">ลองเปลี่ยนคำค้นหาหรือตัวกรองด้านบน</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredStudents.map(student => {
                const isComplete = student.isComplete;
                const hasMissing = student.missingCount > 0;

                return (
                  <div
                    key={student.studentId}
                    className={`bg-white rounded-3xl p-5 border transition-all duration-200 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md ${
                      hasMissing
                        ? "border-rose-200/80 hover:border-rose-300"
                        : "border-slate-200/80 hover:border-slate-300"
                    }`}
                  >
                    <div>
                      {/* Top Info */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {renderAvatarHelper(student.avatarUrl, student.name, "w-10 h-10 text-sm")}
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-slate-800 text-sm truncate">{student.name}</h4>
                            <p className="text-[11px] text-slate-400">
                              เลขที่ {student.rollNumber || "-"} • รหัส {student.studentCode || "-"}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {isComplete ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-extrabold text-[10px] flex items-center gap-1">
                              <FaCheck /> ส่งครบ 100%
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 font-extrabold text-[10px] flex items-center gap-1">
                              <FaExclamationTriangle className="text-[9px]" /> ค้าง {student.missingCount} งาน
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-4 space-y-1.5">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-500">ความคืบหน้าการส่ง</span>
                          <span
                            className={
                              isComplete
                                ? "text-emerald-600"
                                : student.percentage >= 60
                                ? "text-amber-600"
                                : "text-rose-600"
                            }
                          >
                            {student.percentage}% ({student.submittedCount}/{student.totalAssignments})
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isComplete
                                ? "bg-emerald-500"
                                : student.percentage >= 60
                                ? "bg-amber-500"
                                : "bg-rose-500"
                            }`}
                            style={{ width: `${student.percentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Missing assignments pill previews */}
                      {hasMissing && (
                        <div className="mt-3 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100 text-[11px] space-y-1">
                          <p className="font-bold text-rose-700 flex items-center gap-1">
                            <FaExclamationCircle className="text-[10px]" /> งานที่ยังค้างส่ง:
                          </p>
                          <p className="text-rose-600 line-clamp-1">
                            {student.missingAssignments.map((m: any) => m.title).join(", ")}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                      <button
                        onClick={() => setSelectedStudent(student)}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition text-center"
                      >
                        ดูประวัติงาน
                      </button>

                      {hasMissing && (
                        <button
                          onClick={() => handleRemindSingleStudent(student)}
                          className="py-1.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition flex items-center gap-1 shrink-0"
                          title="ส่งการแจ้งเตือนตามงานค้าง"
                        >
                          <FaBell className="text-[10px]" /> เตือน
                        </button>
                      )}

                      {student.parentPhone && (
                        <a
                          href={`tel:${student.parentPhone}`}
                          className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 text-xs transition"
                          title={`โทรติดต่อผู้ปกครอง: ${student.parentPhone}`}
                        >
                          <FaPhoneAlt />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3.3 มุมมองที่ 3: ตารางเมทริกซ์สรุปผล (Matrix Heatmap) */}
      {/* ========================================================================= */}
      {subView === "matrix" && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <FaTable className="text-orange-500" /> ตารางภาพรวมการส่งงานทั้งห้องเรียน
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                กวาดสายตามองสถานะของนักเรียนทุกคนเทียบกับใบงานแต่ละชิ้นได้ในหน้าเดียว
              </p>
            </div>
            {/* Color guide */}
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1 text-emerald-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> ตรวจแล้ว
              </span>
              <span className="flex items-center gap-1 text-amber-700">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> รอตรวจ
              </span>
              <span className="flex items-center gap-1 text-rose-700">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> ยังไม่ส่ง
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4 min-w-[180px]">ชื่อ-นามสกุล</th>
                  <th className="py-3 px-3 text-center w-24">อัตราส่ง (%)</th>
                  {assignments.map(asm => (
                    <th key={asm.id} className="py-3 px-3 text-center min-w-[110px]" title={asm.title}>
                      <div className="truncate max-w-[120px] mx-auto font-extrabold">{asm.title}</div>
                      <div className="text-[10px] text-slate-400 font-normal">({asm.percentage}%)</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentProgress.map(student => (
                  <tr key={student.studentId} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 text-center font-bold text-slate-500">
                      {student.rollNumber || "-"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-extrabold text-slate-800">{student.name}</div>
                      <div className="text-[10px] text-slate-400">{student.studentCode || student.classroomName}</div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full font-black text-[10px] ${
                          student.isComplete
                            ? "bg-emerald-100 text-emerald-700"
                            : student.percentage >= 60
                            ? "bg-amber-100 text-amber-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {student.percentage}%
                      </span>
                    </td>

                    {/* Status cell for each assignment */}
                    {assignments.map(asm => {
                      const sub = asm.submissions.find((s: any) => s.studentId === student.studentId);
                      if (sub) {
                        const isGraded = sub.status === "GRADED";
                        return (
                          <td key={asm.id} className="py-3 px-3 text-center">
                            {isGraded ? (
                              <span
                                className="inline-flex items-center justify-center px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-black text-[11px] shadow-xs cursor-default"
                                title={`ตรวจแล้ว: ได้คะแนน ${sub.score}/${asm.maxPoints}`}
                              >
                                {sub.score !== null ? `${sub.score}p` : "ตรวจแล้ว"}
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center justify-center px-2 py-1 bg-amber-100 text-amber-800 rounded-lg font-bold text-[10px] cursor-default"
                                title="ส่งแล้ว (รอครูตรวจ)"
                              >
                                รอตรวจ
                              </span>
                            )}
                          </td>
                        );
                      } else {
                        return (
                          <td key={asm.id} className="py-3 px-3 text-center">
                            <span
                              className="inline-flex items-center justify-center w-7 h-7 bg-rose-50 text-rose-500 border border-rose-200/80 rounded-lg font-black text-xs cursor-default"
                              title="ยังไม่ส่งงานนี้"
                            >
                              ✕
                            </span>
                          </td>
                        );
                      }
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. Modal: รายละเอียดงานของนักเรียนรายบุคคล */}
      {/* ========================================================================= */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200 border border-slate-100 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                {renderAvatarHelper(selectedStudent.avatarUrl, selectedStudent.name, "w-10 h-10 text-sm")}
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">{selectedStudent.name}</h3>
                  <p className="text-xs text-slate-400">
                    เลขที่ {selectedStudent.rollNumber || "-"} • รหัส {selectedStudent.studentCode || "-"} •{" "}
                    {selectedStudent.classroomName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl transition"
              >
                <FaTimes />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto space-y-4 pr-1 flex-1">
              {/* Stats Bar */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-center">
                <div>
                  <p className="text-xs text-slate-400 font-bold">อัตราส่งงาน</p>
                  <p className="text-xl font-black text-orange-600">{selectedStudent.percentage}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold">ส่งแล้ว</p>
                  <p className="text-xl font-black text-emerald-600">
                    {selectedStudent.submittedCount}/{selectedStudent.totalAssignments}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold">คะแนนรวมที่ได้</p>
                  <p className="text-xl font-black text-slate-700">
                    {selectedStudent.totalScore}
                    <span className="text-xs text-slate-400 font-normal">/{selectedStudent.maxScorePossible}</span>
                  </p>
                </div>
              </div>

              {/* งานที่ค้างส่ง (ถ้ามี) */}
              {selectedStudent.missingAssignments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                    <FaExclamationTriangle /> งานที่ยังค้างส่ง ({selectedStudent.missingAssignments.length} งาน)
                  </h4>
                  <div className="space-y-2">
                    {selectedStudent.missingAssignments.map((m: any) => (
                      <div
                        key={m.assignmentId}
                        className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800">{m.title}</p>
                          {m.dueDate && (
                            <p className="text-[10px] text-rose-500">
                              กำหนดส่ง: {new Date(m.dueDate).toLocaleDateString("th-TH")}
                              {m.isOverdue && " (เลยกำหนดส่งแล้ว)"}
                            </p>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                          ยังไม่ส่ง
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* งานที่ส่งแล้ว */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                  <FaCheckCircle /> ประวัติงานที่ส่งแล้ว ({selectedStudent.submittedAssignments.length} งาน)
                </h4>
                {selectedStudent.submittedAssignments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">ยังไม่มีประวัติการส่งงาน</p>
                ) : (
                  <div className="space-y-2">
                    {selectedStudent.submittedAssignments.map((sub: any) => (
                      <div
                        key={sub.assignmentId}
                        className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-xl space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-800">{sub.title}</p>
                            <p className="text-[10px] text-slate-400">
                              ส่งเมื่อ: {new Date(sub.submittedAt).toLocaleString("th-TH")}
                              {sub.isLate && <span className="text-rose-500 font-bold ml-1">(ส่งช้า)</span>}
                            </p>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[11px]">
                            {sub.status === "GRADED" ? `${sub.score}/${sub.maxPoints} คะแนน` : "รอตรวจ"}
                          </span>
                        </div>

                        {sub.feedback && (
                          <div className="p-2 bg-white rounded-lg border border-emerald-100 text-[11px] text-slate-600">
                            <span className="font-bold text-emerald-700">ฟีดแบค: </span>
                            {sub.feedback}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
              {selectedStudent.missingCount > 0 ? (
                <button
                  onClick={() => handleRemindSingleStudent(selectedStudent)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
                >
                  <FaBell /> ส่งแจ้งเตือนตามงานค้าง ({selectedStudent.missingCount} งาน)
                </button>
              ) : (
                <div className="flex-1 text-xs text-emerald-600 font-bold flex items-center gap-1">
                  <FaCheckCircle /> ส่งงานครบทุกชิ้นเรียบร้อยแล้ว
                </div>
              )}
              <button
                onClick={() => setSelectedStudent(null)}
                className="py-2.5 px-5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs transition"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
