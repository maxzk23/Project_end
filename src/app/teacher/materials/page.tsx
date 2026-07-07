"use client";

import { useEffect, useState, useTransition } from "react";
import { getTeacherClassrooms } from "@/app/actions/classroom";
import { getCourseMaterials, toggleMaterialLock, createCourseMaterial, updateCourseMaterial, deleteCourseMaterial } from "@/app/actions/teacher";
import { 
  FaBookOpen, 
  FaPlus, 
  FaToggleOn, 
  FaToggleOff, 
  FaFilePowerpoint, 
  FaFileVideo, 
  FaLink, 
  FaFileAlt,
  FaTimes,
  FaCheckCircle,
  FaExclamationCircle,
  FaUpload,
  FaTrash,
  FaFile,
  FaEdit
} from "react-icons/fa";
import { MaterialType } from "@prisma/client";

interface Classroom {
  id: string;
  name: string;
  yearLevel: string;
  room: string;
}

interface Material {
  id: string;
  classId: string;
  title: string;
  type: MaterialType;
  fileUrl: string;
  isLocked: boolean;
  createdAt: Date;
}

export default function TeacherMaterialsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [isPending, startTransition] = useTransition();
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // === สเตตสำหรับการเพิ่มสื่อตัวเลือกหลายรูปแบบ ===
  const [uploadMethod, setUploadMethod] = useState<"link" | "file">("link");
  const [fileUrlInput, setFileUrlInput] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [title, setTitle] = useState("");
  const [isLocked, setIsLocked] = useState("false");
  const [isDragActive, setIsDragActive] = useState(false);
  const [targetYear, setTargetYear] = useState<string>("ม.1");
  const [rawFile, setRawFile] = useState<File | null>(null);

  // === สเตตสำหรับการแก้ไขบทเรียน (Edit) ===
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUploadMethod, setEditUploadMethod] = useState<"link" | "file">("link");
  const [editFileUrlInput, setEditFileUrlInput] = useState("");
  const [editUploadedFile, setEditUploadedFile] = useState<{ name: string; size: number } | null>(null);
  const [editRawFile, setEditRawFile] = useState<File | null>(null);
  const [editIsLocked, setEditIsLocked] = useState("false");
  const [editTargetYear, setEditTargetYear] = useState("ม.1");
  const [editIsDragActive, setEditIsDragActive] = useState(false);
  const [editUploadProgress, setEditUploadProgress] = useState(0);
  const [editIsUploading, setEditIsUploading] = useState(false);

  // === สเตตสำหรับการลบ (Delete) ===
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // รีเซ็ตค่าฟอร์มเมื่อปิด/เปิดโมดัล
  useEffect(() => {
    if (!isModalOpen) {
      setUploadMethod("link");
      setFileUrlInput("");
      setUploadedFile(null);
      setRawFile(null);
      setIsUploading(false);
      setUploadProgress(0);
      setTitle("");
      setIsLocked("false");
      setIsDragActive(false);
      setTargetYear(selectedClassId || "ม.1");
    }
  }, [isModalOpen, selectedClassId]);

  useEffect(() => {
    const fetchClasses = async () => {
      const classes = await getTeacherClassrooms();
      setClassrooms(classes);
      if (classes.length > 0) {
        setSelectedClassId(classes[0].yearLevel);
      }
    };
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadMaterials();
    }
  }, [selectedClassId]);

  const loadMaterials = async () => {
    setIsLoading(true);
    const data = await getCourseMaterials(selectedClassId);
    setMaterials(data as Material[]);
    setIsLoading(false);
  };

  const showToast = (type: "success" | "error", text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // ตรวจจับประเภทสื่อการสอนจากชื่อไฟล์หรือลิงก์อัตโนมัติ
  const detectMaterialType = (sourceStr: string): MaterialType => {
    const clean = sourceStr.trim().toLowerCase();
    if (!clean) return "FILE";

    // 1. ตรวจสอบวิดีโอ (YouTube หรือ นามสกุลวิดีโอ)
    if (
      clean.includes("youtube.com") ||
      clean.includes("youtu.be") ||
      clean.endsWith(".mp4") ||
      clean.endsWith(".webm") ||
      clean.endsWith(".mov") ||
      clean.endsWith(".avi") ||
      clean.endsWith(".mkv")
    ) {
      return "VIDEO";
    }

    // 2. ตรวจสอบสไลด์บรรยาย (PDF, PPT)
    if (
      clean.endsWith(".pdf") ||
      clean.endsWith(".ppt") ||
      clean.endsWith(".pptx") ||
      clean.endsWith(".odp")
    ) {
      return "SLIDE";
    }

    // 3. ตรวจสอบหน้าเว็บลิงก์ภายนอกทั่วไป (เริ่มด้วย http/https และไม่พบนามสกุลไฟล์ทั่วไป)
    const commonExtensions = [
      ".docx", ".doc", ".xlsx", ".xls", ".zip", ".rar", ".7z", ".txt", ".csv",
      ".png", ".jpg", ".jpeg", ".gif", ".svg", ".mp3", ".wav"
    ];
    const hasFileExtension = commonExtensions.some(ext => clean.endsWith(ext));

    if ((clean.startsWith("http://") || clean.startsWith("https://")) && !hasFileExtension) {
      return "LINK";
    }

    return "FILE";
  };

  // คำนวณประเภทสื่อแบบเรียลไทม์ตามข้อมูลนำเข้า
  const getDetectedType = (): MaterialType => {
    if (uploadMethod === "link") {
      return detectMaterialType(fileUrlInput);
    } else {
      return uploadedFile ? detectMaterialType(uploadedFile.name) : "FILE";
    }
  };
  const detectedType = getDetectedType();

  // ดึงระดับชั้นปีที่ไม่ซ้ำกันที่มีในฐานข้อมูลของคุณครูท่านนี้
  const uniqueYears = Array.from(new Set(classrooms.map((c) => c.yearLevel))).sort();

  // ไอคอนแสดงประเภทที่ตรวจพบ
  const getDetectedTypeIcon = (type: MaterialType) => {
    switch (type) {
      case "SLIDE":
        return <FaFilePowerpoint className="text-orange-500" />;
      case "VIDEO":
        return <FaFileVideo className="text-blue-500" />;
      case "LINK":
        return <FaLink className="text-purple-500" />;
      default:
        return <FaFileAlt className="text-slate-500" />;
    }
  };

  // ข้อความประเภทที่ตรวจพบ
  const getDetectedTypeText = (type: MaterialType) => {
    switch (type) {
      case "SLIDE":
        return "สไลด์บรรยาย / PDF";
      case "VIDEO":
        return "วิดีโอการสอน (YouTube/MP4)";
      case "LINK":
        return "ลิงก์เว็บไซต์ภายนอก (URL)";
      default:
        return "ดาวน์โหลดไฟล์เอกสารทั่วไป";
    }
  };

  // จัดการอัปโหลดไฟล์จำลอง
  const handleFileChange = (file: File) => {
    setUploadedFile({ name: file.name, size: file.size });
    setRawFile(file);
    setIsUploading(true);
    setUploadProgress(0);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setIsUploading(false);
        showToast("success", `อัปโหลดไฟล์ "${file.name}" จำลองเสร็จสิ้น`);
      }
    }, 70);
  };

  // จัดการการลากและวางไฟล์ (Drag & Drop)
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // สลับสถานะตัวล็อกเปิด/ปิดบทเรียนใน DB และอัปเดตสเตตหน้าจอทันที
  const handleToggleLock = (materialId: string, currentLockStatus: boolean) => {
    const newLockStatus = !currentLockStatus;
    
    // อัปเดตสเตตหน้าจอชั่วคราวแบบ Optimistic
    setMaterials(prev => prev.map(m => 
      m.id === materialId ? { ...m, isLocked: newLockStatus } : m
    ));

    startTransition(async () => {
      const res = await toggleMaterialLock(materialId, newLockStatus);
      if (!res.success) {
        showToast("error", "ไม่สามารถอัปเดตสถานะล็อกได้");
        // ย้อนสเตตกลับถ้ามีข้อผิดพลาด
        setMaterials(prev => prev.map(m => 
          m.id === materialId ? { ...m, isLocked: currentLockStatus } : m
        ));
      } else {
        showToast("success", `อัปเดตสถานะการมองเห็นเนื้อหาแล้ว`);
        // ส่งข้อความ Real-time แจ้งฝั่งนักเรียนให้ซิงก์ข้อมูลทันที
        const bc = new BroadcastChannel("lms-channel");
        bc.postMessage({ type: "MATERIAL_TOGGLED", materialId, isLocked: newLockStatus });
        bc.close();
      }
    });
  };

  // ดำเนินการกดบันทึกสร้างบทเรียนใหม่
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast("error", "กรุณากรอกหัวข้อบทเรียน");
      return;
    }

    let finalFileUrl = "";
    if (uploadMethod === "link") {
      let urlVal = fileUrlInput.trim();
      if (!urlVal) {
        showToast("error", "กรุณากรอกลิงก์หรือ URL");
        return;
      }
      // เติม https:// หากครูพิมพ์เฉพาะโดเมน เช่น youtube.com ป้องกันเบราว์เซอร์เปิดเป็น Relative URL
      if (!/^https?:\/\//i.test(urlVal)) {
        urlVal = `https://${urlVal}`;
      }
      finalFileUrl = urlVal;
    } else {
      if (!uploadedFile || !rawFile) {
        showToast("error", "กรุณาอัปโหลดไฟล์ของคุณก่อน");
        return;
      }
      finalFileUrl = `/uploads/materials/${uploadedFile.name}`;
    }

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("type", detectedType);
    formData.append("fileUrl", finalFileUrl);
    formData.append("isLocked", isLocked);
    if (uploadMethod === "file" && rawFile) {
      formData.append("file", rawFile);
    }

    startTransition(async () => {
      const res = await createCourseMaterial(targetYear, formData);
      if (res.success) {
        showToast("success", res.message || "เพิ่มเอกสารประกอบการเรียนเรียบร้อยแล้ว");
        setIsModalOpen(false);
        loadMaterials();
      } else {
        showToast("error", res.error || "เกิดข้อผิดพลาด");
      }
    });
  };

  // === ฟังก์ชันจัดการแก้ไขสื่อการสอน (Edit CRUD) ===
  const openEditModal = (m: Material) => {
    setEditingMaterial(m);
    setEditTitle(m.title);
    setEditIsLocked(String(m.isLocked));
    
    const cls = classrooms.find(c => c.id === m.classId);
    setEditTargetYear(cls ? cls.yearLevel : "ม.1");

    if (m.fileUrl.startsWith("/uploads/")) {
      setEditUploadMethod("file");
      setEditUploadedFile({ name: m.fileUrl.split("/").pop() || "ไฟล์แนบ", size: 0 });
      setEditFileUrlInput("");
    } else {
      setEditUploadMethod("link");
      setEditFileUrlInput(m.fileUrl);
      setEditUploadedFile(null);
    }
    setEditRawFile(null);
  };

  const handleEditFileChange = (file: File) => {
    setEditUploadedFile({ name: file.name, size: file.size });
    setEditRawFile(file);
    setEditIsUploading(true);
    setEditUploadProgress(0);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setEditUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setEditIsUploading(false);
        showToast("success", `อัปโหลดไฟล์ "${file.name}" จำลองเสร็จสิ้น`);
      }
    }, 70);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial) return;

    if (!editTitle.trim()) {
      showToast("error", "กรุณากรอกหัวข้อบทเรียน");
      return;
    }

    let finalFileUrl = "";
    if (editUploadMethod === "link") {
      let urlVal = editFileUrlInput.trim();
      if (!urlVal) {
        showToast("error", "กรุณากรอกลิงก์หรือ URL");
        return;
      }
      if (!/^https?:\/\//i.test(urlVal)) {
        urlVal = `https://${urlVal}`;
      }
      finalFileUrl = urlVal;
    } else {
      if (!editUploadedFile) {
        showToast("error", "กรุณาอัปโหลดไฟล์ของคุณก่อน");
        return;
      }
      finalFileUrl = editUploadedFile.size === 0 ? editingMaterial.fileUrl : `/uploads/materials/${editUploadedFile.name}`;
    }

    // คำนวณประเภทไฟล์ของไฟล์ใหม่
    const cleanStr = editUploadMethod === "link" ? finalFileUrl : (editUploadedFile?.name || "");
    const detectType = (str: string): MaterialType => {
      const clean = str.trim().toLowerCase();
      if (clean.includes("youtube.com") || clean.includes("youtu.be") || clean.endsWith(".mp4") || clean.endsWith(".webm") || clean.endsWith(".mov") || clean.endsWith(".avi") || clean.endsWith(".mkv")) return "VIDEO";
      if (clean.endsWith(".pdf") || clean.endsWith(".ppt") || clean.endsWith(".pptx") || clean.endsWith(".odp")) return "SLIDE";
      if ((clean.startsWith("http://") || clean.startsWith("https://")) && !clean.endsWith(".zip") && !clean.endsWith(".rar")) return "LINK";
      return "FILE";
    };
    const newType = detectType(cleanStr);

    const formData = new FormData();
    formData.append("title", editTitle.trim());
    formData.append("type", newType);
    formData.append("fileUrl", finalFileUrl);
    formData.append("isLocked", editIsLocked);
    if (editUploadMethod === "file" && editRawFile) {
      formData.append("file", editRawFile);
    }

    startTransition(async () => {
      const res = await updateCourseMaterial(editingMaterial.id, editTargetYear, formData);
      if (res.success) {
        showToast("success", res.message || "แก้ไขเอกสารบทเรียนเรียบร้อยแล้ว");
        setEditingMaterial(null);
        loadMaterials();
        
        // ส่งข้อความ Real-time แจ้งนักเรียนให้ซิงก์ทันที
        const bc = new BroadcastChannel("lms-channel");
        bc.postMessage({ type: "MATERIAL_TOGGLED", materialId: editingMaterial.id, isLocked: editIsLocked === "true" });
        bc.close();
      } else {
        showToast("error", res.error || "เกิดข้อผิดพลาด");
      }
    });
  };

  // === ฟังก์ชันจัดการลบสื่อการสอน (Delete CRUD) ===
  const handleDeleteConfirm = () => {
    if (!deleteTargetId) return;

    startTransition(async () => {
      const res = await deleteCourseMaterial(deleteTargetId);
      if (res.success) {
        showToast("success", res.message || "ลบสื่อการสอนสำเร็จ");
        setDeleteTargetId(null);
        loadMaterials();

        // ส่งข้อความ Real-time แจ้งนักเรียนให้ซิงก์ทันที
        const bc = new BroadcastChannel("lms-channel");
        bc.postMessage({ type: "MATERIAL_TOGGLED", materialId: deleteTargetId, isLocked: true });
        bc.close();
      } else {
        showToast("error", res.error || "ไม่สามารถลบข้อมูลได้");
      }
    });
  };

  // Helper ดึงไอคอนตามประเภทไฟล์
  const getMaterialIcon = (type: MaterialType) => {
    switch (type) {
      case "SLIDE":
        return <FaFilePowerpoint className="text-orange-500 text-2xl" />;
      case "VIDEO":
        return <FaFileVideo className="text-blue-500 text-2xl" />;
      case "LINK":
        return <FaLink className="text-purple-500 text-2xl" />;
      default:
        return <FaFileAlt className="text-slate-500 text-2xl" />;
    }
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

      {/* ส่วนหัว และดรอปดาวน์เลือกห้อง */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FaBookOpen className="text-purple-500" /> จัดการสื่อและบทเรียน
          </h1>
          <p className="text-sm text-slate-500 mt-1">อัปโหลด ล็อกสิทธิ์ และควบคุมวิดีโอ/ไฟล์สอนให้นักเรียนเข้าดู</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none cursor-pointer text-slate-700 shadow-sm"
          >
            {uniqueYears.map((year) => (
              <option key={year} value={year}>
                {year === "ม.3" ? "มัธยมศึกษาปีที่ 3 (ม.3)" : year === "ม.2" ? "มัธยมศึกษาปีที่ 2 (ม.2)" : "มัธยมศึกษาปีที่ 1 (ม.1)"}
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl transition text-sm shadow-md"
          >
            <FaPlus />
            <span>เพิ่มสื่อการสอน</span>
          </button>
        </div>
      </div>

      {classrooms.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border text-center text-slate-500">
          <FaExclamationCircle className="text-5xl mx-auto text-amber-500 mb-4" />
          <p className="text-lg font-bold">ไม่พบวิชาหรือห้องเรียนของคุณครู</p>
          <p className="text-sm opacity-75 mt-1">กรุณาสร้างห้องเรียนก่อนจัดการสื่อการสอนครับ</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 font-medium">กำลังดึงรายการสื่อการสอน...</div>
          ) : materials.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <FaBookOpen className="text-5xl mx-auto text-slate-200" />
              <p className="text-sm font-bold">ยังไม่มีการแชร์บทเรียนในห้องนี้</p>
              <p className="text-xs">คุณครูสามารถกดปุ่ม "เพิ่มสื่อการสอน" เพื่อโพสต์สไลด์ PDF หรือวิดีโอ YouTube ได้ครับ</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-200">
                    <th className="pb-3 font-medium pl-2">หัวข้อเรื่อง</th>
                    <th className="pb-3 font-medium">ประเภท</th>
                    <th className="pb-3 font-medium">ลิงก์ / ไฟล์ประกอบ</th>
                    <th className="pb-3 font-medium">วันที่สร้าง</th>
                    <th className="pb-3 font-medium text-right">การล็อก (ซ่อนสไลด์)</th>
                    <th className="pb-3 font-medium text-center pr-2">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {materials.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 pl-2">
                        <div className="flex items-center gap-3">
                          {getMaterialIcon(m.type)}
                          <span className="font-bold text-slate-700">{m.title}</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="text-xs font-bold text-slate-500 uppercase">{m.type}</span>
                      </td>
                      <td className="py-4">
                        <a 
                          href={m.fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-sky-600 font-semibold hover:underline truncate max-w-[200px] inline-block"
                        >
                          {m.fileUrl}
                        </a>
                      </td>
                      <td className="py-4 text-slate-500">
                        {new Date(m.createdAt).toLocaleDateString("th-TH")}
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <span className={`text-xs font-bold ${m.isLocked ? "text-rose-500 animate-pulse" : "text-emerald-500"}`}>
                            {m.isLocked ? "ซ่อนบทเรียนอยู่" : "เปิดสอนปกติ"}
                          </span>
                          <button
                            onClick={() => handleToggleLock(m.id, m.isLocked)}
                            disabled={isPending}
                            className="text-2xl outline-none focus:ring-0"
                          >
                            {m.isLocked ? (
                              <FaToggleOff className="text-slate-400 hover:text-emerald-500 cursor-pointer transition-colors" />
                            ) : (
                              <FaToggleOn className="text-emerald-500 cursor-pointer" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-4 text-center pr-2">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(m)}
                            className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl transition-all hover:scale-105"
                            title="แก้ไขบทเรียน"
                          >
                            <FaEdit className="text-sm" />
                          </button>
                          <button
                            onClick={() => setDeleteTargetId(m.id)}
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all hover:scale-105"
                            title="ลบบทเรียน"
                          >
                            <FaTrash className="text-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

      {/* Modal ป๊อปอัปสร้างสื่อการสอนใหม่ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden p-6 space-y-5 animate-in zoom-in duration-200 text-left">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FaPlus className="text-purple-500" /> เพิ่มสื่อการสอนใหม่
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition outline-none"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              
              {/* หัวข้อเรื่อง */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">หัวข้อบทเรียน / สื่อการเรียน</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="เช่น สไลด์วิชาวิทยาการคำนวณ บทที่ 2"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-purple-500 focus:bg-white transition font-semibold text-slate-700"
                />
              </div>

              {/* เลือกระดับชั้นปี */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase block">ระดับชั้นปีที่เข้าถึงสื่อการสอนนี้</label>
                <select
                  value={targetYear}
                  onChange={(e) => setTargetYear(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none cursor-pointer focus:border-purple-500 focus:bg-white transition text-slate-700 font-semibold"
                >
                  {uniqueYears.map((year) => (
                    <option key={year} value={year}>
                      {year === "ม.3" ? "มัธยมศึกษาปีที่ 3 (ม.3)" : year === "ม.2" ? "มัธยมศึกษาปีที่ 2 (ม.2)" : "มัธยมศึกษาปีที่ 1 (ม.1)"}
                    </option>
                  ))}
                </select>
              </div>

              {/* วิธีอัปโหลด (สลับแท็บ ลิงก์ vs ไฟล์) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase block">รูปแบบการส่งสื่อการสอน</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setUploadMethod("link")}
                    className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      uploadMethod === "link"
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <FaLink className="text-[10px]" />
                    <span>วางลิงก์ / URL ไฟล์</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMethod("file")}
                    className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      uploadMethod === "file"
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <FaUpload className="text-[10px]" />
                    <span>อัปโหลดไฟล์จากเครื่อง</span>
                  </button>
                </div>
              </div>

              {/* คอนเทนต์ตามวิธีนำเข้า */}
              {uploadMethod === "link" ? (
                /* 1. วางลิงก์เว็บ */
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">ลิงก์ / ที่อยู่ไฟล์ออนไลน์ (URL)</label>
                  <input
                    type="url"
                    value={fileUrlInput}
                    onChange={(e) => setFileUrlInput(e.target.value)}
                    required={uploadMethod === "link"}
                    placeholder="ป้อน https://youtube.com/... หรือ https://drive.google.com/..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-purple-500 focus:bg-white transition text-slate-700"
                  />
                </div>
              ) : (
                /* 2. ลากวางไฟล์ / เลือกไฟล์ */
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">ลากวางไฟล์ หรือคลิกอัปโหลด</label>
                  
                  {!uploadedFile ? (
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => document.getElementById("local-file-picker")?.click()}
                      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                        isDragActive 
                          ? "border-purple-500 bg-purple-50/50" 
                          : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 hover:border-purple-300"
                      }`}
                    >
                      <input
                        type="file"
                        id="local-file-picker"
                        className="hidden"
                        onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
                      />
                      <FaUpload className="text-3xl text-slate-400 mx-auto mb-3" />
                      <p className="text-xs font-bold text-slate-600">ลากไฟล์มาวางที่นี่ หรือ คลิกเพื่อเลือกไฟล์</p>
                      <p className="text-[10px] text-slate-400 mt-1 font-semibold">รองรับไฟล์เอกสาร PDF, PPT, Word, Video, Zip (ไม่เกิน 50MB)</p>
                    </div>
                  ) : (
                    /* แสดงสถานะความสำเร็จ / กำลังอัปโหลด */
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                          <FaFile className="text-lg" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-700 truncate">{uploadedFile.name}</p>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            ขนาด: {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      </div>

                      {isUploading ? (
                        /* แถบโหลด */
                        <div className="w-24 shrink-0 text-right space-y-1">
                          <span className="text-[10px] font-bold text-slate-500 block">กำลังอัปโหลด {uploadProgress}%</span>
                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div style={{ width: `${uploadProgress}%` }} className="h-full bg-purple-500 transition-all duration-100"></div>
                          </div>
                        </div>
                      ) : (
                        /* ลบไฟล์ */
                        <button
                          type="button"
                          onClick={() => setUploadedFile(null)}
                          className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                        >
                          <FaTrash className="text-[10px]" />
                          <span>ลบไฟล์</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ส่วนตรวจจับประเภทไฟล์อัตโนมัติ (แสดงผลเรียลไทม์) */}
              {(fileUrlInput || uploadedFile) && (
                <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl flex items-center justify-between text-xs animate-in slide-in-from-top-2 duration-200">
                  <span className="font-bold text-slate-500">ประเภทสื่อ (ระบบตรวจจับอัตโนมัติ):</span>
                  <span className="flex items-center gap-1.5 font-bold text-purple-700">
                    {getDetectedTypeIcon(detectedType)}
                    <span>{getDetectedTypeText(detectedType)}</span>
                  </span>
                </div>
              )}

              {/* ตั้งค่าซ่อนสื่อเป็นค่าเริ่มต้น */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase block">สถานะเมื่อสร้าง</label>
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-600 font-bold cursor-pointer select-none">
                    <input 
                      type="radio" 
                      name="isLocked" 
                      value="false" 
                      checked={isLocked === "false"}
                      onChange={() => setIsLocked("false")}
                      className="accent-purple-500" 
                    />
                    เปิดให้นักเรียนเห็นทันที
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-600 font-bold cursor-pointer select-none">
                    <input 
                      type="radio" 
                      name="isLocked" 
                      value="true" 
                      checked={isLocked === "true"}
                      onChange={() => setIsLocked("true")}
                      className="accent-purple-500" 
                    />
                    ซ่อนไว้ก่อน (ปิดการมองเห็น)
                  </label>
                </div>
              </div>

              {/* ปุ่มส่งฟอร์ม */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 transition text-xs font-bold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isPending || isUploading}
                  className="px-4 py-2 bg-purple-500 text-white font-bold rounded-xl hover:bg-purple-600 transition shadow-md disabled:opacity-50 text-xs"
                >
                  {isPending ? "กำลังบันทึก..." : "เพิ่มสื่อการสอน"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Modal ป๊อปอัปแก้ไขสื่อการสอน */}
      {editingMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 p-6 relative overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* หัวป๊อปอัป */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <FaEdit className="text-lg" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">แก้ไขสื่อประกอบการสอน</h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">แก้ไขหัวข้อ ลิงก์ หรืออัปโหลดไฟล์ใหม่แทนที่ไฟล์เดิม</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingMaterial(null)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition"
              >
                <FaTimes />
              </button>
            </div>

            {/* ฟอร์มแก้ไข */}
            <form onSubmit={handleEditSubmit} className="space-y-4">
              
              {/* หัวข้อเรื่อง */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase block">หัวข้อบทเรียน</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  placeholder="เช่น บทเรียนบทที่ 1 แนะนำวิชาวิทยาการคำนวณ"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 focus:bg-white transition text-slate-700 font-semibold"
                />
              </div>

              {/* เลือกระดับชั้นปี */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase block">ระดับชั้นปีที่เข้าถึงสื่อการสอนนี้</label>
                <select
                  value={editTargetYear}
                  onChange={(e) => setEditTargetYear(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none cursor-pointer focus:border-amber-500 focus:bg-white transition text-slate-700 font-semibold"
                >
                  {uniqueYears.map((year) => (
                    <option key={year} value={year}>
                      {year === "ม.3" ? "มัธยมศึกษาปีที่ 3 (ม.3)" : year === "ม.2" ? "มัธยมศึกษาปีที่ 2 (ม.2)" : "มัธยมศึกษาปีที่ 1 (ม.1)"}
                    </option>
                  ))}
                </select>
              </div>

              {/* วิธีอัปโหลด (สลับแท็บ ลิงก์ vs ไฟล์) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase block">รูปแบบการส่งสื่อการสอน</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEditUploadMethod("link")}
                    className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      editUploadMethod === "link"
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <FaLink className="text-[10px]" />
                    <span>วางลิงก์ / URL ไฟล์</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditUploadMethod("file")}
                    className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      editUploadMethod === "file"
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <FaUpload className="text-[10px]" />
                    <span>อัปโหลดไฟล์ใหม่จากเครื่อง</span>
                  </button>
                </div>
              </div>

              {/* คอนเทนต์ตามวิธีนำเข้า */}
              {editUploadMethod === "link" ? (
                /* 1. วางลิงก์เว็บ */
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">ลิงก์ / ที่อยู่ไฟล์ออนไลน์ (URL)</label>
                  <input
                    type="url"
                    value={editFileUrlInput}
                    onChange={(e) => setEditFileUrlInput(e.target.value)}
                    required={editUploadMethod === "link"}
                    placeholder="ป้อน https://youtube.com/... หรือ https://drive.google.com/..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 focus:bg-white transition text-slate-700"
                  />
                </div>
              ) : (
                /* 2. ลากวางไฟล์ / เลือกไฟล์ */
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">ลากวางไฟล์ หรือคลิกอัปโหลดใหม่</label>
                  
                  {!editUploadedFile ? (
                    <div
                      onDragEnter={(e) => { e.preventDefault(); setEditIsDragActive(true); }}
                      onDragOver={(e) => { e.preventDefault(); setEditIsDragActive(true); }}
                      onDragLeave={() => setEditIsDragActive(false)}
                      onDrop={(e) => { e.preventDefault(); setEditIsDragActive(false); e.dataTransfer.files && handleEditFileChange(e.dataTransfer.files[0]); }}
                      onClick={() => document.getElementById("edit-file-picker")?.click()}
                      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                        editIsDragActive 
                          ? "border-amber-500 bg-amber-50/50" 
                          : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 hover:border-amber-300"
                      }`}
                    >
                      <input
                        type="file"
                        id="edit-file-picker"
                        className="hidden"
                        onChange={(e) => e.target.files && handleEditFileChange(e.target.files[0])}
                      />
                      <FaUpload className="text-3xl text-slate-400 mx-auto mb-3" />
                      <p className="text-xs font-bold text-slate-600">ลากไฟล์มาวางที่นี่ หรือ คลิกเพื่อเลือกไฟล์ใหม่</p>
                      <p className="text-[10px] text-slate-400 mt-1 font-semibold">ปล่อยว่างไว้หากต้องการใช้ไฟล์เดิมที่เคยอัปโหลดไว้แล้ว</p>
                    </div>
                  ) : (
                    /* แสดงสถานะความสำเร็จ / กำลังอัปโหลด */
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                          <FaFile className="text-lg" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-700 truncate">{editUploadedFile.name}</p>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            {editUploadedFile.size === 0 ? "ไฟล์เดิมที่อัปโหลดไว้แล้ว" : `ขนาด: ${(editUploadedFile.size / (1024 * 1024)).toFixed(2)} MB`}
                          </p>
                        </div>
                      </div>

                      {editIsUploading ? (
                        /* แถบโหลด */
                        <div className="w-24 shrink-0 text-right space-y-1">
                          <span className="text-[10px] font-bold text-slate-500 block">กำลังอัปโหลด {editUploadProgress}%</span>
                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div style={{ width: `${editUploadProgress}%` }} className="h-full bg-amber-500 transition-all duration-100"></div>
                          </div>
                        </div>
                      ) : (
                        /* ลบไฟล์ */
                        <button
                          type="button"
                          onClick={() => { setEditUploadedFile(null); setEditRawFile(null); }}
                          className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                        >
                          <FaTrash className="text-[10px]" />
                          <span>ยกเลิก</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ตั้งค่าซ่อนสื่อ */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase block">สถานะการมองเห็น</label>
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-600 font-bold cursor-pointer select-none">
                    <input 
                      type="radio" 
                      name="editIsLocked" 
                      value="false" 
                      checked={editIsLocked === "false"}
                      onChange={() => setEditIsLocked("false")}
                      className="accent-amber-500" 
                    />
                    เปิดให้นักเรียนเห็นปกติ
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-600 font-bold cursor-pointer select-none">
                    <input 
                      type="radio" 
                      name="editIsLocked" 
                      value="true" 
                      checked={editIsLocked === "true"}
                      onChange={() => setEditIsLocked("true")}
                      className="accent-amber-500" 
                    />
                    ซ่อนไว้ชั่วคราว (ปิดการเข้าถึง)
                  </label>
                </div>
              </div>

              {/* ปุ่มส่งฟอร์ม */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setEditingMaterial(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 transition text-xs font-bold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isPending || editIsUploading}
                  className="px-4 py-2 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition shadow-md disabled:opacity-50 text-xs"
                >
                  {isPending ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Modal ป๊อปอัปยืนยันการลบ */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-100 p-6 relative overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-2">
                <FaTrash className="text-xl" />
              </div>
              <h3 className="text-base font-bold text-slate-800">ยืนยันการลบสื่อการสอน?</h3>
              <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                การลบรายการนี้จะเป็นการลบไฟล์และบทเรียนออกจากระบบอย่างถาวร นักเรียนทุกคนจะไม่สามารถคลิกเปิดเรียนรู้สื่อชุดนี้ได้อีกต่อไป
              </p>
            </div>

            <div className="pt-5 flex justify-center gap-3 text-sm">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 transition text-xs font-bold flex-1"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isPending}
                className="px-4 py-2 bg-rose-500 text-white font-bold rounded-xl hover:bg-rose-600 transition shadow-md disabled:opacity-50 text-xs flex-1"
              >
                {isPending ? "กำลังลบ..." : "ลบอย่างถาวร"}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
