"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { 
  getAllStudents, 
  createGlobalStudent, 
  updateStudent, 
  deleteStudent,
  importGlobalStudents
} from "@/app/actions/classroom";
import * as XLSX from "xlsx";
import { 
  FaPlus, 
  FaFileExcel, 
  FaSearch, 
  FaEdit, 
  FaTrash, 
  FaLock, 
  FaTimes, 
  FaExclamationCircle, 
  FaCheckCircle, 
  FaGraduationCap, 
  FaUsers,
  FaFileImport,
  FaDownload,
  FaHashtag,
  FaSave
} from "react-icons/fa";

interface Student {
  id: string;
  name: string;
  avatarUrl: string | null;
  status: string;
  studentId: string;
  passwordHint: string;
  nickname: string;
  gender: string;
  rollNumber: string;
  parentPhone: string;
  yearLevel: string;
  room: string;
  academicYear: string;
  classroomId: string | null;
  totalPoints: number;
}

interface ParsedStudent {
  name: string;
  code: string;
  class: string;
  room: string;
  password?: string;
  isValid: boolean;
  errors: string[];
}

export default function StudentRegistryPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States
  const [selectedYear, setSelectedYear] = useState("2568");
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [selectedRoom, setSelectedRoom] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  // Input states for creation
  const [createName, setCreateName] = useState("");
  const [createNickname, setCreateNickname] = useState("");
  const [createGender, setCreateGender] = useState("");
  const [createLevel, setCreateLevel] = useState("");
  const [createRoom, setCreateRoom] = useState("");
  const [createRollNumber, setCreateRollNumber] = useState("");
  const [createParentPhone, setCreateParentPhone] = useState("");
  const [createPassword, setCreatePassword] = useState("");

  // Input states for editing
  const [editNickname, setEditNickname] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editRollNumber, setEditRollNumber] = useState("");
  const [editParentPhone, setEditParentPhone] = useState("");

  // Excel parsing states
  const [tempParsedStudents, setTempParsedStudents] = useState<ParsedStudent[]>([]);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password confirmations
  const [teacherPassword, setTeacherPassword] = useState(""); // For edit/delete confirmations
  const [editPasswordHint, setEditPasswordHint] = useState(""); // For editing student password
  
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error", text: string } | null>(null);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setIsLoading(true);
    const data = await getAllStudents();
    setStudents(data);
    if (data.length > 0) {
      const years = data.map(s => s.academicYear).filter(Boolean);
      const uniqueYears = Array.from(new Set(years)).sort((a, b) => b.localeCompare(a));
      if (uniqueYears.length > 0) {
        setSelectedYear(uniqueYears[0]);
      }
    }
    setIsLoading(false);
  };

  const getNextStudentId = (level: string, room: string) => {
    if (!level || !room) return "กรุณาเลือกชั้นและห้อง";
    
    // แปลง ระดับชั้น เป็นรหัสปี (ม.3 -> 66, ม.2 -> 67, ม.1 -> 68)
    let yearPrefix = "68";
    if (level === "ม.3") yearPrefix = "66";
    else if (level === "ม.2") yearPrefix = "67";
    else if (level === "ม.1") yearPrefix = "68";

    // แปลง ห้องเรียนย่อย เป็น 2 หลัก (เช่น 1 -> 01, 2 -> 02, 3 -> 03)
    const roomPrefix = room.padStart(2, "0");
    const prefix = `${yearPrefix}${roomPrefix}`; // เช่น "6801"

    // กรองหานักเรียนที่มี studentId ขึ้นต้นด้วย prefix นี้
    const matchingIds = students
      .map(s => s.studentId)
      .filter(id => id && id.startsWith(prefix));

    if (matchingIds.length === 0) {
      return `${prefix}01`;
    }

    const numbers = matchingIds.map(id => {
      const seqPart = id.substring(prefix.length);
      return parseInt(seqPart, 10);
    }).filter(num => !isNaN(num));

    const maxSeq = numbers.length > 0 ? Math.max(...numbers) : 0;
    return `${prefix}${String(maxSeq + 1).padStart(2, "0")}`;
  };

  const showToast = (type: "success" | "error", text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const autoId = getNextStudentId(createLevel, createRoom);
    if (autoId === "กรุณาเลือกชั้นและห้อง") {
      setErrorMsg("กรุณาเลือกชั้นปีและห้องเรียนก่อน เพื่อทำการสร้างรหัสประจำตัว");
      return;
    }

    if (!createName.trim() || !createLevel || !createRoom || !createPassword.trim()) {
      setErrorMsg("กรุณากรอกข้อมูลระดับชั้น ห้องเรียน ชื่อจริง และรหัสผ่านให้ครบถ้วน");
      return;
    }

    startTransition(async () => {
      const res = await createGlobalStudent(
        createName,
        autoId,
        createLevel,
        createRoom,
        createPassword,
        createNickname,
        createGender,
        createRollNumber,
        createParentPhone,
        selectedYear === "all" ? "2568" : selectedYear
      );
      if (res.success) {
        setIsCreateModalOpen(false);
        setCreateName("");
        setCreateNickname("");
        setCreateGender("");
        setCreateLevel("");
        setCreateRoom("");
        setCreateRollNumber("");
        setCreateParentPhone("");
        setCreatePassword("");
        showToast("success", "เพิ่มบัญชีนักเรียนใหม่สำเร็จ");
        loadStudents();
      } else {
        setErrorMsg(res.error || "เกิดข้อผิดพลาดในการสร้างนักเรียน");
      }
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!editingStudent) return;

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    formData.append("id", editingStudent.id);
    formData.append("academicYear", selectedYear === "all" ? "2568" : selectedYear);

    startTransition(async () => {
      const res = await updateStudent(formData);
      if (res.success) {
        setEditingStudent(null);
        setTeacherPassword("");
        showToast("success", "แก้ไขข้อมูลนักเรียนสำเร็จ");
        loadStudents();
      } else {
        setErrorMsg(res.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }
    });
  };

  const handleDeleteConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingStudent) return;
    setErrorMsg(null);

    startTransition(async () => {
      const res = await deleteStudent(deletingStudent.id, teacherPassword);
      if (res.success) {
        setDeletingStudent(null);
        setTeacherPassword("");
        showToast("success", "ลบข้อมูลนักเรียนเรียบร้อยแล้ว");
        loadStudents();
      } else {
        setErrorMsg(res.error || "เกิดข้อผิดพลาดในการลบ");
      }
    });
  };

  // Excel parsing
  const downloadImportTemplate = () => {
    const headers = [["ชื่อ-นามสกุล", "รหัสนักเรียน", "ระดับชั้น (m1/m2/m3)", "ห้องเรียน (1/2/3)", "รหัสผ่าน (เว้นว่างระบบจะสุ่ม 4 หลัก)"]];
    const sampleData = [
      ["สมชาย ขยันเรียน", "660104", "m3", "1", "1234"],
      ["สมหญิง รักดี", "660102", "m3", "1", "1234"],
      ["กิตติศักดิ์ พรสุวรรณ", "680101", "m1", "1", "1234"]
    ];

    const wsData = headers.concat(sampleData);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!cols'] = [
      { wch: 25 },
      { wch: 15 },
      { wch: 22 },
      { wch: 18 },
      { wch: 28 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "รายชื่อนักเรียน");
    XLSX.writeFile(wb, "Template_Student_Import.xlsx");
    showToast("success", "ดาวน์โหลดไฟล์เทมเพลต Excel เรียบร้อยแล้ว");
  };

  const processExcelFile = (file: File) => {
    setFileName(`${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        if (rows.length < 2) {
          showToast("error", "ไฟล์ไม่มีข้อมูลรายชื่อนักเรียน หรือมีเพียงหัวข้อคอลัมน์");
          return;
        }

        const parsedList: ParsedStudent[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0 || (row.length === 1 && !row[0])) continue;

          const rawName = String(row[0] || "").trim();
          const rawCode = String(row[1] || "").trim();
          const rawClass = String(row[2] || "").trim().toLowerCase();
          const rawRoom = String(row[3] || "").trim();
          const rawPassword = String(row[4] || "").trim();

          if (!rawName && !rawCode && !rawClass && !rawRoom) continue;

          const errors: string[] = [];
          let studentClass = "";
          let studentRoom = "";

          if (!rawName) errors.push("กรุณาระบุชื่อ-นามสกุล");
          if (!rawCode) errors.push("กรุณาระบุรหัสประจำตัว");

          if (!rawClass) {
            errors.push("กรุณาระบุระดับชั้น");
          } else {
            if (rawClass.includes("1") || rawClass.includes("m1") || rawClass.includes("ม.1")) {
              studentClass = "m1";
            } else if (rawClass.includes("2") || rawClass.includes("m2") || rawClass.includes("ม.2")) {
              studentClass = "m2";
            } else if (rawClass.includes("3") || rawClass.includes("m3") || rawClass.includes("ม.3")) {
              studentClass = "m3";
            } else {
              errors.push("ระดับชั้นไม่ถูกต้อง (m1, m2, m3)");
            }
          }

          if (!rawRoom) {
            errors.push("กรุณาระบุห้องเรียน");
          } else {
            const matchNum = rawRoom.match(/[1-3]/);
            if (matchNum) {
              studentRoom = matchNum[0];
            } else {
              errors.push("ห้องเรียนไม่ถูกต้อง (1-3)");
            }
          }

          const isValid = errors.length === 0;
          const password = isValid 
            ? (rawPassword ? rawPassword : String(Math.floor(1000 + Math.random() * 9000))) 
            : "";

          parsedList.push({
            name: rawName,
            code: rawCode,
            class: studentClass,
            room: studentRoom,
            password: password,
            isValid,
            errors
          });
        }

        setTempParsedStudents(parsedList);
      } catch (err) {
        showToast("error", "ไม่สามารถอ่านไฟล์ได้ กรุณาใช้ไฟล์ตามเทมเพลต");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmExcelImport = () => {
    const validStudents = tempParsedStudents.filter(s => s.isValid);
    if (validStudents.length === 0) return;

    startTransition(async () => {
      const res = await importGlobalStudents(validStudents, selectedYear === "all" ? "2568" : selectedYear);
      if (res.success) {
        showToast("success", res.message || "นำเข้ารายชื่อนักเรียนเรียบร้อยแล้ว");
        setIsExcelModalOpen(false);
        setTempParsedStudents([]);
        setFileName("");
        loadStudents();
      } else {
        showToast("error", res.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }
    });
  };

  // Stats calculation
  const countM1 = students.filter(s => s.yearLevel === "ม.1").length;
  const countM2 = students.filter(s => s.yearLevel === "ม.2").length;
  const countM3 = students.filter(s => s.yearLevel === "ม.3").length;
  const countTotal = students.length;

  // Filtered Students
  const filteredStudents = students.filter(s => {
    const matchYear = selectedYear === "all" || s.academicYear === selectedYear;
    const matchLevel = selectedLevel === "all" || s.yearLevel === selectedLevel;
    const matchRoom = selectedRoom === "all" || s.room === selectedRoom;
    const matchSearch = searchQuery.trim() === "" || 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchYear && matchLevel && matchRoom && matchSearch;
  });

  return (
    <div className="space-y-8 text-left">
      {/* Toast แจ้งเตือน */}
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

      {/* หัวข้อหน้า */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
          <FaUsers className="text-sky-500" />
          <span>บัญชีนักเรียน (Student Registry)</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">บริหารจัดการข้อมูล บัญชีล็อกอิน และระดับชั้นของนักเรียนทั้งหมด</p>
      </div>

      {/* 4-Column Stats Grid (เหมือนเดโม่ 100%) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* ม.1 (สีเขียวอ่อน) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-emerald-500 flex items-center gap-5 bg-gradient-to-br from-emerald-500/5 to-white">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-xl font-bold">
            {countM1}
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-800">{countM1}</h3>
            <p className="text-sm text-slate-500 font-semibold">ม.1</p>
          </div>
        </div>

        {/* ม.2 (สีม่วงอ่อน) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-purple-500 flex items-center gap-5 bg-gradient-to-br from-purple-500/5 to-white">
          <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-xl font-bold">
            {countM2}
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-800">{countM2}</h3>
            <p className="text-sm text-slate-500 font-semibold">ม.2</p>
          </div>
        </div>

        {/* ม.3 (สีฟ้าอ่อน) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-sky-500 flex items-center gap-5 bg-gradient-to-br from-sky-500/5 to-white">
          <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center text-xl font-bold">
            {countM3}
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-800">{countM3}</h3>
            <p className="text-sm text-slate-500 font-semibold">ม.3</p>
          </div>
        </div>

        {/* รวมทั้งหมด */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-slate-400 flex items-center gap-5 bg-gradient-to-br from-slate-500/5 to-white">
          <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center text-xl font-bold">
            {countTotal}
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-800">{countTotal}</h3>
            <p className="text-sm text-slate-500 font-semibold">รวมทั้งหมด</p>
          </div>
        </div>

      </div>

      {/* เมนูตัวกรอง และปุ่มจัดการ (ตามรูปเดโม่ 100%) */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* กลุ่มตัวกรอง */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* ปีการศึกษา */}
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-sky-500 transition"
          >
            {Array.from(new Set(students.map(s => s.academicYear).filter(Boolean))).sort((a, b) => b.localeCompare(a)).map(yr => (
              <option key={yr} value={yr}>ปีการศึกษา {yr}</option>
            ))}
            <option value="all">ทุกปีการศึกษา</option>
          </select>

          {/* ระดับชั้น */}
          <select 
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-sky-500 transition"
          >
            <option value="all">ทุกระดับชั้น</option>
            <option value="ม.1">ม.1</option>
            <option value="ม.2">ม.2</option>
            <option value="ม.3">ม.3</option>
          </select>

          {/* ทุกห้อง */}
          <select 
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-sky-500 transition"
          >
            <option value="all">ทุกห้อง</option>
            <option value="1">ห้อง 1</option>
            <option value="2">ห้อง 2</option>
            <option value="3">ห้อง 3</option>
          </select>

          {/* ช่องค้นหา */}
          <div className="relative min-w-[200px]">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <FaSearch className="text-xs" />
            </span>
            <input 
              type="text" 
              placeholder="ค้นหาชื่อ, รหัส..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm w-full focus:outline-none focus:border-sky-500 focus:bg-white transition"
            />
          </div>

        </div>

        {/* กลุ่มปุ่มคำสั่งหลัก */}
        <div className="flex items-center gap-3">
          
          <button
            onClick={() => setIsExcelModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs sm:text-sm transition-colors shadow-sm"
          >
            <FaFileExcel />
            <span>นำเข้าไฟล์ Excel / CSV</span>
          </button>

          <button
            onClick={() => {
              setErrorMsg(null);
              setCreatePassword(String(Math.floor(1000 + Math.random() * 9000))); // เจนรหัสเริ่มต้น 4 หลักให้ทันที
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs sm:text-sm transition-colors shadow-sm"
          >
            <FaPlus />
            <span>เพิ่มนักเรียนใหม่</span>
          </button>

        </div>

      </div>

      {/* ส่วนรายชื่อนักเรียน (การ์ดแสดงตามรูปเดโม่ 100%) */}
      {isLoading ? (
        <div className="bg-white p-12 rounded-2xl text-center text-slate-500 font-semibold border border-slate-100">
          กำลังโหลดข้อมูลนักเรียน...
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl text-center text-slate-500 font-semibold border border-slate-100 space-y-3">
          <FaUsers className="text-5xl mx-auto text-slate-300" />
          <p>ไม่พบรายชื่อนักเรียนที่สอดคล้องกับเงื่อนไขการค้นหา</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredStudents.map((std) => (
            <div 
              key={`${std.id}-${std.classroomId || 'none'}`}
              className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between gap-4 hover:shadow-md transition-shadow relative"
            >
              
              {/* ซีกซ้าย: รายละเอียดและอวตาร */}
              <div className="flex items-center gap-4">
                
                {/* สัญลักษณ์อวตารเดโม่ */}
                <div className="w-11 h-11 bg-sky-50 text-sky-600 border border-sky-100 rounded-full flex items-center justify-center font-bold text-base shrink-0">
                  {std.name.charAt(0)}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700 text-base">{std.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      std.yearLevel === "ม.1" ? "bg-emerald-100 text-emerald-700" :
                      std.yearLevel === "ม.2" ? "bg-purple-100 text-purple-700" :
                      "bg-sky-100 text-sky-700"
                    }`}>
                      {std.yearLevel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-semibold">
                    รหัส: <span className="font-mono text-slate-600">{std.studentId}</span> - รหัสผ่าน: <span className="font-mono text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-black">{std.passwordHint}</span> - {std.yearLevel}/{std.room}
                  </p>
                </div>

              </div>

              {/* ซีกขวา: คะแนนและเครื่องมือลบ/แก้ไข */}
              <div className="flex items-center gap-4 sm:gap-6">
                
                <span className="font-bold text-slate-800 text-sm sm:text-base shrink-0">
                  {std.totalPoints.toLocaleString()} <span className="text-xs text-slate-400 font-semibold">pts</span>
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setErrorMsg(null);
                      setTeacherPassword("");
                      setEditingStudent(std);
                      setEditPasswordHint(std.passwordHint);
                      setEditNickname(std.nickname || "");
                      setEditGender(std.gender || "");
                      setEditRollNumber(std.rollNumber || "");
                      setEditParentPhone(std.parentPhone || "");
                    }}
                    className="p-2 bg-slate-50 hover:bg-sky-50 text-slate-400 hover:text-sky-600 rounded-xl transition"
                    title="แก้ไขข้อมูลนักเรียน"
                  >
                    <FaEdit className="text-sm" />
                  </button>

                  <button
                    onClick={() => {
                      setErrorMsg(null);
                      setTeacherPassword("");
                      setDeletingStudent(std);
                    }}
                    className="p-2 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition"
                    title="ลบข้อมูลนักเรียน"
                  >
                    <FaTrash className="text-sm" />
                  </button>
                </div>

              </div>

            </div>
          ))}
        </div>
      )}

      {/* Modal เพิ่มนักเรียนใหม่ */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-6 space-y-6 animate-in zoom-in duration-200">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 text-left">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FaUsers className="text-sky-500" />
                <span>เพิ่มนักเรียนใหม่</span>
              </h2>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <FaTimes />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-start gap-2.5 text-xs font-semibold">
                <FaExclamationCircle className="text-sm mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              
              {/* ข้อมูลจำลองรหัสนักเรียน รันอัตโนมัติล็อคไว้ ห้ามซ้ำ */}
              <div className="flex items-center gap-2.5 px-4 py-3 bg-sky-50/50 rounded-xl border border-sky-100 text-sm text-sky-700 font-bold">
                <FaHashtag className="text-sky-500" />
                <span>รหัสนักเรียน:</span>
                <span className="font-mono text-sky-600 font-black">{getNextStudentId(createLevel, createRoom)}</span>
              </div>

              {/* แถวที่ 1: ชื่อจริง-นามสกุล และ ชื่อเล่น */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-slate-700 uppercase">ชื่อ-นามสกุล <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    disabled={isPending}
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="เช่น สมชาย ขยันเรียน"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition"
                  />
                </div>
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-slate-700 uppercase">ชื่อเล่น</label>
                  <input
                    type="text"
                    disabled={isPending}
                    value={createNickname}
                    onChange={(e) => setCreateNickname(e.target.value)}
                    placeholder="เช่น เอ, โอ๊ต"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* แถวที่ 2: เพศ, ระดับชั้น, ห้องเรียนย่อย, เลขที่ */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">เพศ</label>
                  <select
                    value={createGender}
                    onChange={(e) => setCreateGender(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-pointer focus:outline-none focus:border-sky-500 transition"
                  >
                    <option value="">-- เลือก --</option>
                    <option value="ชาย">ชาย</option>
                    <option value="หญิง">หญิง</option>
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">ระดับชั้น <span className="text-rose-500">*</span></label>
                  <select
                    required
                    value={createLevel}
                    onChange={(e) => setCreateLevel(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-pointer focus:outline-none focus:border-sky-500 transition"
                  >
                    <option value="">-- ชั้น --</option>
                    <option value="ม.1">ม.1</option>
                    <option value="ม.2">ม.2</option>
                    <option value="ม.3">ม.3</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">ห้อง <span className="text-rose-500">*</span></label>
                  <select
                    required
                    value={createRoom}
                    onChange={(e) => setCreateRoom(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-pointer focus:outline-none focus:border-sky-500 transition"
                  >
                    <option value="">-- ห้อง --</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">เลขที่</label>
                  <input
                    type="text"
                    disabled={isPending}
                    value={createRollNumber}
                    onChange={(e) => setCreateRollNumber(e.target.value)}
                    placeholder="-"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition text-center"
                  />
                </div>
              </div>

              {/* แถวที่ 3: เบอร์โทรผู้ปกครอง และ รหัสผ่าน */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-slate-700 uppercase">เบอร์โทรผู้ปกครอง</label>
                  <input
                    type="text"
                    disabled={isPending}
                    value={createParentPhone}
                    onChange={(e) => setCreateParentPhone(e.target.value)}
                    placeholder="เช่น 081-234-5678"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-slate-700 uppercase">รหัสผ่าน (PIN 4 หลัก) <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      disabled={isPending}
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      placeholder="เช่น 1234"
                      className="w-full pl-3.5 pr-28 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition"
                    />
                    <button
                      type="button"
                      onClick={() => setCreatePassword(String(Math.floor(1000 + Math.random() * 9000)))}
                      className="absolute right-1.5 top-1.5 bottom-1.5 px-2 bg-sky-50 hover:bg-sky-100 text-sky-600 font-bold rounded-lg text-[10px] border border-sky-150 transition shrink-0 flex items-center justify-center shadow-sm"
                    >
                      🎲 สุ่มรหัส
                    </button>
                  </div>
                </div>
              </div>

              {/* ปุ่มควบคุม */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-6 py-2.5 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl transition shadow-md flex items-center gap-2"
                >
                  <FaSave className="text-xs" />
                  <span>เพิ่มนักเรียน</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal แก้ไขข้อมูลนักเรียน */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-6 space-y-6 animate-in zoom-in duration-200">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 text-left">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FaEdit className="text-sky-500" />
                <span>แก้ไขข้อมูลนักเรียน</span>
              </h2>
              <button 
                onClick={() => setEditingStudent(null)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <FaTimes />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-start gap-2.5 text-xs font-semibold">
                <FaExclamationCircle className="text-sm mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              
              {/* ล็อกรหัสนักเรียนไว้ ป้องกันการแก้ไขตัวคีย์หลัก */}
              <div className="flex items-center gap-2.5 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-600 font-semibold">
                <FaHashtag className="text-slate-400" />
                <span>รหัสนักเรียน (แก้ไขไม่ได้):</span>
                <span className="font-mono text-slate-800 font-bold">{editingStudent.studentId}</span>
                <input type="hidden" name="studentId" value={editingStudent.studentId} />
              </div>

              {/* แถวที่ 1: ชื่อจริง-นามสกุล และ ชื่อเล่น */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-slate-700 uppercase">ชื่อ-นามสกุล <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    name="name"
                    required
                    disabled={isPending}
                    defaultValue={editingStudent.name}
                    placeholder="เช่น สมชาย ขยันเรียน"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition"
                  />
                </div>
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-slate-700 uppercase">ชื่อเล่น</label>
                  <input
                    type="text"
                    name="nickname"
                    disabled={isPending}
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                    placeholder="เช่น เอ, โอ๊ต"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* แถวที่ 2: เพศ, ระดับชั้น, ห้องเรียนย่อย, เลขที่ */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">เพศ</label>
                  <select
                    name="gender"
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-pointer focus:outline-none focus:border-sky-500 transition"
                  >
                    <option value="">-- เลือก --</option>
                    <option value="ชาย">ชาย</option>
                    <option value="หญิง">หญิง</option>
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">ระดับชั้น <span className="text-rose-500">*</span></label>
                  <select
                    name="yearLevel"
                    required
                    defaultValue={editingStudent.yearLevel}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-pointer focus:outline-none focus:border-sky-500 transition"
                  >
                    <option value="ม.1">ม.1</option>
                    <option value="ม.2">ม.2</option>
                    <option value="ม.3">ม.3</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">ห้อง <span className="text-rose-500">*</span></label>
                  <select
                    name="room"
                    required
                    defaultValue={editingStudent.room}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-pointer focus:outline-none focus:border-sky-500 transition"
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">เลขที่</label>
                  <input
                    type="text"
                    name="rollNumber"
                    disabled={isPending}
                    value={editRollNumber}
                    onChange={(e) => setEditRollNumber(e.target.value)}
                    placeholder="-"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition text-center"
                  />
                </div>
              </div>

              {/* แถวที่ 3: เบอร์โทรผู้ปกครอง และ รหัสผ่าน */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-slate-700 uppercase">เบอร์โทรผู้ปกครอง</label>
                  <input
                    type="text"
                    name="parentPhone"
                    disabled={isPending}
                    value={editParentPhone}
                    onChange={(e) => setEditParentPhone(e.target.value)}
                    placeholder="เช่น 081-234-5678"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-slate-700 uppercase">รหัสผ่าน (PIN 4 หลัก) <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <input
                      type="text"
                      name="passwordHint"
                      required
                      disabled={isPending}
                      value={editPasswordHint}
                      onChange={(e) => setEditPasswordHint(e.target.value)}
                      placeholder="เช่น 1234"
                      className="w-full pl-3.5 pr-28 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition"
                    />
                    <button
                      type="button"
                      onClick={() => setEditPasswordHint(String(Math.floor(1000 + Math.random() * 9000)))}
                      className="absolute right-1.5 top-1.5 bottom-1.5 px-2 bg-sky-50 hover:bg-sky-100 text-sky-600 font-bold rounded-lg text-[10px] border border-sky-150 transition shrink-0 flex items-center justify-center shadow-sm"
                    >
                      🎲 สุ่มรหัส
                    </button>
                  </div>
                </div>
              </div>

              {/* ยืนยันรหัสผ่านครู */}
              <div className="space-y-1.5 text-left border-t border-slate-100 pt-4">
                <label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  <FaLock className="text-slate-400" />
                  <span>ป้อนรหัสผ่านครูผู้สอนเพื่อยืนยันการแก้ไข *</span>
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  disabled={isPending}
                  value={teacherPassword}
                  onChange={(e) => setTeacherPassword(e.target.value)}
                  placeholder="รหัสผ่านล็อกอินของคุณครู"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-250 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition"
                />
              </div>

              {/* ปุ่มควบคุม */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-6 py-2.5 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl transition shadow-md flex items-center gap-2"
                >
                  <FaSave className="text-xs" />
                  <span>บันทึกการแก้ไข</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal ลบข้อมูลนักเรียน */}
      {deletingStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-6 space-y-6 animate-in zoom-in duration-200">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 text-left">
              <h2 className="text-lg font-bold text-rose-600 flex items-center gap-2">
                <FaTrash className="text-rose-500" />
                <span>ยืนยันลบข้อมูลนักเรียน</span>
              </h2>
              <button 
                onClick={() => setDeletingStudent(null)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <FaTimes />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-start gap-2.5 text-xs font-semibold">
                <FaExclamationCircle className="text-sm mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleDeleteConfirm} className="space-y-4">
              
              <div className="text-sm text-slate-600 text-left space-y-2">
                <p>คุณแน่ใจหรือไม่ที่จะลบนักเรียน <strong className="text-slate-800">"{deletingStudent.name}" (รหัส: {deletingStudent.studentId})</strong> ออกจากฐานข้อมูล?</p>
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 p-3 rounded-xl leading-relaxed">
                  ⚠️ <strong>คำเตือน:</strong> การลบนักเรียนรายบุคคลจะลบประวัติการส่งงาน เช็คชื่อเข้าเรียน และสถิติมินิเกมทั้งหมดของเด็กคนนี้แบบถาวร!
                </p>
              </div>

              {/* ยืนยันรหัสครู */}
              <div className="space-y-1.5 text-left border-t border-slate-100 pt-3">
                <label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  <FaLock className="text-slate-400" />
                  <span>ป้อนรหัสผ่านครูผู้สอนเพื่อยืนยันการลบ *</span>
                </label>
                <input
                  type="password"
                  required
                  disabled={isPending}
                  value={teacherPassword}
                  onChange={(e) => setTeacherPassword(e.target.value)}
                  placeholder="รหัสผ่านล็อกอินของคุณครู"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-250 rounded-xl text-sm focus:outline-none focus:border-rose-500 focus:bg-white transition"
                />
              </div>

              {/* ปุ่มควบคุม */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setDeletingStudent(null)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition shadow-sm"
                >
                  {isPending ? "กำลังลบ..." : "ยืนยันการลบ"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {isExcelModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-[750px] rounded-2xl shadow-xl overflow-hidden animate-in zoom-in duration-200">
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 text-left">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FaFileExcel className="text-emerald-500 text-xl" />
                <span>นำเข้ารายชื่อนักเรียนด้วยไฟล์ Excel / CSV</span>
              </h3>
              <button 
                onClick={() => { setIsExcelModalOpen(false); setTempParsedStudents([]); setFileName(""); }}
                className="text-slate-400 hover:text-slate-600 text-2xl transition"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[500px] overflow-y-auto text-left">
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <span className="font-bold text-xs text-slate-700 flex items-center gap-1">
                  <FaExclamationCircle className="text-sky-500" />
                  ข้อแนะนำการเตรียมไฟล์:
                </span>
                <p className="text-xs text-slate-500">
                  กรุณาเตรียมไฟล์ Excel (.xlsx, .xls) หรือ CSV (.csv) โดยมี 5 คอลัมน์ดังนี้:
                </p>

                <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg p-2">
                  <table className="w-full text-left text-[11px] border-collapse min-w-[550px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 font-bold text-slate-700">
                        <th className="p-1.5">ชื่อ-นามสกุล</th>
                        <th className="p-1.5">รหัสนักเรียน</th>
                        <th className="p-1.5">ระดับชั้น (m1/m2/m3)</th>
                        <th className="p-1.5">ห้องเรียน (1/2/3)</th>
                        <th className="p-1.5">รหัสผ่าน</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-slate-500 font-medium">
                        <td className="p-1.5">กิตติศักดิ์ พรสุวรรณ</td>
                        <td className="p-1.5 font-mono">680101</td>
                        <td className="p-1.5 font-mono">m1</td>
                        <td className="p-1.5 font-mono">1</td>
                        <td className="p-1.5 font-mono">1234</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center flex-wrap gap-2 text-[10px] text-slate-400">
                  <span>* ระดับชั้นระบุเป็น: m1, m2, m3 | ห้องระบุเป็นตัวเลข: 1, 2, 3</span>
                  <button 
                    type="button" 
                    onClick={downloadImportTemplate}
                    className="text-emerald-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <FaDownload /> ดาวน์โหลดเทมเพลต Excel
                  </button>
                </div>
              </div>

              <div 
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.backgroundColor = "rgba(16, 185, 129, 0.05)"; }}
                onDragLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(16, 185, 129, 0.02)"; }}
                onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file) processExcelFile(file); }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-emerald-500 rounded-xl p-8 text-center cursor-pointer bg-emerald-50/10 hover:bg-emerald-50/20 transition duration-200 flex flex-col items-center justify-center"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) processExcelFile(file); }}
                  className="hidden"
                />
                <FaFileImport className="text-4xl text-emerald-500 mb-2.5" />
                <span className="text-sm font-bold text-slate-700 block">คลิกเพื่อเลือกไฟล์ หรือ ลากไฟล์ Excel / CSV มาวางที่นี่</span>
              </div>

              {fileName && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 flex justify-between items-center">
                  <span className="font-bold truncate max-w-[85%]">📂 {fileName}</span>
                  <button 
                    onClick={() => { setFileName(""); setTempParsedStudents([]); }}
                    className="text-rose-500 hover:text-rose-600 font-bold text-sm"
                  >
                    <FaTrash />
                  </button>
                </div>
              )}

              {tempParsedStudents.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="text-sm font-bold text-slate-700 flex items-center justify-between">
                    <span>ข้อมูลตรวจพบ ({tempParsedStudents.length} รายการ)</span>
                  </h4>

                  <div className="max-h-[220px] overflow-y-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10 font-bold text-slate-700">
                        <tr>
                          <th className="p-2.5">ลำดับ</th>
                          <th className="p-2.5">ชื่อ-นามสกุล</th>
                          <th className="p-2.5">รหัสนักเรียน</th>
                          <th className="p-2.5">ระดับชั้น</th>
                          <th className="p-2.5">ห้อง</th>
                          <th className="p-2.5">รหัสผ่าน</th>
                          <th className="p-2.5 text-right">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {tempParsedStudents.map((std, idx) => (
                          <tr key={idx} className={std.isValid ? "hover:bg-slate-50/50" : "bg-rose-50/30 hover:bg-rose-50/50"}>
                            <td className="p-2.5 text-slate-400 font-medium">{idx + 1}</td>
                            <td className="p-2.5 font-bold text-slate-700">{std.name || "-"}</td>
                            <td className="p-2.5 font-mono text-slate-600">{std.code || "-"}</td>
                            <td className="p-2.5">{std.class ? (std.class === "m3" ? "ม.3" : std.class === "m2" ? "ม.2" : "ม.1") : "-"}</td>
                            <td className="p-2.5">{std.room ? `ห้อง ${std.room}` : "-"}</td>
                            <td className="p-2.5 font-mono">{std.password}</td>
                            <td className="p-2.5 text-right font-semibold">
                              {std.isValid ? (
                                <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full">ผ่าน</span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 rounded-full cursor-help" title={std.errors.join(", ")}>ไม่ผ่าน</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => { setIsExcelModalOpen(false); setTempParsedStudents([]); setFileName(""); }}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-100 transition text-sm font-semibold"
              >
                ยกเลิก
              </button>
              <button 
                type="button" 
                onClick={confirmExcelImport} 
                disabled={tempParsedStudents.filter(s => s.isValid).length === 0 || isPending}
                className="px-5 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition text-sm font-bold shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                <FaFileImport /> นำเข้ารายชื่อนักเรียน
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
