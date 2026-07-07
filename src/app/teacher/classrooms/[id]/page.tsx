"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getClassroomDetails, importStudentsToClassroom } from "@/app/actions/classroom";
import * as XLSX from "xlsx";
import { 
  FaArrowLeft, 
  FaFileExcel,
  FaFileImport, 
  FaUserPlus, 
  FaUsers, 
  FaDownload, 
  FaTimes, 
  FaTrash,
  FaCheckCircle,
  FaExclamationCircle,
  FaCloudUploadAlt,
  FaHashtag,
  FaPhone
} from "react-icons/fa";

interface Student {
  id: string;
  name: string;
  avatarUrl: string | null;
  status: string;
  passwordHint: string | null;
}

interface Classroom {
  id: string;
  name: string;
  yearLevel: string;
  room: string;
  academicYear: string;
}

interface ParsedStudent {
  name: string;
  code: string;
  class: string;
  room: string;
  phone: string;
  password: string;
  isValid: boolean;
  errors: string[];
}

export default function ClassroomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;

  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // States สำหรับ Excel Import Modal (ตรงตามเดโม่)
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [tempParsedStudents, setTempParsedStudents] = useState<ParsedStudent[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States สำหรับเพิ่มนักเรียนทีละคน
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [singleStudentName, setSingleStudentName] = useState("");
  const [singleStudentPassword, setSingleStudentPassword] = useState("");

  const [isPending, startTransition] = useTransition();
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error", text: string } | null>(null);

  useEffect(() => {
    loadClassroomDetails();
  }, [classId]);

  const loadClassroomDetails = async () => {
    setIsLoading(true);
    const data = await getClassroomDetails(classId);
    if (data) {
      setClassroom(data.classroom);
      setStudents(data.students);
    } else {
      showToast("error", "ไม่สามารถโหลดข้อมูลห้องเรียนได้");
    }
    setIsLoading(false);
  };

  const showToast = (type: "success" | "error", text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // ดาวน์โหลดไฟล์เทมเพลต Excel ตรงตามเดโม่
  const downloadStudentImportTemplate = () => {
    const headers = [["ชื่อ-นามสกุล", "รหัสนักเรียน", "ระดับชั้น (m1/m2/m3)", "ห้องเรียน (1/2/3)", "เบอร์โทรผู้ปกครอง", "รหัสผ่าน (เว้นว่างระบบจะสุ่ม 4 หลัก)"]];
    const sampleData = [
      ["นายสมชาย รักเรียน", "660104", "m3", "1", "0812345678", "1234"],
      ["นางสาวสมหญิง รักดี", "660105", "m3", "1", "0898765432", ""],
      ["เด็กชายเดชา เก่งกล้า", "670104", "m3", "1", "0855551234", "9999"]
    ];

    const wsData = headers.concat(sampleData);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!cols'] = [
      { wch: 25 },
      { wch: 15 },
      { wch: 22 },
      { wch: 18 },
      { wch: 20 },
      { wch: 28 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "รายชื่อนักเรียน");
    XLSX.writeFile(wb, "Template_Import_Students.xlsx");
    showToast("success", "ดาวน์โหลดไฟล์เทมเพลต Excel เรียบร้อยแล้ว");
  };

  // ถอดรหัสและประมวลผลไฟล์ Excel ในเว็บเบราว์เซอร์พร้อมระบบ Validation เหมือนเดโม่
  const processExcelFile = (file: File) => {
    setFileName(`${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        if (rows.length < 2) {
          showToast("error", "ไฟล์ไม่มีข้อมูลรายชื่อนักเรียน หรือมีเพียงหัวข้อคอลัมน์");
          return;
        }

        const parsedList: ParsedStudent[] = [];

        // กำหนดข้อมูลเทียบเคียงห้องเรียนปัจจุบัน
        const currentClassLevel = classroom?.yearLevel || ""; // เช่น "ม.3"
        const currentClassRoom = classroom?.room || ""; // เช่น "1"

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0 || (row.length === 1 && !row[0])) continue;

          const rawName = String(row[0] || "").trim();
          const rawCode = String(row[1] || "").trim();
          const rawClass = String(row[2] || "").trim().toLowerCase();
          const rawRoom = String(row[3] || "").trim();
          const rawPhone = String(row[4] || "").trim();
          const rawPassword = String(row[5] || "").trim();

          if (!rawName && !rawCode && !rawClass && !rawRoom && !rawPhone) continue;

          const errors: string[] = [];
          let studentClass = "";
          let studentRoom = "";

          if (!rawName) {
            errors.push("กรุณาระบุชื่อ-นามสกุล");
          }
          if (!rawCode) {
            errors.push("กรุณาระบุรหัสประจำตัว");
          }

          // Validation ระดับชั้น
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
              errors.push("ระดับชั้นไม่ถูกต้อง (ระบุ m1, m2, หรือ m3)");
            }
          }

          // Validation ห้องเรียน
          if (!rawRoom) {
            errors.push("กรุณาระบุห้องเรียน");
          } else {
            const matchNum = rawRoom.match(/[1-3]/);
            if (matchNum) {
              studentRoom = matchNum[0];
            } else {
              errors.push("ห้องเรียนไม่ถูกต้อง (ระบุ 1, 2, หรือ 3)");
            }
          }

          // ตรวจสอบว่าตรงกับห้องเรียนปัจจุบันในหน้านี้หรือไม่
          if (studentClass && studentRoom) {
            const mappedClassLevel = studentClass === "m3" ? "ม.3" : studentClass === "m2" ? "ม.2" : "ม.1";
            if (mappedClassLevel !== currentClassLevel || studentRoom !== currentClassRoom) {
              errors.push(`ชั้น/ห้องเรียนไม่ตรงกับห้องนี้ (${currentClassLevel}/${currentClassRoom})`);
            }
          }

          const isValid = errors.length === 0;
          // สุ่มรหัสผ่าน 4 หลักหากเว้นว่างไว้ ตามระบบเดโม่
          const password = isValid 
            ? (rawPassword && /^\d{4}$/.test(rawPassword) ? rawPassword : String(Math.floor(1000 + Math.random() * 9000))) 
            : "";

          parsedList.push({
            name: rawName,
            code: rawCode,
            class: studentClass,
            room: studentRoom,
            phone: rawPhone,
            password: password,
            isValid,
            errors
          });
        }

        setTempParsedStudents(parsedList);
      } catch (err) {
        showToast("error", "ไม่สามารถอ่านไฟล์ได้ กรุณาใช้ไฟล์ตามแม่แบบเทมเพลต");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExcelSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processExcelFile(file);
  };

  const handleExcelDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processExcelFile(file);
  };

  // ยืนยันนำเข้าข้อมูลนักเรียน
  const confirmExcelImport = () => {
    const validStudents = tempParsedStudents.filter(s => s.isValid);
    if (validStudents.length === 0) return;

    const namesToImport = validStudents.map(s => s.name);

    startTransition(async () => {
      const res = await importStudentsToClassroom(classId, namesToImport);
      if (res.success) {
        showToast("success", res.message || "นำเข้ารายชื่อนักเรียนเรียบร้อยแล้ว");
        setIsExcelModalOpen(false);
        setTempParsedStudents([]);
        setFileName("");
        loadClassroomDetails();
      } else {
        showToast("error", res.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }
    });
  };

  // เพิ่มนักเรียนทีละคน
  const handleSingleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!singleStudentName.trim()) return;

    startTransition(async () => {
      const res = await importStudentsToClassroom(classId, [singleStudentName], singleStudentPassword);
      if (res.success) {
        showToast("success", "เพิ่มนักเรียนเข้าห้องเรียนเรียบร้อยแล้ว");
        setIsSingleModalOpen(false);
        setSingleStudentName("");
        setSingleStudentPassword("");
        loadClassroomDetails();
      } else {
        showToast("error", res.error || "เกิดข้อผิดพลาด");
      }
    });
  };

  const validStudentsCount = tempParsedStudents.filter(s => s.isValid).length;
  const invalidStudentsCount = tempParsedStudents.filter(s => !s.isValid).length;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[300px] text-slate-500 font-medium">
        กำลังโหลดข้อมูลห้องเรียน...
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="bg-white p-8 rounded-2xl border text-center text-slate-500 space-y-4 max-w-md mx-auto mt-12 shadow-sm">
        <FaExclamationCircle className="text-4xl text-rose-500 mx-auto animate-bounce" />
        <p className="text-lg font-bold">ไม่พบข้อมูลห้องเรียนนี้ในระบบ</p>
        <Link href="/teacher/classrooms" className="inline-block px-5 py-2.5 bg-sky-500 text-white font-bold rounded-xl hover:bg-sky-600 transition">
          กลับหน้ารายชื่อห้องเรียน
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* Toast Alert แจ้งเตือน */}
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

      {/* แถบหัวข้อย่อยและเมนูปุ่มกระทำ */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-4">
          <Link 
            href="/teacher/classrooms"
            className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-full hover:bg-slate-50 transition shadow-sm"
          >
            <FaArrowLeft />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{classroom.name}</h1>
            <p className="text-sm text-slate-500 mt-1">ระดับชั้น {classroom.yearLevel}/{classroom.room} | ปีการศึกษา {classroom.academicYear}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setIsSingleModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition text-sm shadow-sm"
          >
            <FaUserPlus className="text-sky-500" />
            <span>เพิ่มนักเรียนทีละคน</span>
          </button>
          
          <button
            onClick={() => setIsExcelModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition text-sm shadow-md"
          >
            <FaFileExcel />
            <span>นำเข้าไฟล์ Excel / CSV</span>
          </button>
        </div>
      </div>

      {/* รายชื่อนักเรียน */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FaUsers className="text-sky-500" /> รายชื่อนักเรียนในห้องเรียนนี้ ({students.length} คน)
          </h3>
          
          <div className="text-xs bg-sky-50 border border-sky-100 text-sky-700 px-3 py-2 rounded-xl flex items-center gap-2 max-w-md text-left font-semibold">
            <span>💡 <strong>ล็อกอินของนักเรียน:</strong> ใช้ <u>ชื่อ-นามสกุลจริง</u> (ไม่มีคำนำหน้าเหมือนในตาราง) เป็น Username และรหัสผ่านคือ <span className="font-mono bg-sky-100 px-1 py-0.5 rounded font-black text-sky-800">student</span></span>
          </div>
        </div>

        {students.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-3">
            <FaUsers className="text-5xl mx-auto text-slate-200" />
            <p className="text-sm font-bold text-slate-500">ยังไม่มีรายชื่อนักเรียนในห้องนี้</p>
            <p className="text-xs text-slate-400">คุณครูสามารถกดนำเข้ารายชื่อผ่าน Excel เพื่อแบ่งปัน Account ให้นักเรียนล็อกอินได้เลยครับ</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="text-slate-400 border-b border-slate-200">
                  <th className="pb-3.5 font-medium pl-2 w-16">ลำดับ</th>
                  <th className="pb-3.5 font-medium">ชื่อ-นามสกุล</th>
                  <th className="pb-3.5 font-medium">ชื่อเข้าใช้งาน (Username)</th>
                  <th className="pb-3.5 font-medium">รหัสผ่านเริ่มต้น</th>
                  <th className="pb-3.5 font-medium text-right pr-2">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((std, idx) => (
                  <tr key={std.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-4 pl-2 font-medium text-slate-500">{idx + 1}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center font-bold text-xs">
                          {std.name.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-700">{std.name}</span>
                      </div>
                    </td>
                    <td className="py-4 font-mono text-xs text-slate-600 font-semibold">{std.name}</td>
                    <td className="py-4">
                      <span className="font-mono bg-sky-50 text-sky-700 border border-sky-100 px-2 py-0.5 rounded text-xs font-bold">
                        {std.passwordHint || "student"}
                      </span>
                    </td>
                    <td className="py-4 text-right pr-2">
                      <span className="inline-block px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                        {std.status === "ACTIVE" ? "กำลังเรียน" : "ซ้ำชั้น"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Excel Import Modal (ป๊อปอัปตามดีไซน์ของเดโม่) */}
      {isExcelModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-[750px] rounded-2xl shadow-xl overflow-hidden animate-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
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

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[500px] overflow-y-auto">
              
              {/* Step 1: Instruction Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <span className="font-bold text-xs text-slate-700 flex items-center gap-1">
                  <FaExclamationCircle className="text-sky-500" />
                  ข้อแนะนำการเตรียมไฟล์:
                </span>
                <p className="text-xs text-slate-500 leading-relaxed">
                  กรุณาจัดเตรียมไฟล์ Excel (.xlsx, .xls) หรือ CSV (.csv) โดยมีคอลัมน์และลำดับหัวตารางดังนี้ (แถวแรกสุด):
                </p>

                {/* ตัวอย่างหัวตาราง */}
                <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg p-2">
                  <table className="w-full text-left text-[11px] border-collapse min-w-[550px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 font-bold text-slate-700">
                        <th className="p-1.5">ชื่อ-นามสกุล</th>
                        <th className="p-1.5">รหัสนักเรียน</th>
                        <th className="p-1.5">ระดับชั้น (m1/m2/m3)</th>
                        <th className="p-1.5">ห้องเรียน (1/2/3)</th>
                        <th className="p-1.5">เบอร์โทรผู้ปกครอง</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-slate-500 font-medium">
                        <td className="p-1.5">นายสมชาย รักเรียน</td>
                        <td className="p-1.5 font-mono">660104</td>
                        <td className="p-1.5 font-mono">m3</td>
                        <td className="p-1.5 font-mono">1</td>
                        <td className="p-1.5">0812345678</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center flex-wrap gap-2 text-[10px] text-slate-400">
                  <span>* ระดับชั้นระบุเป็น: m1 (ม.1), m2 (ม.2), m3 (ม.3) | ห้องระบุเป็นตัวเลข: 1, 2, 3</span>
                  <button 
                    type="button" 
                    onClick={downloadStudentImportTemplate}
                    className="text-emerald-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <FaDownload /> ดาวน์โหลดเทมเพลต Excel
                  </button>
                </div>
              </div>

              {/* Step 2: Drop Zone */}
              <div 
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.backgroundColor = "rgba(16, 185, 129, 0.05)"; }}
                onDragLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(16, 185, 129, 0.02)"; }}
                onDrop={handleExcelDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-emerald-500 rounded-xl p-8 text-center cursor-pointer bg-emerald-50/10 hover:bg-emerald-50/20 transition duration-200 relative flex flex-col items-center justify-center"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelSelect}
                  className="hidden"
                />
                <FaCloudUploadAlt className="text-4xl text-emerald-500 mb-2.5" />
                <span className="text-sm font-bold text-slate-700 block">คลิกเพื่อเลือกไฟล์ หรือ ลากไฟล์ Excel / CSV มาวางที่นี่</span>
                <span className="text-xs text-slate-400 block mt-1">รองรับไฟล์ .xlsx, .xls, .csv ขนาดไม่เกิน 5MB</span>
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

              {/* Step 3: Validation & Preview Section */}
              {tempParsedStudents.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <h4 className="text-sm font-bold text-slate-700 flex items-center justify-between">
                    <span>ตารางแสดงข้อมูลตัวอย่างที่ตรวจพบ ({tempParsedStudents.length} รายการ)</span>
                    
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                      validStudentsCount > 0 
                        ? "bg-emerald-100 text-emerald-700" 
                        : "bg-rose-100 text-rose-700"
                    }`}>
                      {validStudentsCount > 0 
                        ? `ตรวจสอบสำเร็จ (ผ่าน ${validStudentsCount} / ไม่ผ่าน ${invalidStudentsCount})` 
                        : "ไม่พบข้อมูลที่ผ่านเกณฑ์การตรวจสอบ"}
                    </span>
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
                          <th className="p-2.5">เบอร์โทรผู้ปกครอง</th>
                          <th className="p-2.5">รหัสผ่าน (สุ่ม)</th>
                          <th className="p-2.5 text-right">สถานะการตรวจสอบ</th>
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
                            <td className="p-2.5">{std.phone || "-"}</td>
                            <td className="p-2.5">
                              {std.isValid ? (
                                <span className="font-mono bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded font-bold">{std.password}</span>
                              ) : "-"}
                            </td>
                            <td className="p-2.5 text-right font-semibold">
                              {std.isValid ? (
                                <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full">ผ่าน</span>
                              ) : (
                                <span 
                                  className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 rounded-full cursor-help"
                                  title={std.errors.join(", ")}
                                >
                                  ไม่ผ่าน ({std.errors.length})
                                </span>
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

            {/* Modal Footer */}
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
                disabled={validStudentsCount === 0 || isPending}
                className="px-5 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition text-sm font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <FaFileImport /> นำเข้ารายชื่อนักเรียน
              </button>
            </div>

          </div>
        </div>
      )}

      {/* เพิ่มนักเรียนทีละคน (Modal) */}
      {isSingleModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-6 space-y-6 animate-in zoom-in duration-200">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FaUserPlus className="text-sky-500" />
                <span>เพิ่มนักเรียนใหม่</span>
              </h2>
              <button 
                onClick={() => setIsSingleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl transition"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSingleSubmit} className="space-y-4">
              
              {/* ข้อมูลจำลองรหัสนักเรียน */}
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 font-bold">
                <FaHashtag className="text-sky-500 text-sm" />
                <span>รหัสนักเรียนถัดไป:</span>
                <span className="text-sm font-bold text-sky-600">STU-{String(students.length + 1).padStart(3, "0")}</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase">ชื่อ-นามสกุล <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  disabled={isPending}
                  value={singleStudentName}
                  onChange={(e) => setSingleStudentName(e.target.value)}
                  placeholder="เช่น สมชาย ขยันเรียน"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">ระดับชั้น</label>
                  <input
                    type="text"
                    disabled
                    value={classroom.yearLevel}
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm opacity-75 text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">ห้อง</label>
                  <input
                    type="text"
                    disabled
                    value={`ห้อง ${classroom.room}`}
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm opacity-75 text-slate-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase">เบอร์โทรผู้ปกครอง</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <FaPhone className="text-xs" />
                  </span>
                  <input
                    type="text"
                    disabled={isPending}
                    placeholder="เช่น 0812345678"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* ช่องกรอกรหัสผ่าน พร้อมปุ่มสุ่มรหัสผ่าน 4 หลัก */}
              <div className="space-y-1.5 text-left">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700 uppercase">รหัสผ่านของนักเรียน *</label>
                  <button
                    type="button"
                    onClick={() => {
                      const randomCode = String(Math.floor(1000 + Math.random() * 9000));
                      setSingleStudentPassword(randomCode);
                    }}
                    className="text-[10px] text-sky-500 hover:text-sky-600 font-black hover:underline"
                  >
                    🎲 สุ่มรหัสผ่าน 4 หลัก
                  </button>
                </div>
                <input
                  type="text"
                  required
                  disabled={isPending}
                  value={singleStudentPassword}
                  onChange={(e) => setSingleStudentPassword(e.target.value)}
                  placeholder="เช่น 1234 หรือ student"
                  maxLength={10}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition"
                />
              </div>

              {/* ปุ่มควบคุม */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setIsSingleModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isPending || !singleStudentName.trim()}
                  className="px-4 py-2.5 bg-sky-500 text-white font-bold rounded-xl hover:bg-sky-600 transition shadow-sm disabled:opacity-50"
                >
                  {isPending ? "กำลังบันทึก..." : "เพิ่มนักเรียน"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
