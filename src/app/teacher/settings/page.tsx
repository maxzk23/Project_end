"use client";

import { useEffect, useState, useTransition } from "react";
import { 
  getRolloverLogs, 
  executeAcademicRollover, 
  getRolloverStudents, 
  exportSystemBackup, 
  resetDatabaseSeed,
  restoreSystemFromBackup
} from "@/app/actions/teacher";
import { getTeacherClassrooms } from "@/app/actions/classroom";
import { 
  FaCog, 
  FaSync, 
  FaHistory, 
  FaCheckCircle, 
  FaExclamationCircle, 
  FaDatabase,
  FaChevronRight,
  FaChevronLeft,
  FaFileExport,
  FaTrashAlt,
  FaSearch,
  FaFilter,
  FaUsersSlash,
  FaShieldAlt,
  FaCheck,
  FaGraduationCap
} from "react-icons/fa";

interface Classroom {
  id: string;
  name: string;
  yearLevel: string;
  room: string;
}

interface RolloverStudent {
  id: string;
  name: string;
  studentId: string | null;
  avatarUrl: string | null;
  status: string;
  yearLevel: string;
  room: string;
  classroomId: string;
}

interface RolloverLog {
  id: string;
  fromYear: string;
  toYear: string;
  retainedCount: number;
  graduatedCount: number;
  promotedCount: number;
  executedAt: Date;
  executor: {
    name: string;
  };
}

