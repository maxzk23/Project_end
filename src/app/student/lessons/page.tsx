"use client";

import { useEffect, useState } from "react";
import { getStudentDefaultClass, getStudentMaterials } from "@/app/actions/student";
import { getStudentClassrooms } from "@/app/actions/classroom";
import { 
  FaBookOpen, 
  FaFilePowerpoint, 
  FaFileVideo, 
  FaLink, 
  FaFileAlt, 
  FaEye, 
  FaPlay, 
  FaExclamationCircle 
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
  title: string;
  type: MaterialType;
  fileUrl: string;
  createdAt: Date;
}

export default function StudentLessonsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initData = async () => {
      const classes = await getStudentClassrooms();
      setClassrooms(classes);
      
      const defaultClass = await getStudentDefaultClass();
      if (defaultClass) {
        setSelectedClassId(defaultClass.id);
      } else if (classes.length > 0) {
        setSelectedClassId(classes[0].id);
      } else {
        setIsLoading(false);
      }
    };
    initData();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadMaterials();

      // ดึงข้อมูลอัตโนมัติทุกๆ 3 วินาที (Polling) เพื่ออัปเดตเรียลไทม์ข้ามเบราว์เซอร์
      const interval = setInterval(() => {
        loadMaterials();
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [selectedClassId]);

  // รับการอัปเดตแบบเรียลไทม์เมื่อคุณครูสลับตัวล็อกสื่อการเรียนการสอน
  useEffect(() => {
    const bc = new BroadcastChannel("lms-channel");
    bc.onmessage = (event) => {
      if (event.data?.type === "MATERIAL_TOGGLED") {
        loadMaterials();
      }
    };
    return () => {
      bc.close();
    };
  }, [selectedClassId]);

  const loadMaterials = async () => {
    setIsLoading(true);
    const data = await getStudentMaterials(selectedClassId);
    setMaterials(data as Material[]);
    setIsLoading(false);
  };

  const getMaterialIcon = (type: MaterialType) => {
    switch (type) {
      case "SLIDE":
        return <FaFilePowerpoint className="text-orange-500 text-3xl" />;
      case "VIDEO":
        return <FaFileVideo className="text-blue-500 text-3xl" />;
      case "LINK":
        return <FaLink className="text-purple-500 text-3xl" />;
      default:
        return <FaFileAlt className="text-slate-500 text-3xl" />;
    }
  };

  const getActionButton = (type: MaterialType, url: string) => {
    const text = type === "VIDEO" ? "เล่นคลิป" : type === "SLIDE" ? "เปิดดูสไลด์" : "เปิดดูลิงก์";
    const icon = type === "VIDEO" ? <FaPlay /> : <FaEye />;
    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="px-4 py-2 bg-sky-500 text-white rounded-full text-xs font-bold flex items-center gap-2 hover:bg-sky-600 shadow-sm transition-transform hover:scale-[1.02]"
      >
        {icon}
        <span>{text}</span>
      </a>
    );
  };

  return (
    <div className="space-y-8">
      
      {/* ส่วนหัวของหน้านักเรียน */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FaBookOpen className="text-sky-500" /> สื่อการเรียนและบทเรียนย้อนหลัง
          </h1>
          <p className="text-sm text-slate-500 mt-1">เข้าดูสไลด์ ทบทวนบทเรียน หรือรับชมวิดีโอสอนสอนเสริมย้อนหลัง</p>
        </div>

        {classrooms.find(c => c.id === selectedClassId) && (
          <div className="px-4 py-2.5 bg-sky-50 border border-sky-150 rounded-xl text-xs font-black text-sky-700 select-none shadow-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
            <span>{classrooms.find(c => c.id === selectedClassId)?.name} ({classrooms.find(c => c.id === selectedClassId)?.yearLevel}/{classrooms.find(c => c.id === selectedClassId)?.room})</span>
          </div>
        )}
      </div>

      {classrooms.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border text-center text-slate-500">
          <FaExclamationCircle className="text-5xl mx-auto text-amber-500 mb-4" />
          <p className="text-lg font-bold">ยังไม่ได้เข้าห้องเรียนใดๆ</p>
          <p className="text-sm opacity-75 mt-1">กรุณารอคุณครูเพิ่มชื่อเข้าห้องเรียน เพื่อให้สามารถเข้าดูเนื้อหาได้ครับ</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 font-medium">กำลังโหลดข้อมูลบทเรียน...</div>
          ) : materials.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <FaBookOpen className="text-5xl mx-auto text-slate-200" />
              <p className="text-sm font-bold">ยังไม่มีสื่อประกอบการสอนที่เปิดให้เรียนรู้</p>
              <p className="text-xs opacity-75">คุณครูยังไม่ได้ทำรายการปลดล็อกสไลด์ในสัปดาห์นี้ครับ</p>
            </div>
          ) : (
            <div className="space-y-4">
              {materials.map((m) => (
                <div 
                  key={m.id} 
                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-sky-300 hover:bg-sky-50/50 transition-all gap-4 cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="group-hover:scale-105 transition-transform">{getMaterialIcon(m.type)}</div>
                    <div>
                      <h5 className="font-bold text-slate-800 text-sm group-hover:text-sky-600 transition-colors">{m.title}</h5>
                      <span className="text-[10px] text-slate-400 block mt-1">ประเภท: {m.type} | โพสต์เมื่อ: {new Date(m.createdAt).toLocaleDateString("th-TH")}</span>
                    </div>
                  </div>
                  <div className="self-end sm:self-auto shrink-0">
                    {getActionButton(m.type, m.fileUrl)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
