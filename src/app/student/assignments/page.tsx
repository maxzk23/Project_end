"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { getStudentDefaultClass, getStudentAssignments, submitStudentAssignment } from "@/app/actions/student";
import { getStudentClassrooms } from "@/app/actions/classroom";
import {
  FaFileAlt,
  FaCheckCircle,
  FaExclamationCircle,
  FaLink,
  FaArrowRight,
  FaCloudUploadAlt,
  FaFile,
  FaPaperPlane,
  FaTimes,
  FaHourglassHalf,
  FaCommentAlt,
  FaExternalLinkAlt
} from "react-icons/fa";

interface Classroom { id: string; name: string; yearLevel: string; room: string; }

interface Assignment {
  id: string; title: string; description: string | null;
  maxPoints: number; isGoogleForm: boolean; googleFormUrl: string | null;
  dueDate: Date | null; createdAt: Date;
  submission: {
    id: string; fileUrl: string | null; score: number | null;
    feedback: string | null; status: string; submittedAt: Date;
  } | null;
}

type SubmitMode = "link" | "file";

export default function StudentAssignmentsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<"all" | "pending" | "submitted">("all");

  const [submitModes, setSubmitModes] = useState<Record<string, SubmitMode>>({});
  const [linkValues, setLinkValues] = useState<Record<string, string>>({});
  const [fileValues, setFileValues] = useState<Record<string, File | null>>({});
  const [dragOver, setDragOver] = useState<Record<string, boolean>>({});

  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const init = async () => {
      const classes = await getStudentClassrooms();
      setClassrooms(classes);
      const def = await getStudentDefaultClass();
      if (def) setSelectedClassId(def.id);
      else if (classes.length > 0) setSelectedClassId(classes[0].id);
      else setIsLoading(false);
    };
    init();
  }, []);

  const loadAssignmentsRef = useRef<typeof loadAssignments>(null as any);
  useEffect(() => {
    loadAssignmentsRef.current = loadAssignments;
  });

  useEffect(() => {
    if (selectedClassId) {
      loadAssignmentsRef.current(false);

      // ตั้งเวลาดึงข้อมูลใหม่แบบเงียบๆ ทุก 3 วินาที (ซิงก์เรียลไทม์ข้ามโปรไฟล์/ข้ามบราวเซอร์)
      const interval = setInterval(() => {
        if (loadAssignmentsRef.current) {
          loadAssignmentsRef.current(true);
        }
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [selectedClassId]);

  // คอยดึงข้อมูลใหม่แบบเรียลไทม์ผ่าน BroadcastChannel สำหรับแท็บที่เปิดคู่กัน
  useEffect(() => {
    const bc = new BroadcastChannel("lms-channel");
    bc.onmessage = (event) => {
      if (event.data?.type === "ASSIGNMENT_GRADED" || event.data?.type === "ASSIGNMENT_CHANGED") {
        if (loadAssignmentsRef.current) {
          loadAssignmentsRef.current(true);
        }
      }
    };
    return () => {
      bc.close();
    };
  }, [selectedClassId]);

  const loadAssignments = async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    const data = await getStudentAssignments(selectedClassId);
    setAssignments(data as Assignment[]);
    if (!isSilent) setIsLoading(false);
  };

  const showToast = (type: "success" | "error", text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 5000);
  };

  const getMode = (id: string): SubmitMode => submitModes[id] ?? "link";
  const setMode = (id: string, mode: SubmitMode) => {
    setSubmitModes(prev => ({ ...prev, [id]: mode }));
    setFileValues(prev => ({ ...prev, [id]: null }));
    setLinkValues(prev => ({ ...prev, [id]: "" }));
  };

  const handleDrop = (id: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(prev => ({ ...prev, [id]: false }));
    const file = e.dataTransfer.files[0];
    if (file) setFileValues(prev => ({ ...prev, [id]: file }));
  };

  const handleSubmit = (asmId: string, e: React.FormEvent) => {
    e.preventDefault();
    const mode = getMode(asmId);
    const formData = new FormData();
    formData.set("mode", mode);
    if (mode === "link") {
      const url = linkValues[asmId]?.trim() || "";
      if (!url) return showToast("error", "กรุณาระบุลิงก์ไฟล์ผลงาน");
      formData.set("linkUrl", url);
    } else {
      const file = fileValues[asmId];
      if (!file) return showToast("error", "กรุณาเลือกไฟล์ที่ต้องการส่ง");
      formData.set("file", file);
    }
    setPendingId(asmId);
    startTransition(async () => {
      const res = await submitStudentAssignment(asmId, formData);
      setPendingId(null);
      if (res.success) {
        showToast("success", res.message || "ส่งงานสำเร็จ 🎉");
        setLinkValues(prev => ({ ...prev, [asmId]: "" }));
        setFileValues(prev => ({ ...prev, [asmId]: null }));
        loadAssignments();

        // ส่งข้อความ Real-time แจ้งฝั่งคุณครูให้ดึงข้อมูลใหม่ทันที
        const bc = new BroadcastChannel("lms-channel");
        bc.postMessage({ type: "ASSIGNMENT_SUBMITTED", assignmentId: asmId });
        bc.close();
      } else {
        showToast("error", res.error || "เกิดข้อผิดพลาด");
      }
    });
  };

  const handleGoogleFormSubmit = (asmId: string, googleFormUrl: string) => {
    const formData = new FormData();
    formData.set("mode", "link");
    formData.set("linkUrl", googleFormUrl || "https://docs.google.com/forms");
    setPendingId(asmId);
    startTransition(async () => {
      const res = await submitStudentAssignment(asmId, formData);
      setPendingId(null);
      if (res.success) {
        showToast("success", "ยืนยันการทำแบบทดสอบเสร็จเรียบร้อยแล้ว! 🎉");
        loadAssignments();

        // ส่งข้อความ Real-time แจ้งฝั่งคุณครูให้ดึงข้อมูลใหม่ทันที
        const bc = new BroadcastChannel("lms-channel");
        bc.postMessage({ type: "ASSIGNMENT_SUBMITTED", assignmentId: asmId });
        bc.close();
      } else {
        showToast("error", res.error || "เกิดข้อผิดพลาด");
      }
    });
  };

  const isFileUrl = (url: string) => url.startsWith("/uploads/");
  const isSubmitting = (id: string) => isPending && pendingId === id;

  // Stats
  const submitted = assignments.filter(a => !!a.submission).length;
  const notSubmitted = assignments.filter(a => !a.submission && !a.isGoogleForm).length;
  const graded = assignments.filter(a => a.submission?.status === "GRADED").length;
  const progressPct = assignments.length ? Math.round((submitted / assignments.length) * 100) : 0;

  const currentClass = classrooms.find(c => c.id === selectedClassId);

  // Filter
  const filtered = assignments.filter(a => {
    if (filterTab === "pending") return !a.submission;
    if (filterTab === "submitted") return !!a.submission;
    return true;
  });

  return (
    <div className="space-y-8">

      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-2xl shadow-xl border flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 max-w-sm ${toastMsg.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
          {toastMsg.type === "success" ? <FaCheckCircle className="shrink-0" /> : <FaExclamationCircle className="shrink-0" />}
          <span className="text-sm font-semibold flex-1">{toastMsg.text}</span>
          <button onClick={() => setToastMsg(null)} className="opacity-60 hover:opacity-100 transition"><FaTimes className="text-xs" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FaFileAlt className="text-sky-500" /> การบ้านและการส่งงาน
          </h1>
          <p className="text-sm text-slate-500 mt-1">ตรวจสอบงานทั้งหมด ส่งผลงาน และดูสถานะการตรวจจากครู</p>
        </div>
        {currentClass && (
          <div className="px-4 py-2.5 bg-sky-50 border border-sky-100 rounded-xl text-xs font-black text-sky-700 select-none shadow-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            <span>{currentClass.name} ({currentClass.yearLevel}/{currentClass.room})</span>
          </div>
        )}
      </div>

      {classrooms.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border text-center text-slate-500">
          <FaExclamationCircle className="text-5xl mx-auto text-amber-400 mb-4" />
          <p className="text-lg font-bold">ยังไม่ได้เข้าห้องเรียนใดๆ</p>
        </div>
      ) : isLoading ? (
        <div className="py-16 text-center text-slate-400 font-medium animate-pulse">กำลังโหลดข้อมูลการบ้าน...</div>
      ) : assignments.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border text-center text-slate-500 space-y-3">
          <FaCheckCircle className="text-6xl text-emerald-400 mx-auto" />
          <p className="text-lg font-bold text-slate-700">ยังไม่มีการบ้านที่ได้รับมอบหมาย</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Progress Summary */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-slate-700 text-sm">สถานะภาพรวม</h2>
              <span className="text-xs font-black text-sky-600">{submitted}/{assignments.length} ชิ้นงาน</span>
            </div>

            {/* Progress bar */}
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${progressPct === 100 ? "bg-emerald-400" : "bg-sky-400"}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="text-center">
                <p className="text-xl font-black text-orange-500">{notSubmitted}</p>
                <p className="text-[10px] text-slate-400 font-semibold">ยังไม่ส่ง</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-sky-500">{submitted}</p>
                <p className="text-[10px] text-slate-400 font-semibold">ส่งแล้ว</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-emerald-500">{graded}</p>
                <p className="text-[10px] text-slate-400 font-semibold">ตรวจแล้ว</p>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 gap-0.5 overflow-x-auto max-w-full no-scrollbar shrink-0">
            {[
              { key: "all", label: `ทั้งหมด (${assignments.length})` },
              { key: "pending", label: `ยังไม่ส่ง (${notSubmitted})` },
              { key: "submitted", label: `ส่งแล้ว (${submitted})` }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilterTab(key as any)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${filterTab === key ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Assignment Cards */}
          <div className="space-y-4">
            {filtered.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border text-center text-slate-400">ไม่มีข้อมูลในหมวดนี้</div>
            ) : filtered.map((asm) => {
              const mode = getMode(asm.id);
              const alreadySubmitted = !!asm.submission;
              const isGraded = asm.submission?.status === "GRADED";

              return (
                <div key={asm.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${isGraded ? "border-emerald-200" : alreadySubmitted ? "border-sky-200" : "border-slate-100"}`}>

                  {/* Status stripe */}
                  <div className={`h-1 w-full ${isGraded ? "bg-emerald-400" : alreadySubmitted ? "bg-sky-400" : "bg-amber-300"}`} />

                  {/* Title */}
                  <div className="px-6 pt-4 pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-800 leading-tight">{asm.title}</h3>
                      {asm.description && <p className="text-sm text-slate-500 mt-1 leading-relaxed">{asm.description}</p>}
                    </div>
                    <div className="shrink-0 self-start sm:self-auto">
                      {isGraded
                        ? <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full"><FaCheckCircle className="text-[8px]" /> ตรวจแล้ว</span>
                        : alreadySubmitted
                        ? <span className="flex items-center gap-1 px-2.5 py-1 bg-sky-100 text-sky-700 text-[10px] font-black rounded-full"><FaHourglassHalf className="text-[8px]" /> รอตรวจ</span>
                        : <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 text-[10px] font-black rounded-full"><FaExclamationCircle className="text-[8px]" /> ยังไม่ส่ง</span>
                      }
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">

                    {/* LEFT: ส่งงาน */}
                    <div className="p-5 space-y-4">
                      {asm.isGoogleForm ? (
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">แบบฝึกหัดออนไลน์</h4>
                          <div className="p-4 bg-purple-50 border border-purple-100 rounded-2xl space-y-3">
                            <p className="text-xs text-purple-800 font-semibold leading-relaxed">
                              แบบทดสอบนี้ใช้ Google Forms กรุณากดปุ่มเปิดแบบทดสอบเพื่อทำข้อสอบให้เสร็จเรียบร้อย เมื่อส่งคำตอบบนหน้า Google Forms แล้ว ให้กลับมากดปุ่มยืนยันส่งด้านล่างนี้
                            </p>
                            <a href={asm.googleFormUrl || "#"} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition w-full sm:w-auto">
                              <span>เปิดทำแบบฝึกหัด</span>
                              <FaArrowRight className="text-[9px]" />
                            </a>
                          </div>
                          
                          {alreadySubmitted ? (
                            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-bold text-emerald-700 text-center">
                              ยืนยันการทำข้อสอบเสร็จสิ้นแล้ว
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleGoogleFormSubmit(asm.id, asm.googleFormUrl || "")}
                              disabled={pendingId === asm.id}
                              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
                            >
                              {pendingId === asm.id ? "กำลังส่งข้อมูล..." : "ยืนยันว่าทำแบบฝึกหัดเสร็จแล้ว ✔"}
                            </button>
                          )}
                        </div>
                      ) : (
                        <form onSubmit={(e) => handleSubmit(asm.id, e)} className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">ส่งผลงาน</h4>

                          {/* แสดงไฟล์ที่ส่งไปแล้ว */}
                          {alreadySubmitted && asm.submission?.fileUrl ? (
                            <div className="space-y-2">
                              <p className="text-xs text-slate-500 font-semibold">ผลงานที่ส่ง:</p>
                              <a href={asm.submission.fileUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-sky-600 hover:bg-sky-50 hover:border-sky-200 transition group">
                                {isFileUrl(asm.submission.fileUrl) ? <FaFile className="shrink-0 text-sky-500" /> : <FaLink className="shrink-0 text-sky-500" />}
                                <span className="truncate flex-1">{isFileUrl(asm.submission.fileUrl) ? asm.submission.fileUrl.split("/").pop() : asm.submission.fileUrl}</span>
                                <FaExternalLinkAlt className="text-[9px] shrink-0 opacity-50 group-hover:opacity-100" />
                              </a>
                            </div>
                          ) : !alreadySubmitted ? (
                            <>
                              {/* Mode Tabs */}
                              <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-slate-50 p-0.5 gap-0.5">
                                <button type="button" onClick={() => setMode(asm.id, "link")}
                                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${mode === "link" ? "bg-white text-sky-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
                                  <FaLink className="text-[10px]" /> ส่งลิงก์
                                </button>
                                <button type="button" onClick={() => setMode(asm.id, "file")}
                                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${mode === "file" ? "bg-white text-sky-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
                                  <FaCloudUploadAlt className="text-[11px]" /> อัปโหลดไฟล์
                                </button>
                              </div>

                              {mode === "link" ? (
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <input type="url" required disabled={isSubmitting(asm.id)}
                                    value={linkValues[asm.id] || ""}
                                    onChange={(e) => setLinkValues(prev => ({ ...prev, [asm.id]: e.target.value }))}
                                    placeholder="https://drive.google.com/file/d/..."
                                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-sky-400 focus:bg-white transition w-full"
                                  />
                                  <button type="submit" disabled={isSubmitting(asm.id)}
                                    className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 transition whitespace-nowrap w-full sm:w-auto">
                                    <FaPaperPlane className="text-[10px]" /> ส่งงาน
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div
                                    onDragOver={(e) => { e.preventDefault(); setDragOver(prev => ({ ...prev, [asm.id]: true })); }}
                                    onDragLeave={() => setDragOver(prev => ({ ...prev, [asm.id]: false }))}
                                    onDrop={(e) => handleDrop(asm.id, e)}
                                    className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${dragOver[asm.id] ? "border-sky-400 bg-sky-50" : fileValues[asm.id] ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-sky-300 hover:bg-sky-50/50"}`}
                                    onClick={() => document.getElementById(`file-${asm.id}`)?.click()}
                                  >
                                    <input id={`file-${asm.id}`} type="file" className="hidden"
                                      onChange={(e) => setFileValues(prev => ({ ...prev, [asm.id]: e.target.files?.[0] ?? null }))} />
                                    {fileValues[asm.id] ? (
                                      <div className="space-y-1">
                                        <FaFile className="text-2xl text-emerald-500 mx-auto" />
                                        <p className="text-xs font-bold text-emerald-700 truncate">{fileValues[asm.id]!.name}</p>
                                        <p className="text-[10px] text-slate-400">{(fileValues[asm.id]!.size / 1024 / 1024).toFixed(2)} MB</p>
                                      </div>
                                    ) : (
                                      <div className="space-y-1">
                                        <FaCloudUploadAlt className="text-2xl text-slate-300 mx-auto" />
                                        <p className="text-xs text-slate-500 font-semibold">ลากวางไฟล์หรือคลิกเพื่อเลือก</p>
                                        <p className="text-[10px] text-slate-400">PDF, Word, รูปภาพ ฯลฯ (สูงสุด 50 MB)</p>
                                      </div>
                                    )}
                                  </div>
                                  <button type="submit" disabled={isSubmitting(asm.id) || !fileValues[asm.id]}
                                    className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 transition">
                                    {isSubmitting(asm.id) ? <span className="animate-pulse">กำลังอัปโหลด...</span> : <><FaCloudUploadAlt /> อัปโหลดและส่งงาน</>}
                                  </button>
                                </div>
                              )}
                            </>
                          ) : null}
                        </form>
                      )}
                    </div>

                    {/* RIGHT: สถานะ */}
                    <div className="p-5 bg-slate-50/50 space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">สถานะ</h4>

                      {!asm.submission ? (
                        <div className="flex items-center gap-2 text-amber-600 text-sm font-bold">
                          <FaExclamationCircle /> <span>ยังไม่ได้ส่งงาน</span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sky-600 text-sm font-bold">
                            <FaCheckCircle /> <span>ส่งผลงานแล้ว</span>
                          </div>
                          <p className="text-xs text-slate-500">
                            ส่งเมื่อ: <span className="font-semibold text-slate-700">{new Date(asm.submission.submittedAt).toLocaleString("th-TH")}</span>
                          </p>

                          {isGraded ? (
                            <div className="border-t border-slate-200 pt-3 space-y-2">
                              <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                                <FaCheckCircle /> <span>ครูตรวจแล้ว ✅</span>
                              </div>
                              {asm.submission.feedback && (
                                <div className="p-3 bg-white border border-emerald-100 rounded-xl text-xs leading-relaxed text-slate-600 flex gap-2">
                                  <FaCommentAlt className="text-emerald-400 mt-0.5 shrink-0" />
                                  <span>{asm.submission.feedback}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 bg-sky-100 text-sky-700 border border-sky-200 rounded-full font-bold">
                              <FaHourglassHalf className="text-[8px]" /> รอคุณครูตรวจ
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