export default function TeacherSettingsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [logs, setLogs] = useState<RolloverLog[]>([]);
  const [isPending, startTransition] = useTransition();

  // Wizard state: 1 = Backup, 2 = Select Retained, 3 = Confirm/Security, 4 = Success Result
  const [step, setStep] = useState<number>(1);
  const [backupDownloaded, setBackupDownloaded] = useState<boolean>(false);
  const [confirmBackupChecked, setConfirmBackupChecked] = useState<boolean>(false);
  const [step1Error, setStep1Error] = useState<boolean>(false);

  // Filter & List state for Step 2
  const [students, setStudents] = useState<RolloverStudent[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState<boolean>(false);
  const [studentSearch, setStudentSearch] = useState<string>(" ");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [roomFilter, setRoomFilter] = useState<string>("all");

  // Selected retained students
  const [retainedStudentIds, setRetainedStudentIds] = useState<string[]>([]);

  // Security phrase validation
  const [securityInput, setSecurityInput] = useState<string>("");
  const [isSecurityValid, setIsSecurityValid] = useState<boolean>(false);

  const [fromYear, setFromYear] = useState<string>("2568");
  const [toYear, setToYear] = useState<string>("2569");

  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    // โหลดห้องเรียนและประวัติการย้ายชั้นเรียนย้อนหลัง
    const initData = async () => {
      const classes = await getTeacherClassrooms();
      setClassrooms(classes);
      
      const rolloverLogs = await getRolloverLogs();
      setLogs(rolloverLogs as unknown as RolloverLog[]);
    };
    initData();
  }, []);

  // โหลดนักเรียนเมื่อเปลี่ยนเทอม/ปีการศึกษาเดิม
  useEffect(() => {
    if (step === 2) {
      loadRolloverStudentsList();
    }
  }, [step, fromYear]);

  const loadRolloverStudentsList = async () => {
    setIsLoadingStudents(true);
    try {
      const data = await getRolloverStudents(fromYear);
      setStudents(data as RolloverStudent[]);
    } catch (e) {
      console.error("Failed to load students for rollover", e);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const showToast = (type: "success" | "error", text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // ดาวน์โหลดสำรองข้อมูลระบบ
  const handleDownloadBackup = async () => {
    try {
      const res = await exportSystemBackup();
      if ("error" in res) {
        showToast("error", res.error || "เกิดข้อผิดพลาดในการสำรองข้อมูล");
        return;
      }
      
      const jsonStr = JSON.stringify(res.data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = `lms_backup_year_${fromYear}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBackupDownloaded(true);
      showToast("success", "ดาวน์โหลดไฟล์สำรองข้อมูล (.json) เรียบร้อยแล้ว");
      setStep1Error(false);
    } catch (e) {
      showToast("error", "เกิดข้อผิดพลาดในการดาวน์โหลดสำรองข้อมูล");
    }
  };

  // รีเซ็ตฐานข้อมูลเริ่มต้นของโรงเรียนสำหรับทดสอบเดโม่ใหม่
  const handleResetDatabaseSeed = async () => {
    if (window.confirm("⚠️ คุณครูแน่ใจใช่ไหมว่าต้องการล้างข้อมูลเพื่อเริ่มปี 2568 ใหม่?\n(การดำเนินการนี้จะรีเซ็ตห้องเรียนและนักเรียนต้นแบบทั้งหมดเข้าสู่สภาวะเริ่มต้นเดโม่)")) {
      startTransition(async () => {
        const res = await resetDatabaseSeed();
        if (res.success) {
          showToast("success", res.message || "รีเซ็ตฐานข้อมูลสำเร็จ");
          setTimeout(() => window.location.reload(), 1500);
        } else {
          showToast("error", res.error || "เกิดข้อผิดพลาด");
        }
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setRestoreFile(e.target.files[0]);
    }
  };

  const handleRestoreBackup = async () => {
    if (!restoreFile) return;

    const confirmRestore = window.confirm("⚠️ คำเตือน: การกู้คืนข้อมูลจะทำการลบข้อมูลทั้งหมดในระบบปัจจุบันและแทนที่ด้วยข้อมูลจากไฟล์สำรอง คุณต้องการดำเนินการต่อหรือไม่?");
    if (!confirmRestore) return;

    setIsRestoring(true);
    try {
      const fileReader = new FileReader();
      fileReader.onload = async (event) => {
        try {
          const jsonText = event.target?.result as string;
          const parsed = JSON.parse(jsonText);
          const backupData = parsed.data || parsed;

          startTransition(async () => {
            const res = await restoreSystemFromBackup(backupData);
            setIsRestoring(false);
            if (res.success) {
              setRestoreFile(null);
              const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
              if (fileInput) fileInput.value = "";
              showToast("success", res.message || "กู้คืนระบบสำเร็จ");
              setTimeout(() => window.location.reload(), 1500);
            } else {
              showToast("error", res.error || "เกิดข้อผิดพลาดในการกู้คืนข้อมูล");
            }
          });
        } catch (parseErr) {
          setIsRestoring(false);
          showToast("error", "ไฟล์ข้อมูลไม่ถูกต้องตามรูปแบบ JSON");
        }
      };
      fileReader.readAsText(restoreFile);
    } catch (err) {
      setIsRestoring(false);
      showToast("error", "ไม่สามารถอ่านไฟล์สำรองได้");
    }
  };

  // ติ๊กเลือก/ไม่เลือก นักเรียนซ้ำชั้น
  const handleRetainToggle = (studentId: string) => {
    setRetainedStudentIds(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId) 
        : [...prev, studentId]
    );
  };

  // ตรวจจับ Security Phrase
  const targetSecurityPhrase = `CONFIRM ROLLOVER ${toYear}`;
  useEffect(() => {
    setIsSecurityValid(securityInput.trim() === targetSecurityPhrase);
  }, [securityInput, toYear]);

  // ประมวลผลและยืนยันการขึ้นปีการศึกษา (Execute Rollover)
  const handleExecuteRollover = () => {
    if (!isSecurityValid) return;

    startTransition(async () => {
      try {
        const res = await executeAcademicRollover(fromYear, toYear, retainedStudentIds);
        if (res.success) {
          showToast("success", res.message || "ปิดปีการศึกษาสำเร็จ");
          setStep(4); // ไปหน้าจอเสร็จสมบูรณ์
          
          // โหลดประวัติความเคลื่อนไหวล็อกใหม่
          const rolloverLogs = await getRolloverLogs();
          setLogs(rolloverLogs as unknown as RolloverLog[]);
        } else {
          showToast("error", res.error || "เกิดข้อผิดพลาดในการทำรายการ");
        }
      } catch (e) {
        showToast("error", "การสื่อสารกับฐานข้อมูลล้มเหลว");
      }
    });
  };

  // ล้างค่าสถานะและรีสตาร์ตวิซาร์ดกลับไปขั้นตอนที่ 1
  const handleResetWizard = () => {
    setStep(1);
    setBackupDownloaded(false);
    setConfirmBackupChecked(false);
    setRetainedStudentIds([]);
    setSecurityInput("");
    setStudentSearch(" ");
    setClassFilter("all");
    setRoomFilter("all");
  };

  // ดึงสีกำหนดสำหรับ Initial Avatar
  const getInitialsStyle = (name: string) => {
    const colors = [
      { bg: "rgba(14, 165, 233, 0.12)", text: "#0284c7", border: "rgba(14, 165, 233, 0.2)" },
      { bg: "rgba(16, 185, 129, 0.12)", text: "#059669", border: "rgba(16, 185, 129, 0.2)" },
      { bg: "rgba(139, 92, 246, 0.12)", text: "#7c3aed", border: "rgba(139, 92, 246, 0.2)" },
      { bg: "rgba(245, 158, 11, 0.12)", text: "#d97706", border: "rgba(245, 158, 11, 0.2)" },
      { bg: "rgba(236, 72, 153, 0.12)", text: "#db2777", border: "rgba(236, 72, 153, 0.2)" }
    ];
    const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // จัดกรองกรองนักเรียนในขั้นตอนที่ 2
  const filteredStudents = students.filter(s => {
    const classVal = classFilter === "all" ? "" : classFilter === "m1" ? "ม.1" : classFilter === "m2" ? "ม.2" : "ม.3";
    if (classVal && s.yearLevel !== classVal) return false;
    if (roomFilter !== "all" && s.room !== roomFilter) return false;
    if (studentSearch.trim()) {
      const q = studentSearch.toLowerCase().trim();
      const matchName = s.name.toLowerCase().includes(q);
      const matchId = (s.studentId || "").toLowerCase().includes(q);
      return matchName || matchId;
    }
    return true;
  });

  // คำนวณสรุปสถิตินักเรียนสำหรับขั้นตอนที่ 3
  const getSummaryCounts = () => {
    let promoted = 0;
    let graduated = 0;
    let retained = retainedStudentIds.length;

    students.forEach(s => {
      const isRetained = retainedStudentIds.includes(s.id);
      if (!isRetained) {
        if (s.yearLevel.includes("3") || s.yearLevel.toLowerCase().includes("m3")) {
          graduated++;
        } else {
          promoted++;
        }
      }
    });

    return { promoted, graduated, retained };
  };

  const summary = getSummaryCounts();

  return (
    <div className="space-y-8 text-left font-sans">
      
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

      {/* ส่วนหัวหน้าเว็บ */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <FaCog className="text-slate-600" /> ตั้งค่าระบบและการจัดการปีการศึกษา
        </h1>
        <p className="text-sm text-slate-500 mt-1 font-medium">ประมวลผลเลื่อนชั้นเรียน ปรับฐานข้อมูลประวัตินักเรียน และปิดปีการศึกษา (Academic Year Rollover)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* === ส่วนซ้าย: Wizard UI ปิดปีการศึกษาแบบเดโม่ 100% === */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            
            {/* Step Indicators */}
            {step <= 3 && (
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between bg-slate-50 p-4.5 rounded-2xl border border-slate-150 gap-4 select-none">
                
                {/* Step 1 Indicator */}
                <div className={`flex items-center gap-2.5 transition ${step === 1 ? "text-sky-600 font-bold" : step > 1 ? "text-emerald-600 font-bold" : "text-slate-400 font-medium"}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border transition ${step === 1 ? "bg-sky-500 text-white border-sky-600 animate-pulse" : step > 1 ? "bg-emerald-500 text-white border-emerald-600" : "bg-slate-200 text-slate-500 border-slate-350"}`}>
                    1
                  </span>
                  <span className="text-xs">สำรองข้อมูล</span>
                </div>

                <div className="hidden md:block flex-1 border-t-2 border-dashed border-slate-200 mx-4"></div>

                {/* Step 2 Indicator */}
                <div className={`flex items-center gap-2.5 transition ${step === 2 ? "text-sky-600 font-bold" : step > 2 ? "text-emerald-600 font-bold" : "text-slate-400 font-medium"}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border transition ${step === 2 ? "bg-sky-500 text-white border-sky-600 animate-pulse" : step > 2 ? "bg-emerald-500 text-white border-emerald-600" : "bg-slate-200 text-slate-500 border-slate-350"}`}>
                    2
                  </span>
                  <span className="text-xs">คัดกรองซ้ำชั้น</span>
                </div>

                <div className="hidden md:block flex-1 border-t-2 border-dashed border-slate-200 mx-4"></div>

                {/* Step 3 Indicator */}
                <div className={`flex items-center gap-2.5 transition ${step === 3 ? "text-sky-600 font-bold" : "text-slate-400 font-medium"}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border transition ${step === 3 ? "bg-sky-500 text-white border-sky-600 animate-pulse" : "bg-slate-200 text-slate-500 border-slate-350"}`}>
                    3
                  </span>
                  <span className="text-xs">ยืนยันข้อมูล</span>
                </div>

              </div>
            )}

            {/* === STEP 1 PANEL === */}
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {step1Error && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-xs font-bold flex items-start gap-2.5">
                    <FaExclamationCircle className="text-base shrink-0 mt-0.5" />
                    <div>
                      <strong>เกิดข้อผิดพลาด:</strong> คุณต้องดาวน์โหลดไฟล์สำรองข้อมูล และทำเครื่องหมายยืนยันข้อความด้านล่างก่อนจึงจะดำเนินการต่อได้
                    </div>
                  </div>
                )}

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-4">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <FaDatabase className="text-sky-500" /> ขั้นตอนที่ 1: สำรองข้อมูลและบันทึกประวัติ (Backup & Archive)
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    ก่อนเริ่มกระบวนการเลื่อนปีการศึกษา กรุณาดาวน์โหลดสำรองข้อมูลฐานข้อมูลปัจจุบันเก็บไว้ เพื่อความปลอดภัยและเพื่อใช้เป็นข้อมูล Snapshot สำหรับกู้คืนระบบกลับสู่ปกติในอนาคตหากต้องการยกเลิก
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ปีการศึกษาปัจจุบันที่ใช้งาน</label>
                      <input 
                        type="text" 
                        value={fromYear}
                        onChange={(e) => setFromYear(e.target.value)}
                        className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ปีการศึกษาเป้าหมายถัดไป</label>
                      <input 
                        type="text" 
                        value={toYear}
                        onChange={(e) => setToYear(e.target.value)}
                        className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleDownloadBackup}
                    className="flex items-center gap-2.5 px-4 py-2.5 bg-sky-50 border border-sky-200 hover:bg-sky-100/70 text-sky-700 font-bold rounded-xl text-xs transition"
                  >
                    <FaFileExport />
                    <span>ดาวน์โหลดไฟล์สำรองข้อมูล (.json)</span>
                  </button>
                </div>

                <div>
                  <label className="flex items-center gap-3 text-xs font-bold text-slate-700 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={confirmBackupChecked}
                      onChange={(e) => setConfirmBackupChecked(e.target.checked)}
                      className="w-4.5 h-4.5 border-slate-300 rounded cursor-pointer accent-sky-500"
                    />
                    <span>ข้าพเจ้ายืนยันว่าได้ดาวน์โหลดไฟล์สำรองข้อมูลล่าสุดเรียบร้อยแล้ว</span>
                  </label>
                </div>

                {/* ส่วนการกู้คืนข้อมูล (Restore Backup) */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2.5 text-slate-800 font-bold text-xs">
                    <FaDatabase className="text-sky-500" />
                    <span>กู้คืนระบบจากไฟล์สำรองข้อมูล (.json)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    หากคุณเคยกดล้างระบบหรือเปลี่ยนฐานข้อมูลทดสอบ คุณสามารถกู้คืนห้องเรียน นักเรียน ใบงาน และประวัติทั้งหมดกลับคืนมาโดยอัปโหลดไฟล์สำรองล่าสุดที่ดาวน์โหลดไว้
                  </p>
                  
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                    <input 
                      type="file"
                      accept=".json"
                      onChange={handleFileChange}
                      className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer"
                    />
                    {restoreFile && (
                      <button
                        onClick={handleRestoreBackup}
                        disabled={isPending || isRestoring}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition disabled:opacity-50 shrink-0"
                      >
                        {isRestoring ? (
                          <>
                            <FaSync className="animate-spin" />
                            <span>กำลังกู้คืน...</span>
                          </>
                        ) : (
                          <>
                            <FaCheck />
                            <span>กู้คืนข้อมูลทันที</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <button
                    onClick={handleResetDatabaseSeed}
                    disabled={isPending}
                    className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-4.5 py-2.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition disabled:opacity-50"
                  >
                    <FaTrashAlt />
                    <span>ล้างฐานข้อมูลจำลอง (เริ่มปี 2568 ใหม่)</span>
                  </button>

                  <button
                    onClick={() => {
                      if (!backupDownloaded || !confirmBackupChecked) {
                        setStep1Error(true);
                      } else {
                        setStep(2);
                      }
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5.5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs transition"
                  >
                    <span>ขั้นตอนถัดไป</span>
                    <FaChevronRight />
                  </button>
                </div>
              </div>
            )}

            {/* === STEP 2 PANEL === */}
            {step === 2 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-3">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <FaUsersSlash className="text-amber-500" /> ขั้นตอนที่ 2: คัดกรองนักเรียนซ้ำชั้น (Retained Students Selection)
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    กรุณาทำเครื่องหมายถูกหน้ารายชื่อนักเรียนที่จำเป็นต้อง <strong>"ซ้ำชั้น"</strong> เพื่อเก็บประวัติการลงทะเบียนในระดับปีการศึกษาเดิมของปีหน้า ส่วนนักเรียนคนอื่นจะได้รับเลื่อนชั้นปีขึ้น 1 ขั้นอัตโนมัติ (ม.1 ➡️ ม.2, ม.2 ➡️ ม.3) และนักเรียนชั้น ม.3 จะสำเร็จการศึกษา (GRADUATED)
                  </p>

                  {/* คัดกรองและสืบค้น */}
                  <div className="flex flex-col md:flex-row gap-3 pt-2">
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                        <FaSearch className="text-xs" />
                      </span>
                      <input 
                        type="text"
                        value={studentSearch === " " ? "" : studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="ค้นหาชื่อนักเรียน หรือรหัส..."
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition"
                      />
                    </div>

                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-slate-400 pointer-events-none">
                        <FaFilter className="text-xs" />
                      </span>
                      <select
                        value={classFilter}
                        onChange={(e) => setClassFilter(e.target.value)}
                        className="pl-8 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer text-slate-700 appearance-none select-none"
                      >
                        <option value="all">ทุกระดับชั้น</option>
                        <option value="m1">มัธยมศึกษาปีที่ 1 (ม.1)</option>
                        <option value="m2">มัธยมศึกษาปีที่ 2 (ม.2)</option>
                        <option value="m3">มัธยมศึกษาปีที่ 3 (ม.3)</option>
                      </select>
                    </div>

                    <div className="relative flex items-center">
                      <select
                        value={roomFilter}
                        onChange={(e) => setRoomFilter(e.target.value)}
                        className="px-4.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer text-slate-700 appearance-none select-none"
                      >
                        <option value="all">ทุกห้องเรียน</option>
                        <option value="1">ห้อง 1</option>
                        <option value="2">ห้อง 2</option>
                        <option value="3">ห้อง 3</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* รายการนักเรียน */}
                {isLoadingStudents ? (
                  <p className="text-xs text-slate-400 text-center py-6 font-bold">กำลังโหลดรายชื่อนักเรียนในระบบ...</p>
                ) : filteredStudents.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">ไม่พบข้อมูลรายชื่อนักเรียนตามตัวกรอง</p>
                ) : (
                  <div className="max-h-[380px] overflow-y-auto border border-slate-100 rounded-2xl bg-slate-50 p-2.5 space-y-2">
                    {filteredStudents.map((s) => {
                      const isChecked = retainedStudentIds.includes(s.id);
                      const initialStyle = getInitialsStyle(s.name);
                      return (
                        <div
                          key={s.id}
                          onClick={() => handleRetainToggle(s.id)}
                          className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition select-none ${
                            isChecked 
                              ? "bg-amber-50/50 border-amber-300 shadow-sm" 
                              : "bg-white border-slate-200 hover:border-slate-350 shadow-sm"
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            {/* Checkbox */}
                            <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-all ${
                              isChecked ? "bg-amber-500 border-amber-600 text-white" : "border-slate-300 bg-transparent"
                            }`}>
                              {isChecked && <FaCheck className="text-[10px]" />}
                            </div>

                            {/* Avatar */}
                            <div 
                              style={{ backgroundColor: initialStyle.bg, color: initialStyle.text, borderColor: initialStyle.border }}
                              className="w-9 h-9 rounded-full border flex items-center justify-center font-bold text-xs shrink-0"
                            >
                              {s.name.charAt(0)}
                            </div>

                            {/* Detail */}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-800">{s.name}</span>
                                <span className="text-[10px] font-black text-slate-400 bg-slate-100 border px-1.5 py-0.5 rounded-full">
                                  {s.yearLevel}/{s.room}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5">รหัส: {s.studentId || "-"}</p>
                            </div>
                          </div>

                          {/* Badge */}
                          <div>
                            {isChecked ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                                ซ้ำชั้น (Retained)
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                                เลื่อนชั้น (Promote)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* แถบสรุปชื่อเด็กที่จะซ้ำชั้น */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 block">
                    รายชื่อนักเรียนซ้ำชั้นเรียนที่จะเก็บตัวไว้ในปีการศึกษาเดิม ({retainedStudentIds.length} คน):
                  </label>
                  <div className="flex flex-wrap gap-2 p-3 bg-sky-50/20 border border-dashed border-slate-200 rounded-xl min-h-12 items-center">
                    {retainedStudentIds.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">ไม่มีการเลือกนักเรียนซ้ำชั้นเรียน (เลื่อนชั้นปีให้ทุกคนเป็นปกติ)</span>
                    ) : (
                      retainedStudentIds.map(id => {
                        const name = students.find(s => s.id === id)?.name || "";
                        return (
                          <span 
                            key={id} 
                            onClick={(e) => { e.stopPropagation(); handleRetainToggle(id); }}
                            className="bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200 text-[10px] font-bold px-2.5 py-1 rounded-full cursor-pointer transition select-none flex items-center gap-1.5"
                          >
                            <span>{name}</span>
                            <span className="text-[9px] font-black opacity-60">✕</span>
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-between">
                  <button
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1.5 px-4.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs transition"
                  >
                    <FaChevronLeft />
                    <span>ย้อนกลับ</span>
                  </button>

                  <button
                    onClick={() => setStep(3)}
                    className="flex items-center gap-1.5 px-5.5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs transition"
                  >
                    <span>ขั้นตอนถัดไป</span>
                    <FaChevronRight />
                  </button>
                </div>
              </div>
            )}

            {/* === STEP 3 PANEL === */}
            {step === 3 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-4">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <FaShieldAlt className="text-rose-500" /> ขั้นตอนที่ 3: ยืนยันความปลอดภัยและเริ่มดำเนินการ (Confirm & Execute)
                  </h4>

                  {/* Summary grid */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-white border rounded-xl p-3 shadow-sm">
                      <span className="text-xl font-black text-sky-600 font-mono">{summary.promoted}</span>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">เลื่อนระดับชั้นเรียน</p>
                    </div>
                    <div className="bg-white border rounded-xl p-3 shadow-sm">
                      <span className="text-xl font-black text-emerald-600 font-mono">{summary.graduated}</span>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">สำเร็จการศึกษา</p>
                    </div>
                    <div className="bg-white border rounded-xl p-3 shadow-sm">
                      <span className="text-xl font-black text-amber-600 font-mono">{summary.retained}</span>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">ซ้ำชั้นเรียนเดิม</p>
                    </div>
                  </div>

                  <p className="text-xs text-rose-600 font-bold leading-relaxed">
                    ⚠️ คำเตือน: การยืนยันเปลี่ยนผ่านปีการศึกษาจะไม่สามารถกดยกเลิกกลางคันได้ ข้อมูลนักเรียนและห้องเรียนจะถูกดัดแปลงและจัดเก็บเข้าคลังข้อมูลประวัติทันที
                  </p>

                  <div className="space-y-2 pt-2 border-t border-slate-155">
                    <label className="text-xs font-bold text-slate-700 block">กรุณาพิมพ์ข้อความเพื่อยืนยันความปลอดภัย:</label>
                    
                    <div className="font-mono text-xs bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-xl inline-block font-black tracking-wide select-none">
                      {targetSecurityPhrase}
                    </div>

                    <input 
                      type="text"
                      value={securityInput}
                      onChange={(e) => setSecurityInput(e.target.value)}
                      disabled={isPending}
                      placeholder="พิมพ์ข้อความยืนยันด้านบนเพื่อปลดล็อก..."
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-between">
                  <button
                    onClick={() => setStep(2)}
                    disabled={isPending}
                    className="flex items-center gap-1.5 px-4.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs transition disabled:opacity-50"
                  >
                    <FaChevronLeft />
                    <span>ย้อนกลับ</span>
                  </button>

                  <button
                    onClick={handleExecuteRollover}
                    disabled={!isSecurityValid || isPending}
                    className="flex items-center gap-2 px-5.5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-200 text-white font-bold rounded-xl text-xs transition shadow-sm disabled:cursor-not-allowed"
                  >
                    {isPending ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin shrink-0"></span>
                        <span>กำลังดำเนินการ...</span>
                      </>
                    ) : (
                      <>
                        <FaGraduationCap className="text-base" />
                        <span>เริ่มทำรายการเลื่อนชั้นปี</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* === POST-ROLLOVER SUCCESS CARD (STEP 4) === */}
            {step === 4 && (
              <div className="space-y-6 text-center py-6 animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500 border border-emerald-100 text-3xl">
                  🎉
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">ทำรายการขึ้นปีการศึกษา {toYear} สำเร็จแล้ว!</h3>
                  <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed font-semibold">
                    ระบบได้ทำการเลื่อนห้องเรียนอัตโนมัติ, สมัครทะเบียนเรียนใหม่ของนักเรียน, บันทึกสถานะผู้สำเร็จการศึกษา และเริ่มจัดเตรียมคะแนนลีดเดอร์บอร์ดเริ่มต้นใหม่เสร็จสมบูรณ์เรียบร้อยแล้ว
                  </p>
                </div>

                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={handleResetWizard}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                  >
                    ทำรายการใหม่อีกครั้ง
                  </button>

                  <a
                    href="/teacher/classrooms"
                    className="px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5"
                  >
                    <span>ดูรายชื่อห้องเรียนใหม่</span>
                    <FaChevronRight className="text-[10px]" />
                  </a>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* === ส่วนขวา: ประวัติย้อนหลัง (History logs) === */}
        <div className="space-y-6 text-left">
          
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FaHistory className="text-slate-500" /> ประวัติการประมวลผลย้อนหลัง
            </h3>

            {logs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">ยังไม่เคยมีบันทึกประวัติการปิดปีการศึกษา</p>
            ) : (
              <div className="space-y-3.5 max-h-[400px] overflow-y-auto pr-1">
                {logs.map((log) => (
                  <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-150 text-xs space-y-2">
                    <div className="flex justify-between items-center font-bold text-slate-800">
                      <span>ปีการศึกษา {log.fromYear} ➡️ {log.toYear}</span>
                      <span className="text-[10px] text-slate-400">{new Date(log.executedAt).toLocaleDateString("th-TH")}</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] pt-1">
                      <div className="bg-emerald-50 text-emerald-700 p-1.5 rounded font-bold border border-emerald-100">
                        จบ {log.graduatedCount} คน
                      </div>
                      <div className="bg-sky-50 text-sky-700 p-1.5 rounded font-bold border border-sky-100">
                        เลื่อน {log.promotedCount} คน
                      </div>
                      <div className="bg-rose-50 text-rose-700 p-1.5 rounded font-bold border border-rose-100">
                        ซ้ำ {log.retainedCount} คน
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400 text-right font-medium">โดย: {log.executor.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
