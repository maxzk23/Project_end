"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { getTeacherClassrooms } from "@/app/actions/classroom";
import { getAssignmentsWithSubmissions, createAssignment, updateAssignment, deleteAssignment } from "@/app/actions/teacher";
import CustomSelect from "@/components/ui/CustomSelect";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { 
  FaPlus, 
  FaCheckCircle, 
  FaExclamationCircle, 
  FaTimes, 
  FaTrash,
  FaEdit,
  FaFileAlt,
  FaLink,
  FaTasks,
  FaUsers
} from "react-icons/fa";

interface Classroom {
  id: string;
  name: string;
  yearLevel: string;
  room: string;
  academicYear: string;
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  maxPoints: number;
  isGoogleForm: boolean;
  googleFormUrl: string | null;
  dueDate: Date | null;
  createdAt: Date;
  submissions: any[];
}

export default function TeacherAssignmentsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // States สำหรับ Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createIsGoogleForm, setCreateIsGoogleForm] = useState(false);
  const [createYearLevel, setCreateYearLevel] = useState<string>("");
  const [createRoomId, setCreateRoomId] = useState<string>("");

  // States สำหรับ Edit Modal
  const [editTarget, setEditTarget] = useState<Assignment | null>(null);
  const [editIsGoogleForm, setEditIsGoogleForm] = useState(false);

  // States สำหรับ Delete Confirmation
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);

  const [isPending, startTransition] = useTransition();
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const fetchClasses = async () => {
      const classes = await getTeacherClassrooms();
      setClassrooms(classes);
      const savedClassId = localStorage.getItem("teacher-assignments-classId");
      if (savedClassId && (savedClassId === "ALL" || classes.some(c => c.id === savedClassId))) {
        setSelectedClassId(savedClassId);
      } else {
        setSelectedClassId("ALL");
      }
    };
    fetchClasses();
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

  // ซิงก์ข้อมูลอัปเดตแบบเรียลไทม์เมื่อมีการส่งการบ้าน หรือการแก้ไขข้อมูลจากที่อื่น
  useEffect(() => {
    const bc = new BroadcastChannel("lms-channel");
    bc.onmessage = (event) => {
      if (event.data?.type === "ASSIGNMENT_SUBMITTED" || event.data?.type === "ASSIGNMENT_CHANGED") {
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
    setAssignments(data as Assignment[]);
    if (!isSilent) setIsLoading(false);
  };

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    localStorage.setItem("teacher-assignments-classId", classId);
  };

  const showToast = (type: "success" | "error", text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // ── CREATE ──────────────────────────────────────────
  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const targetClassId = formData.get("targetClassId") as string || selectedClassId;

    if (!targetClassId || targetClassId === "ALL") {
      showToast("error", "กรุณาเลือกห้องเรียนเป้าหมายก่อนสั่งการบ้าน");
      return;
    }

    formData.set("isGoogleForm", createIsGoogleForm ? "true" : "false");

    startTransition(async () => {
      const res = await createAssignment(targetClassId, formData);
      if (res.success) {
        showToast("success", res.message || "มอบหมายงานสำเร็จ");
        setIsCreateOpen(false);
        setCreateIsGoogleForm(false);
        loadData();

        // ส่งข้อความแจ้งให้หน้านักเรียนดึงรายการการบ้านใหม่ทันที
        const bc = new BroadcastChannel("lms-channel");
        bc.postMessage({ type: "ASSIGNMENT_CHANGED" });
        bc.close();
      } else {
        showToast("error", res.error || "เกิดข้อผิดพลาด");
      }
    });
  };

  // ── UPDATE ──────────────────────────────────────────
  const openEdit = (asm: Assignment) => {
    setEditTarget(asm);
    setEditIsGoogleForm(asm.isGoogleForm);
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTarget) return;
    const formData = new FormData(e.currentTarget);
    formData.set("isGoogleForm", editIsGoogleForm ? "true" : "false");

    startTransition(async () => {
      const res = await updateAssignment(editTarget.id, formData);
      if (res.success) {
        showToast("success", res.message || "แก้ไขสำเร็จ");
        setEditTarget(null);
        loadData();

        // ส่งข้อความแจ้งให้หน้านักเรียนซิงก์ข้อมูลเรียลไทม์
        const bc = new BroadcastChannel("lms-channel");
        bc.postMessage({ type: "ASSIGNMENT_CHANGED" });
        bc.close();
      } else {
        showToast("error", res.error || "เกิดข้อผิดพลาด");
      }
    });
  };

  // ── DELETE ──────────────────────────────────────────
  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const res = await deleteAssignment(deleteTarget.id);
      if (res.success) {
        showToast("success", res.message || "ลบสำเร็จ");
        setDeleteTarget(null);
        loadData();

        // ส่งข้อความแจ้งให้หน้านักเรียนซิงก์ข้อมูลเรียลไทม์
        const bc = new BroadcastChannel("lms-channel");
        bc.postMessage({ type: "ASSIGNMENT_CHANGED" });
        bc.close();
      } else {
        showToast("error", res.error || "ไม่สามารถลบได้");
      }
    });
  };

  return (
    <div className="space-y-8">

      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-5 right-5 z-[99999] px-5 py-4 rounded-2xl shadow-2xl border flex items-center gap-3.5 animate-in slide-in-from-top-4 duration-300 ${
          toastMsg.type === "success" 
            ? "bg-emerald-600 text-white border-emerald-400 dark:bg-[#064e3b] dark:border-emerald-400 dark:text-emerald-50 shadow-emerald-950/50" 
            : "bg-rose-600 text-white border-rose-400 dark:bg-[#881337] dark:border-rose-400 dark:text-rose-50 shadow-rose-950/50"
        }`}>
          {toastMsg.type === "success" ? (
            <FaCheckCircle className="text-xl text-emerald-200 dark:text-emerald-300 shrink-0" />
          ) : (
            <FaExclamationCircle className="text-xl text-rose-200 dark:text-rose-300 shrink-0" />
          )}
          <span className="text-sm font-bold text-white dark:text-emerald-50 tracking-wide">{toastMsg.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FaTasks className="text-sky-500" /> การมอบหมายงานการบ้าน
          </h1>
          <p className="text-sm text-slate-500 mt-1">สร้าง แก้ไข และจัดการใบงานกิจกรรมสำหรับห้องเรียน</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
          <CustomSelect
            options={[
              { value: "ALL", label: "ดูทั้งหมด (ทุกห้องเรียน)" },
              ...classrooms.map((cls) => ({
                value: cls.id,
                label: `${cls.name} (${cls.yearLevel}/${cls.room})`
              }))
            ]}
            value={selectedClassId}
            onChange={(val) => handleClassChange(val)}
            accentColor="blue"
          />

          <button
            onClick={() => {
              const defaultCls = classrooms.find(c => c.id === selectedClassId);
              if (defaultCls) {
                setCreateYearLevel(defaultCls.yearLevel);
                setCreateRoomId(defaultCls.id);
              } else {
                setCreateYearLevel("");
                setCreateRoomId("");
              }
              setIsCreateOpen(true); 
              setCreateIsGoogleForm(false); 
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl transition text-sm shadow-md"
          >
            <FaPlus />
            <span>สั่งการบ้านใหม่</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {classrooms.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border text-center text-slate-500">
          <FaExclamationCircle className="text-5xl mx-auto text-amber-400 mb-4" />
          <p className="text-lg font-bold">ไม่พบห้องเรียนของคุณครู</p>
          <p className="text-sm opacity-70 mt-1">กรุณาสร้างห้องเรียนก่อนสั่งการบ้านครับ</p>
        </div>
      ) : isLoading ? (
        <div className="py-16 text-center text-slate-400 font-medium animate-pulse">กำลังโหลดข้อมูลใบงาน...</div>
      ) : assignments.length === 0 ? (
        <div className="bg-white p-14 rounded-2xl border text-center text-slate-400 space-y-3">
          <FaTasks className="text-6xl mx-auto text-slate-200" />
          <p className="text-lg font-bold text-slate-600">ยังไม่มีการมอบหมายงานในวิชานี้</p>
          <p className="text-sm">กด "สั่งการบ้านใหม่" เพื่อเริ่มสร้างใบงานได้เลยครับ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {assignments.map((asm) => (
            <div
              key={asm.id}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-5 hover:border-sky-200 hover:shadow-md transition-all duration-200"
            >
              {/* Info */}
              <div className="space-y-2 min-w-0 flex-1 w-full">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${asm.isGoogleForm ? "bg-purple-100 text-purple-600" : "bg-sky-100 text-sky-600"}`}>
                    {asm.isGoogleForm ? <FaLink /> : <FaFileAlt />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-800 leading-tight truncate">{asm.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                      {asm.description || "ไม่มีรายละเอียดเพิ่มเติม"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pl-12">
                  {asm.isGoogleForm ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 text-[10px] font-bold rounded-full">
                      <FaLink className="text-[8px]" /> Google Forms
                    </span>
                  ) : (
                    <span className="inline-block px-2.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-100 text-[10px] font-bold rounded-full">
                      ส่งลิงก์ / ไฟล์
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                    <FaUsers className="text-[9px]" />
                    ส่งงานแล้ว {asm.submissions?.length || 0} คน
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-auto w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0">
                {asm.isGoogleForm && asm.googleFormUrl && (
                  <a
                    href={asm.googleFormUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-xl border border-slate-200 flex items-center gap-1.5 transition"
                  >
                    <FaLink className="text-[10px]" /> เปิดฟอร์ม
                  </a>
                )}
                <button
                  onClick={() => openEdit(asm)}
                  className="p-2.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl border border-amber-200 transition hover:scale-105"
                  title="แก้ไข"
                >
                  <FaEdit className="text-sm" />
                </button>
                <button
                  onClick={() => setDeleteTarget(asm)}
                  className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl border border-rose-200 transition hover:scale-105"
                  title="ลบ"
                >
                  <FaTrash className="text-sm" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL: CREATE ─────────────────────────────── */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center text-xs"><FaPlus /></span>
                สั่งการบ้านใหม่
              </h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600 transition">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="space-y-1.5 flex-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">ชั้นปี *</label>
                  <select
                    value={createYearLevel}
                    onChange={(e) => {
                      setCreateYearLevel(e.target.value);
                      setCreateRoomId("");
                    }}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none cursor-pointer focus:border-sky-400 focus:bg-white transition text-slate-700 font-semibold"
                  >
                    <option value="" disabled>-- เลือกชั้นปี --</option>
                    {Array.from(new Set(classrooms.map(c => c.yearLevel))).sort().map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1.5 flex-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">ห้องเรียนเป้าหมาย *</label>
                  <select
                    name="targetClassId"
                    value={createRoomId}
                    onChange={(e) => setCreateRoomId(e.target.value)}
                    required
                    disabled={!createYearLevel}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none cursor-pointer focus:border-sky-400 focus:bg-white transition text-slate-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="" disabled>-- เลือกห้องเรียน --</option>
                    {classrooms.filter(c => c.yearLevel === createYearLevel).map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} ({cls.room})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">หัวข้อเรื่อง *</label>
                <input
                  type="text" name="title" required
                  placeholder="เช่น ใบงานที่ 1: อัลกอริทึม"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-400 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">คำอธิบาย</label>
                <textarea
                  name="description" rows={3}
                  placeholder="เช่น อธิบายความเข้าใจเรื่องตัวแปรพร้อมยกตัวอย่าง..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-400 focus:bg-white transition resize-none"
                />
              </div>

              <input type="hidden" name="maxPoints" value="10" />

              <div className="space-y-3 pt-1 border-t border-slate-100">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <div className={`relative w-10 h-5 rounded-full transition-colors ${createIsGoogleForm ? "bg-purple-500" : "bg-slate-300"}`}
                    onClick={() => setCreateIsGoogleForm(v => !v)}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${createIsGoogleForm ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                  <span className="text-xs font-bold text-slate-700">ใช้แบบทดสอบ Google Forms</span>
                </label>

                {createIsGoogleForm && (
                  <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-150">
                    <label className="text-xs font-bold text-slate-600">ลิงก์ Google Forms URL</label>
                    <input
                      type="url" name="googleFormUrl" required
                      placeholder="https://docs.google.com/forms/d/..."
                      className="w-full px-3.5 py-2.5 bg-purple-50 border border-purple-200 rounded-xl text-sm focus:outline-none focus:border-purple-400 transition"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold transition">
                  ยกเลิก
                </button>
                <button type="submit" disabled={isPending}
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs shadow-md disabled:opacity-50 transition">
                  {isPending ? "กำลังบันทึก..." : "ยืนยันสั่งการบ้าน"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT ───────────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center text-xs"><FaEdit /></span>
                แก้ไขการบ้าน
              </h2>
              <button onClick={() => setEditTarget(null)} className="text-slate-400 hover:text-slate-600 transition">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">หัวข้อเรื่อง *</label>
                <input
                  type="text" name="title" required
                  defaultValue={editTarget.title}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">คำอธิบาย</label>
                <textarea
                  name="description" rows={3}
                  defaultValue={editTarget.description || ""}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 focus:bg-white transition resize-none"
                />
              </div>

              <div className="space-y-3 pt-1 border-t border-slate-100">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <div className={`relative w-10 h-5 rounded-full transition-colors ${editIsGoogleForm ? "bg-purple-500" : "bg-slate-300"}`}
                    onClick={() => setEditIsGoogleForm(v => !v)}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${editIsGoogleForm ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                  <span className="text-xs font-bold text-slate-700">ใช้แบบทดสอบ Google Forms</span>
                </label>

                {editIsGoogleForm && (
                  <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-150">
                    <label className="text-xs font-bold text-slate-600">ลิงก์ Google Forms URL</label>
                    <input
                      type="url" name="googleFormUrl"
                      defaultValue={editTarget.googleFormUrl || ""}
                      placeholder="https://docs.google.com/forms/d/..."
                      className="w-full px-3.5 py-2.5 bg-purple-50 border border-purple-200 rounded-xl text-sm focus:outline-none focus:border-purple-400 transition"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setEditTarget(null)}
                  className="px-4 py-2 text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold transition">
                  ยกเลิก
                </button>
                <button type="submit" disabled={isPending}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs shadow-md disabled:opacity-50 transition">
                  {isPending ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: DELETE ─────────────────────────────── */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="ยืนยันการลบการบ้าน?"
        description={deleteTarget ? `การลบการบ้าน "${deleteTarget.title}" จะเป็นการลบถาวร นักเรียนจะไม่สามารถมองเห็นหรือส่งงานนี้ได้อีกต่อไป` : "การลบจะเป็นการถาวร"}
        confirmText="ลบอย่างถาวร"
        cancelText="ยกเลิก"
        variant="danger"
        isLoading={isPending}
      />

    </div>
  );
}
