"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { getTeacherClassrooms } from "@/app/actions/classroom";
import { getAssignmentsWithSubmissions, gradeSubmission } from "@/app/actions/teacher";
import {
  FaFileSignature,
  FaCheckCircle,
  FaExclamationCircle,
  FaFileAlt,
  FaTimes,
  FaLink,
  FaExternalLinkAlt,
  FaClipboardCheck,
  FaHourglassHalf,
  FaChevronDown,
  FaChevronUp,
  FaCommentAlt,
  FaUserCheck,
  FaUserClock,
  FaFolderOpen
} from "react-icons/fa";

interface Classroom { id: string; name: string; yearLevel: string; room: string; }

interface Submission {
  id: string; studentId: string; assignmentId: string;
  fileUrl: string | null; score: number | null; feedback: string | null;
  status: string; submittedAt: Date;
  student: { id: string; name: string; avatarUrl: string | null };
}

interface Assignment {
  id: string; title: string; description: string | null;
  maxPoints: number; isGoogleForm: boolean; googleFormUrl: string | null;
  dueDate: Date | null; createdAt: Date; submissions: Submission[];
}

export default function TeacherGradingPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<Record<string, "pending" | "graded" | "all">>({});

  const [selectedSub, setSelectedSub] = useState<{ sub: Submission; asm: Assignment } | null>(null);
  const [gradingFeedback, setGradingFeedback] = useState<string>("");

  const [isPending, startTransition] = useTransition();
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getTeacherClassrooms().then((classes) => {
      setClassrooms(classes);
      const savedClassId = localStorage.getItem("teacher-grading-classId");
      if (savedClassId && classes.some(c => c.id === savedClassId)) {
        setSelectedClassId(savedClassId);
      } else if (classes.length > 0) {
        setSelectedClassId(classes[0].id);
      }
    });

    // Load expanded card IDs
    try {
      const savedExpanded = localStorage.getItem("teacher-grading-expandedIds");
      if (savedExpanded) {
        setExpandedIds(new Set(JSON.parse(savedExpanded)));
      }
    } catch (e) {
      console.error("Failed to parse expandedIds", e);
    }

    // Load active tabs
    try {
      const savedTabs = localStorage.getItem("teacher-grading-activeTabs");
      if (savedTabs) {
        setActiveTab(JSON.parse(savedTabs));
      }
    } catch (e) {
      console.error("Failed to parse activeTabs", e);
    }
  }, []);

  const loadDataRef = useRef<typeof loadData>(null as any);
  useEffect(() => {
    loadDataRef.current = loadData;
  });

  useEffect(() => {
    if (selectedClassId) {
      loadDataRef.current(false);

      // ตั้งเวลาดึงข้อมูลใหม่แบบเงียบๆ ทุก 3 วินาที (ซิงก์เรียลไทม์ข้ามโปรไฟล์/ข้ามบราวเซอร์)
      const interval = setInterval(() => {
        if (loadDataRef.current) {
          loadDataRef.current(true);
        }
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [selectedClassId]);

  // คอยดึงข้อมูลใหม่แบบเรียลไทม์เมื่อมีนักเรียนส่งการบ้านหรือกดยืนยันข้อสอบเสร็จสิ้น
  useEffect(() => {
    const bc = new BroadcastChannel("lms-channel");
    bc.onmessage = (event) => {
      if (event.data?.type === "ASSIGNMENT_SUBMITTED") {
        if (loadDataRef.current) {
          loadDataRef.current(true);
        }
      }
    };
    return () => {
      bc.close();
    };
  }, [selectedClassId]);

  const loadData = async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    const data = await getAssignmentsWithSubmissions(selectedClassId);
    const asms = data as Assignment[];
    setAssignments(asms);
    // ขยาย card แรกอัตโนมัติเฉพาะตอนไม่ใช่การดึงข้อมูลเงียบๆ และยังไม่มีประวัติขยายการ์ด
    if (!isSilent && asms.length > 0) {
      const savedExpanded = localStorage.getItem("teacher-grading-expandedIds");
      if (!savedExpanded) {
        setExpandedIds(new Set([asms[0].id]));
      }
    }
    if (!isSilent) setIsLoading(false);
  };

  const showToast = (type: "success" | "error", text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    localStorage.setItem("teacher-grading-classId", classId);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem("teacher-grading-expandedIds", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const getTab = (id: string) => activeTab[id] ?? "pending";
  const setTab = (id: string, tab: "pending" | "graded" | "all") => {
    setActiveTab(prev => {
      const next = { ...prev, [id]: tab };
      localStorage.setItem("teacher-grading-activeTabs", JSON.stringify(next));
      return next;
    });
  };

  const openGrading = (sub: Submission, asm: Assignment) => {
    setSelectedSub({ sub, asm });
    setGradingFeedback(sub.feedback || "");
  };

  const handleGrade = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSub) return;
    startTransition(async () => {
      const res = await gradeSubmission(selectedSub.sub.id, selectedSub.asm.maxPoints, gradingFeedback);
      if (res.success) {
        showToast("success", "ตรวจผลงานเรียบร้อยแล้ว ✅");
        
        // บรอดแคสต์ข้อความแจ้งฝั่งนักเรียนให้ซิงก์เกรดใหม่เรียลไทม์
        const bc = new BroadcastChannel("lms-channel");
        bc.postMessage({
          type: "ASSIGNMENT_GRADED",
          assignmentId: selectedSub.asm.id,
          studentId: selectedSub.sub.studentId
        });
        bc.close();

        setSelectedSub(null);
        loadData();
      } else {
        showToast("error", res.error || "เกิดข้อผิดพลาด");
      }
    });
  };

  const isFileUrl = (url: string) => url.startsWith("/uploads/");

  // สรุป stats รวม
  const totalPending = assignments.reduce((s, a) => s + a.submissions.filter(x => x.status !== "GRADED").length, 0);
  const totalGraded = assignments.reduce((s, a) => s + a.submissions.filter(x => x.status === "GRADED").length, 0);
  const totalSubs = totalPending + totalGraded;

  return (
    <div className="space-y-8">

      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-2xl shadow-xl border flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 ${toastMsg.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
          {toastMsg.type === "success" ? <FaCheckCircle className="shrink-0" /> : <FaExclamationCircle className="shrink-0" />}
          <span className="text-sm font-semibold">{toastMsg.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FaFileSignature className="text-orange-500" /> ตรวจการบ้านและประวัติการส่ง
          </h1>
          <p className="text-sm text-slate-500 mt-1">ตรวจงาน ดูประวัติย้อนหลังแต่ละใบงาน และเก็บบันทึกเป็นหลักฐาน</p>
        </div>
        <select
          value={selectedClassId}
          onChange={(e) => handleClassChange(e.target.value)}
          className="w-full md:w-auto px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none cursor-pointer text-slate-700 shadow-sm self-start md:self-auto"
        >
          {classrooms.map(cls => (
            <option key={cls.id} value={cls.id}>{cls.name} ({cls.yearLevel}/{cls.room})</option>
          ))}
        </select>
      </div>

      {classrooms.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border text-center text-slate-500">
          <FaExclamationCircle className="text-5xl mx-auto text-amber-400 mb-4" />
          <p className="text-lg font-bold">ไม่พบห้องเรียนของคุณครู</p>
        </div>
      ) : isLoading ? (
        <div className="py-16 text-center text-slate-400 font-medium animate-pulse">กำลังโหลดข้อมูล...</div>
      ) : assignments.length === 0 ? (
        <div className="bg-white p-14 rounded-2xl border text-center text-slate-400 space-y-3">
          <FaFolderOpen className="text-6xl mx-auto text-slate-200" />
          <p className="text-lg font-bold text-slate-600">ยังไม่มีการมอบหมายงาน</p>
          <p className="text-sm">ไปที่เมนู "มอบหมายงาน" เพื่อสร้างใบงานให้นักเรียน</p>
        </div>
      ) : (
        <div className="space-y-5">

          {/* Summary bar */}
          {totalSubs > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-white rounded-2xl border border-slate-100 p-3 sm:p-4 text-center shadow-sm">
                <p className="text-xl sm:text-2xl font-black text-slate-800">{assignments.length}</p>
                <p className="text-[10px] sm:text-xs text-slate-400 font-semibold mt-0.5">ใบงานทั้งหมด</p>
              </div>
              <div className="bg-orange-50 rounded-2xl border border-orange-100 p-3 sm:p-4 text-center shadow-sm">
                <p className="text-xl sm:text-2xl font-black text-orange-600">{totalPending}</p>
                <p className="text-[10px] sm:text-xs text-orange-400 font-semibold mt-0.5">รอตรวจ</p>
              </div>
              <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-3 sm:p-4 text-center shadow-sm">
                <p className="text-xl sm:text-2xl font-black text-emerald-600">{totalGraded}</p>
                <p className="text-[10px] sm:text-xs text-emerald-400 font-semibold mt-0.5">ตรวจแล้ว</p>
              </div>
            </div>
          )}

          {/* Assignment Accordion */}
          {assignments.map((asm) => {
            const pending = asm.submissions.filter(s => s.status !== "GRADED");
            const graded = asm.submissions.filter(s => s.status === "GRADED");
            const isOpen = expandedIds.has(asm.id);
            const tab = getTab(asm.id);

            let visibleSubs = tab === "pending" ? pending : tab === "graded" ? graded : asm.submissions;

            return (
              <div key={asm.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

                {/* Header row — คลิกเพื่อขยาย/ย่อ */}
                <button
                  onClick={() => toggleExpand(asm.id)}
                  className="w-full px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition text-left"
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 w-full">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${asm.isGoogleForm ? "bg-purple-100 text-purple-600" : "bg-orange-100 text-orange-600"}`}>
                      {asm.isGoogleForm ? <FaLink /> : <FaFileAlt />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-800 truncate">{asm.title}</h3>
                      {asm.description && <p className="text-xs text-slate-400 truncate mt-0.5">{asm.description}</p>}
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0 justify-start sm:justify-end w-full sm:w-auto self-start sm:self-auto">
                    {pending.length > 0 && (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-700 text-[10px] font-black rounded-full whitespace-nowrap">
                        <FaHourglassHalf className="text-[8px]" /> {pending.length} รอตรวจ
                      </span>
                    )}
                    {graded.length > 0 && (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full whitespace-nowrap">
                        <FaCheckCircle className="text-[8px]" /> {graded.length} ตรวจแล้ว
                      </span>
                    )}
                    {asm.submissions.length === 0 && (
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-400 text-[10px] font-bold rounded-full whitespace-nowrap">ยังไม่มีส่ง</span>
                    )}
                    <span className="ml-auto sm:ml-0">
                      {isOpen ? <FaChevronUp className="text-slate-300 text-xs" /> : <FaChevronDown className="text-slate-300 text-xs" />}
                    </span>
                  </div>
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div className="border-t border-slate-100">

                    {asm.submissions.length === 0 ? (
                      <div className="px-6 py-8 text-center text-slate-400 text-sm">
                        <FaUserClock className="text-3xl mx-auto text-slate-200 mb-2" />
                        ยังไม่มีนักเรียนส่งงานนี้
                      </div>
                    ) : (
                      <div className="p-5 space-y-4">

                        {/* Tab bar */}
                        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 gap-0.5 overflow-x-auto max-w-full no-scrollbar shrink-0 w-fit">
                          {[
                            { key: "pending", label: `รอตรวจ (${pending.length})`, icon: FaHourglassHalf },
                            { key: "graded", label: `ตรวจแล้ว (${graded.length})`, icon: FaUserCheck },
                            { key: "all", label: `ทั้งหมด (${asm.submissions.length})`, icon: FaFolderOpen }
                          ].map(({ key, label, icon: Icon }) => (
                            <button
                              key={key}
                              onClick={() => setTab(asm.id, key as any)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${tab === key ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                            >
                              <Icon className="text-[10px]" /> {label}
                            </button>
                          ))}
                        </div>

                        {/* Submission list */}
                        {visibleSubs.length === 0 ? (
                          <p className="text-sm text-slate-400 py-2 text-center">ไม่มีข้อมูลในหมวดนี้</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {visibleSubs.map((sub) => {
                              const isGraded = sub.status === "GRADED";
                              return (
                                <div key={sub.id} className={`p-4 rounded-xl border space-y-3 transition-all ${isGraded ? "bg-emerald-50/50 border-emerald-100" : "bg-orange-50/40 border-orange-100 hover:border-orange-300 hover:shadow-sm"}`}>
                                  <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 ${isGraded ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-600"}`}>
                                      {sub.student.name.charAt(0)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-bold text-slate-800 text-sm truncate">{sub.student.name}</p>
                                      <p className="text-[11px] text-slate-400">ส่ง: {new Date(sub.submittedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</p>
                                    </div>
                                    {isGraded
                                      ? <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full shrink-0"><FaCheckCircle className="text-[8px]" /> ตรวจแล้ว</span>
                                      : <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-black rounded-full shrink-0"><FaHourglassHalf className="text-[8px]" /> รอตรวจ</span>
                                    }
                                  </div>

                                  {/* ไฟล์/ลิงก์ */}
                                  {sub.fileUrl && (
                                    <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-sky-600 hover:bg-sky-50 hover:border-sky-200 transition group truncate">
                                      {isFileUrl(sub.fileUrl) ? <FaFileAlt className="shrink-0 text-sky-500" /> : <FaLink className="shrink-0 text-sky-500" />}
                                      <span className="truncate flex-1">{isFileUrl(sub.fileUrl) ? sub.fileUrl.split("/").pop() : sub.fileUrl}</span>
                                      <FaExternalLinkAlt className="text-[9px] shrink-0 opacity-50 group-hover:opacity-100" />
                                    </a>
                                  )}

                                  {/* Feedback ที่เคยให้ */}
                                  {isGraded && sub.feedback && (
                                    <div className="flex items-start gap-2 px-3 py-2 bg-white border border-emerald-100 rounded-lg text-xs text-slate-600">
                                      <FaCommentAlt className="text-emerald-400 mt-0.5 shrink-0" />
                                      <span className="line-clamp-2">{sub.feedback}</span>
                                    </div>
                                  )}

                                  {/* ปุ่มตรวจ (เฉพาะที่ยังรอ) */}
                                  {!isGraded && (
                                    <button onClick={() => openGrading(sub, asm)}
                                      className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center justify-center gap-1.5">
                                      <FaClipboardCheck /> ตรวจผลงาน
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Grading Modal */}
      {selectedSub && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center text-xs"><FaClipboardCheck /></span>
                ตรวจผลงาน
              </h2>
              <button onClick={() => setSelectedSub(null)} className="text-slate-400 hover:text-slate-600 transition"><FaTimes /></button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-extrabold shrink-0">
                  {selectedSub.sub.student.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-800">{selectedSub.sub.student.name}</p>
                  <p className="text-xs text-slate-400">งาน: {selectedSub.asm.title}</p>
                </div>
              </div>

              {selectedSub.sub.fileUrl ? (
                <a href={selectedSub.sub.fileUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-sky-600 hover:bg-sky-50 hover:border-sky-200 transition group">
                  {isFileUrl(selectedSub.sub.fileUrl) ? <FaFileAlt className="text-sky-500 text-lg shrink-0" /> : <FaLink className="text-sky-500 text-lg shrink-0" />}
                  <span className="truncate flex-1">{isFileUrl(selectedSub.sub.fileUrl) ? selectedSub.sub.fileUrl.split("/").pop() : selectedSub.sub.fileUrl}</span>
                  <FaExternalLinkAlt className="text-xs text-slate-400 group-hover:text-sky-500 transition shrink-0" />
                </a>
              ) : (
                <p className="text-xs text-slate-400 px-1">ไม่มีไฟล์/ลิงก์แนบ</p>
              )}
              <p className="text-xs text-slate-400 px-1">ส่งเมื่อ: <span className="text-slate-600 font-semibold">{new Date(selectedSub.sub.submittedAt).toLocaleString("th-TH")}</span></p>
            </div>

            <form onSubmit={handleGrade} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                  <FaCommentAlt className="text-orange-400" /> Feedback (ไม่บังคับ)
                </label>
                <textarea value={gradingFeedback} onChange={(e) => setGradingFeedback(e.target.value)}
                  disabled={isPending} rows={3}
                  placeholder="เช่น ทำได้ดีมากครับ! ลองปรับแก้จุด X เพิ่มเติม..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 focus:bg-white transition resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setSelectedSub(null)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 text-sm font-bold transition">ยกเลิก</button>
                <button type="submit" disabled={isPending}
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm shadow-md disabled:opacity-50 transition flex items-center justify-center gap-2">
                  <FaClipboardCheck />
                  {isPending ? "กำลังบันทึก..." : "ยืนยันตรวจผลงาน"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
