"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { updateProfile } from "@/app/actions/profile";
import { 
  FaUser, 
  FaLock, 
  FaKey, 
  FaSave, 
  FaExclamationCircle, 
  FaCheckCircle,
  FaArrowLeft,
  FaChevronDown,
  FaChevronUp,
  FaCheck,
  FaSmile,
  FaCopy,
  FaIdBadge,
  FaSun,
  FaMoon,
  FaDesktop
} from "react-icons/fa";


// รายชื่อหมวดหมู่อวาตาร์
export const AVATAR_CATEGORIES = [
  { id: "all", label: "ทั้งหมด" },
  { id: "study", label: "การเรียน & ไอที 💻" },
  { id: "animal", label: "สัตว์น่ารัก 🐾" },
  { id: "scifi", label: "เกมเมอร์ & ไซไฟ 🚀" },
  { id: "fun", label: "ฮีโร่ & กิจกรรม 🏆" },
  { id: "art", label: "ศิลปะ & ดนตรี 🎨" },
];

// รายชื่ออวาตาร์ Preset หลากหลายสไตล์ (30 แบบ)
export const AVATAR_PRESETS = [
  // 1. หมวดพื้นฐานยอดนิยม
  { id: "preset-1", emoji: "🎓", label: "นักเรียนดีเด่น", category: "study", gradient: "from-sky-400 to-indigo-500" },
  { id: "preset-2", emoji: "🚀", label: "นักบินอวกาศ", category: "scifi", gradient: "from-emerald-400 to-teal-500" },
  { id: "preset-3", emoji: "👾", label: "เกมเมอร์", category: "scifi", gradient: "from-rose-400 to-red-500" },
  { id: "preset-4", emoji: "🧪", label: "นักวิทย์น้อย", category: "study", gradient: "from-violet-400 to-fuchsia-500" },
  { id: "preset-5", emoji: "🎨", label: "ศิลปิน", category: "art", gradient: "from-amber-400 to-orange-500" },
  { id: "preset-6", emoji: "🐱", label: "แมวน้อย", category: "animal", gradient: "from-slate-400 to-zinc-500" },

  // 2. หมวดการเรียน & เทคโนโลยี
  { id: "preset-7", emoji: "💻", label: "โปรแกรมเมอร์", category: "study", gradient: "from-cyan-400 to-blue-600" },
  { id: "preset-8", emoji: "📚", label: "หนอนหนังสือ", category: "study", gradient: "from-teal-400 to-emerald-600" },
  { id: "preset-9", emoji: "🤖", label: "หุ่นยนต์ AI", category: "scifi", gradient: "from-indigo-400 to-purple-600" },
  { id: "preset-10", emoji: "🧩", label: "นักแก้ปริศนา", category: "study", gradient: "from-sky-400 to-teal-500" },
  { id: "preset-11", emoji: "⚡", label: "สายฟ้าพลังงาน", category: "scifi", gradient: "from-yellow-400 to-amber-500" },
  { id: "preset-12", emoji: "🛸", label: "ยานยูเอฟโอ", category: "scifi", gradient: "from-violet-500 to-purple-700" },

  // 3. หมวดสัตว์น่ารัก & มาสคอต
  { id: "preset-13", emoji: "🐶", label: "เจ้าตูบแสนรู้", category: "animal", gradient: "from-amber-400 to-orange-500" },
  { id: "preset-14", emoji: "🐼", label: "แพนด้าชิลล์", category: "animal", gradient: "from-slate-500 to-zinc-700" },
  { id: "preset-15", emoji: "🦊", label: "จิ้งจอกเจ้าปัญญา", category: "animal", gradient: "from-orange-400 to-rose-500" },
  { id: "preset-16", emoji: "🦁", label: "สิงโตผู้กล้า", category: "animal", gradient: "from-yellow-500 to-amber-600" },
  { id: "preset-17", emoji: "🦉", label: "นกฮูกปราชญ์", category: "animal", gradient: "from-blue-500 to-indigo-600" },
  { id: "preset-18", emoji: "🐰", label: "กระต่ายสดใส", category: "animal", gradient: "from-pink-400 to-rose-400" },
  { id: "preset-19", emoji: "🦄", label: "ยูนิคอร์น", category: "animal", gradient: "from-pink-300 to-purple-400" },
  { id: "preset-20", emoji: "🐯", label: "เสือสายลุย", category: "animal", gradient: "from-amber-500 to-orange-600" },

  // 4. หมวดฮีโร่ & กิจกรรม & กีฬา
  { id: "preset-21", emoji: "👑", label: "ราชา/ราชินี", category: "fun", gradient: "from-amber-300 to-yellow-500" },
  { id: "preset-22", emoji: "🏆", label: "แชมเปี้ยน", category: "fun", gradient: "from-yellow-400 to-orange-500" },
  { id: "preset-23", emoji: "🌟", label: "ซูเปอร์สตาร์", category: "fun", gradient: "from-fuchsia-400 to-pink-500" },
  { id: "preset-24", emoji: "🧙‍♂️", label: "พ่อมดมนตรา", category: "fun", gradient: "from-purple-500 to-indigo-600" },
  { id: "preset-25", emoji: "🦸‍♂️", label: "ซูเปอร์ฮีโร่", category: "fun", gradient: "from-blue-500 to-rose-500" },
  { id: "preset-26", emoji: "🥷", label: "นินจาล่องหน", category: "fun", gradient: "from-slate-700 to-zinc-900" },
  { id: "preset-27", emoji: "⚽", label: "นักเตะแข้งทอง", category: "fun", gradient: "from-emerald-400 to-green-600" },
  { id: "preset-28", emoji: "🏀", label: "สแลมดังก์", category: "fun", gradient: "from-orange-500 to-red-600" },
  { id: "preset-29", emoji: "🎯", label: "มือแม่นเป้า", category: "fun", gradient: "from-rose-500 to-red-600" },

  // 5. หมวดศิลปะ & ดนตรี
  { id: "preset-30", emoji: "🎸", label: "ร็อกสตาร์", category: "art", gradient: "from-purple-500 to-pink-600" },
];

// Helper สำหรับเรนเดอร์อวาตาร์
export function renderAvatarHelper(avatarUrl: string | null | undefined, name: string, className = "w-16 h-16 text-2xl") {
  const preset = AVATAR_PRESETS.find(p => p.id === avatarUrl);
  if (preset) {
    return (
      <div className={`rounded-full bg-gradient-to-br ${preset.gradient} text-white flex items-center justify-center shadow-sm shrink-0 ${className}`}>
        {preset.emoji}
      </div>
    );
  }
  
  if (avatarUrl && avatarUrl.startsWith("http")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt={name} className={`rounded-full object-cover border border-slate-200 shrink-0 ${className}`} />
    );
  }

  // Fallback: ใช้ตัวอักษรตัวแรกของชื่อ
  const firstLetter = name ? name.trim().charAt(0) : "?";
  return (
    <div className={`rounded-full bg-sky-100 text-sky-700 font-bold flex items-center justify-center border border-sky-200 shrink-0 ${className}`}>
      {firstLetter}
    </div>
  );
}

interface ProfileSettingsProps {
  initialUser: {
    id: string;
    name: string;
    role: string;
    avatarUrl: string | null;
    status: string;
    studentId?: string | null;
    createdAt: Date;
  };
}

export default function ProfileSettings({ initialUser }: ProfileSettingsProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(
    initialUser.avatarUrl && AVATAR_PRESETS.some(p => p.id === initialUser.avatarUrl)
      ? initialUser.avatarUrl
      : "preset-1"
  );


  // สถานะขยายดูรูปโปรไฟล์เพิ่มเติม และเลือกหมวดหมู่
  const isSelectedBeyondInitial = Boolean(
    initialUser.avatarUrl && AVATAR_PRESETS.findIndex(p => p.id === initialUser.avatarUrl) >= 6
  );
  const [isExpanded, setIsExpanded] = useState(isSelectedBeyondInitial);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // เช็คว่าผู้ใช้เป็นครูหรือแอดมิน (มีสิทธิ์แก้ชื่อจริง) หรือไม่
  const canEditName = initialUser.role === "TEACHER" || initialUser.role === "ADMIN";

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return {
          label: "ผู้ดูแลระบบ (Admin)",
          className: "bg-rose-100 text-rose-700 border-rose-200"
        };
      case "TEACHER":
        return {
          label: "คุณครูผู้สอน",
          className: "bg-sky-100 text-sky-700 border-sky-200"
        };
      default:
        return {
          label: "นักเรียน",
          className: "bg-purple-100 text-purple-700 border-purple-200"
        };
    }
  };

  const getUidLabel = (role: string) => {
    switch (role) {
      case "TEACHER":
        return "UID บัญชีของคุณครู";
      case "ADMIN":
        return "UID บัญชีผู้ดูแลระบบ";
      default:
        return "UID บัญชีนักเรียน";
    }
  };

  // กรองรายการอวาตาร์ตามสถานะการขยายและหมวดหมู่ที่เลือก
  const displayedPresets = isExpanded
    ? (selectedCategory === "all" 
        ? AVATAR_PRESETS 
        : AVATAR_PRESETS.filter(p => p.category === selectedCategory))
    : AVATAR_PRESETS.slice(0, 6);

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const formData = new FormData(event.currentTarget);
    
    // ตั้งค่ารูปอวาตาร์ที่เลือกส่งไปหลังบ้านสำหรับผู้ใช้ทุกคน
    formData.set("avatarUrl", selectedAvatar);

    startTransition(async () => {
      const res = await updateProfile(null, formData);
      if (res.success) {
        setSuccessMsg(res.message || "อัปเดตข้อมูลสำเร็จ");

        // ส่งสัญญาณบอก Topbar และคอมโพเนนต์อื่นให้รีเฟรชโปรไฟล์ทันที
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("profile-updated"));
          try {
            const bc = new BroadcastChannel("lms-channel");
            bc.postMessage({ type: "PROFILE_UPDATED" });
            bc.close();
          } catch (e) {
            console.error("BroadcastChannel error:", e);
          }
        }

        router.refresh(); // รีเฟรชข้อมูลหน้าบ้านทั้งหมด
      } else {
        setErrorMsg(res.error || "เกิดข้อผิดพลาดในการอัปเดต");
      }
    });
  };

  const roleInfo = getRoleBadge(initialUser.role);
  const uidLabel = getUidLabel(initialUser.role);
  const loginUid = initialUser.studentId || initialUser.name;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* ส่วนหัวของฟอร์ม */}
      <div className="flex items-center gap-4 mb-4">
        <button 
          onClick={() => router.back()} 
          className="p-2 bg-white border border-slate-200 text-slate-600 rounded-full hover:bg-slate-50 transition cursor-pointer"
        >
          <FaArrowLeft />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">จัดการโปรไฟล์ส่วนตัว</h2>
          <p className="text-sm text-slate-500 mt-1">
            แก้ไขและอัปเดตข้อมูลประวัติส่วนตัวของคุณ ({initialUser.role === "ADMIN" ? "ผู้ดูแลระบบ" : initialUser.role === "TEACHER" ? "คุณครูผู้สอน" : "นักเรียน"})
          </p>
        </div>
      </div>

      {/* แจ้งเตือนสถานะการกดบันทึก */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-start gap-3 animate-in fade-in">
          <FaExclamationCircle className="text-lg mt-0.5 shrink-0" />
          <span className="text-sm font-semibold">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl flex items-start gap-3 animate-in fade-in">
          <FaCheckCircle className="text-lg mt-0.5 shrink-0" />
          <span className="text-sm font-semibold">{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* คอลัมน์ซ้าย: บัตรข้อมูลส่วนตัวย่อ */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center space-y-4 self-start">
          {renderAvatarHelper(
            selectedAvatar,
            initialUser.name,
            "w-24 h-24 text-4xl shadow-sm"
          )}
          
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-800">{initialUser.name}</h3>
            <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full border ${roleInfo.className}`}>
              {roleInfo.label}
            </span>
          </div>

          <div className="w-full border-t border-slate-100 pt-4 space-y-2.5 text-xs">
            
            {/* UID ประจำบัญชีตามบทบาท */}
            <div className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl text-left">
              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wide">{uidLabel}</span>
              <span className="font-mono text-sm font-bold text-slate-800 truncate block select-all mt-0.5">
                {loginUid}
              </span>
            </div>

            {/* รายละเอียดเพิ่มเติม */}
            <div className="p-1 space-y-2 text-slate-500">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">สถานะบัญชี:</span>
                <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {initialUser.status}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">เข้าร่วมระบบเมื่อ:</span>
                <span className="font-bold text-slate-700">
                  {new Date(initialUser.createdAt).toLocaleDateString("th-TH")}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* คอลัมน์ขวา: แบบฟอร์มการกรอกข้อมูล */}
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <form onSubmit={handleFormSubmit} className="space-y-6">
            
            {/* หมวดหมู่: ข้อมูลทั่วไป */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">ข้อมูลทั่วไป</h4>
              
              {/* ฟิลด์แสดง UID บัญชี */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700 block">
                  {uidLabel}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                    <FaIdBadge />
                  </span>
                  <input
                    type="text"
                    readOnly
                    value={loginUid}
                    className="w-full pl-11 pr-24 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 focus:outline-none cursor-default select-all"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(loginUid)}
                    className="absolute inset-y-2 right-2 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:text-sky-600 hover:border-sky-300 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    {copied ? <FaCheck className="text-emerald-500" /> : <FaCopy />}
                    <span>{copied ? "คัดลอกแล้ว" : "คัดลอก"}</span>
                  </button>
                </div>
              </div>

              {/* ฟิลด์แก้ไขชื่อ */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">ชื่อ - นามสกุล</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                    <FaUser />
                  </span>
                  <input
                    type="text"
                    name="name"
                    defaultValue={initialUser.name}
                    disabled={!canEditName || isPending}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition disabled:opacity-75 disabled:bg-slate-100 disabled:cursor-not-allowed"
                    placeholder="ป้อนชื่อจริงนามสกุล"
                  />
                </div>
                {!canEditName && (
                  <p className="text-xs text-amber-600 font-medium">⚠️ บัญชีนักเรียนไม่สามารถแก้ไขชื่อได้ด้วยตัวเอง กรุณาติดต่อครูประจำชั้นเพื่อขอเปลี่ยนชื่อ</p>
                )}
              </div>

              {/* ฟิลด์เลือกอวาตาร์ (ทุกคนแก้ไขได้) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-700">เลือกรูปภาพประจำตัว (Avatar)</label>
                  <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 transition-colors"
                  >
                    {isExpanded ? (
                      <>
                        <FaChevronUp className="text-[10px]" /> ย่อรายการ
                      </>
                    ) : (
                      <>
                        <FaChevronDown className="text-[10px]" /> ดูเพิ่มเติม (มีทั้งหมด {AVATAR_PRESETS.length} แบบ)
                      </>
                    )}
                  </button>
                </div>

                {/* แถบฟิลเตอร์หมวดหมู่เมื่อกดขยาย */}
                {isExpanded && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                    {AVATAR_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-all text-xs cursor-pointer ${
                          selectedCategory === cat.id
                            ? "bg-sky-500 text-white shadow-sm"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                )}
                
                {/* การ์ดสไตล์สำหรับการเลือก Preset */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 pt-1">
                  {displayedPresets.map((avatar) => {
                    const isSelected = selectedAvatar === avatar.id;
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => setSelectedAvatar(avatar.id)}
                        className={`relative p-3 rounded-2xl border flex flex-col items-center justify-center gap-2 transition hover:scale-105 active:scale-95 cursor-pointer ${
                          isSelected 
                            ? "border-sky-500 bg-sky-50/70 ring-2 ring-sky-500/20 shadow-sm" 
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        {isSelected && (
                          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-sky-500 text-white rounded-full flex items-center justify-center text-[8px] shadow">
                            <FaCheck />
                          </span>
                        )}
                        <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatar.gradient} text-white flex items-center justify-center text-xl shadow-xs`}>
                          {avatar.emoji}
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 truncate w-full text-center">{avatar.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* ปุ่มล่างสำหรับกดสลับดูเพิ่มเติม / ย่อ เมื่อเปิดดู */}
                <div className="pt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-xs font-bold text-slate-500 hover:text-sky-600 flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 hover:border-sky-200 bg-slate-50 hover:bg-sky-50/50 transition-all cursor-pointer"
                  >
                    {isExpanded ? (
                      <>
                        <FaChevronUp className="text-[10px]" /> ย่อรายการแสดงผล
                      </>
                    ) : (
                      <>
                        <FaChevronDown className="text-[10px]" /> ดูรูปภาพประจำตัวเพิ่มเติม ({AVATAR_PRESETS.length - 6} แบบที่เหลือ)
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* หมวดหมู่: ธีมและการแสดงผล */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h4 className="text-sm font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                  ธีมและการแสดงผล (Theme & Appearance)
                </h4>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800">
                  {mounted ? (theme === "dark" ? "โหมดมืด (Dark)" : theme === "system" ? "ตามระบบ (System)" : "โหมดสว่าง (Light)") : "โหมดสว่าง (Light)"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. โหมดสว่าง (Light) - ยังคงเป็นธีมสว่างเสมอไม่ว่าจะอยู่ในโหมดใด */}
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`relative p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 group shadow-xs hover:shadow-md ${
                    mounted && theme === "light"
                      ? "!border-sky-500 !ring-2 !ring-sky-500/30"
                      : "hover:!border-slate-300"
                  }`}
                  style={{
                    backgroundColor: mounted && theme === "light" ? "#f0f9ff" : "#ffffff",
                    borderColor: mounted && theme === "light" ? "#0ea5e9" : "#e2e8f0"
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div 
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-xs border"
                      style={{ backgroundColor: "#fef3c7", color: "#d97706", borderColor: "#fde68a" }}
                    >
                      <FaSun />
                    </div>
                    {mounted && theme === "light" && (
                      <span className="w-5 h-5 bg-sky-500 text-white rounded-full flex items-center justify-center text-[10px] shadow">
                        <FaCheck />
                      </span>
                    )}
                  </div>

                  {/* Preview Palette Mini Card - ตัวอย่างแดชบอร์ดสีขาวสะอาดตาเสมอ */}
                  <div 
                    className="w-full h-10 rounded-lg p-1.5 flex gap-1.5 border"
                    style={{ backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }}
                  >
                    <div 
                      className="w-1/3 h-full rounded border shadow-2xs"
                      style={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1" }}
                    />
                    <div 
                      className="flex-1 h-full rounded flex flex-col justify-center gap-1 px-1.5 border"
                      style={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1" }}
                    >
                      <div className="w-3/4 h-1.5 rounded-full" style={{ backgroundColor: "#94a3b8" }} />
                      <div className="w-1/2 h-1 rounded-full" style={{ backgroundColor: "#38bdf8" }} />
                    </div>
                  </div>

                  <div>
                    <h5 className="text-sm font-bold" style={{ color: "#0f172a" }}>โหมดสว่าง (Light)</h5>
                    <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>สีขาว คมชัด สะอาดตา สบายตาเวลากลางวัน</p>
                  </div>
                </button>

                {/* 2. โหมดมืด (Dark) - ยังคงเป็นธีมมืดเสมอ */}
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`relative p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 group shadow-xs hover:shadow-md ${
                    mounted && theme === "dark"
                      ? "!border-sky-500 !ring-2 !ring-sky-500/30 shadow-lg shadow-black/40"
                      : "hover:!border-slate-600"
                  }`}
                  style={{
                    backgroundColor: mounted && theme === "dark" ? "#0c1527" : "#0f172a",
                    borderColor: mounted && theme === "dark" ? "#0ea5e9" : "#334155"
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div 
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-xs border"
                      style={{ backgroundColor: "#1e1b4b", color: "#818cf8", borderColor: "#3730a3" }}
                    >
                      <FaMoon />
                    </div>
                    {mounted && theme === "dark" && (
                      <span className="w-5 h-5 bg-sky-500 text-white rounded-full flex items-center justify-center text-[10px] shadow">
                        <FaCheck />
                      </span>
                    )}
                  </div>

                  {/* Preview Palette Mini Card - ตัวอย่างแดชบอร์ดสีมืดสนิทเสมอ */}
                  <div 
                    className="w-full h-10 rounded-lg p-1.5 flex gap-1.5 border"
                    style={{ backgroundColor: "#020617", borderColor: "#1e293b" }}
                  >
                    <div 
                      className="w-1/3 h-full rounded border"
                      style={{ backgroundColor: "#0f172a", borderColor: "#334155" }}
                    />
                    <div 
                      className="flex-1 h-full rounded flex flex-col justify-center gap-1 px-1.5 border"
                      style={{ backgroundColor: "#0f172a", borderColor: "#334155" }}
                    >
                      <div className="w-3/4 h-1.5 rounded-full" style={{ backgroundColor: "#64748b" }} />
                      <div className="w-1/2 h-1 rounded-full" style={{ backgroundColor: "#0284c7" }} />
                    </div>
                  </div>

                  <div>
                    <h5 className="text-sm font-bold" style={{ color: "#f8fafc" }}>โหมดมืด (Dark)</h5>
                    <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>สีดำ-เทาเข้ม นุ่มนวล ถนอมสายตาในที่แสงน้อย</p>
                  </div>
                </button>

                {/* 3. ตามระบบ (System) - แสดงผลแบบครึ่งสว่างครึ่งมืด */}
                <button
                  type="button"
                  onClick={() => setTheme("system")}
                  className={`relative p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 group shadow-xs hover:shadow-md bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-700 ${
                    mounted && theme === "system"
                      ? "!border-sky-500 !ring-2 !ring-sky-500/30 !bg-sky-50/30 dark:!bg-sky-950/30"
                      : "hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center text-lg shadow-xs border border-purple-200 dark:border-purple-800/50">
                      <FaDesktop />
                    </div>
                    {mounted && theme === "system" && (
                      <span className="w-5 h-5 bg-sky-500 text-white rounded-full flex items-center justify-center text-[10px] shadow">
                        <FaCheck />
                      </span>
                    )}
                  </div>

                  {/* Preview Palette Mini Card - ตัวอย่างแบบแบ่งครึ่งสว่างและมืดชัดเจน */}
                  <div 
                    className="w-full h-10 rounded-lg p-1.5 flex gap-1.5 border overflow-hidden" 
                    style={{ background: "linear-gradient(to right, #f8fafc 50%, #020617 50%)", borderColor: "#94a3b8" }}
                  >
                    {/* ฝั่งสว่าง (ซ้าย) */}
                    <div 
                      className="w-1/2 h-full rounded flex items-center gap-1 px-1.5 border" 
                      style={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1" }}
                    >
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: "#f59e0b" }} />
                      <div className="flex-1 flex flex-col gap-0.5">
                        <div className="w-full h-1 rounded-full" style={{ backgroundColor: "#94a3b8" }} />
                        <div className="w-2/3 h-0.5 rounded-full" style={{ backgroundColor: "#38bdf8" }} />
                      </div>
                    </div>
                    {/* ฝั่งมืด (ขวา) */}
                    <div 
                      className="w-1/2 h-full rounded flex items-center gap-1 px-1.5 border" 
                      style={{ backgroundColor: "#0f172a", borderColor: "#334155" }}
                    >
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: "#818cf8" }} />
                      <div className="flex-1 flex flex-col gap-0.5">
                        <div className="w-full h-1 rounded-full" style={{ backgroundColor: "#64748b" }} />
                        <div className="w-2/3 h-0.5 rounded-full" style={{ backgroundColor: "#0284c7" }} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h5 className="text-sm font-bold text-slate-800 dark:text-slate-100">ตามระบบ (System)</h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">ปรับเปลี่ยนอัตโนมัติตามอุปกรณ์ของคุณ</p>
                  </div>
                </button>
              </div>
            </div>

            {/* หมวดหมู่: ความปลอดภัยและรหัสผ่าน */}
            <div className="space-y-4 pt-2">
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">เปลี่ยนรหัสผ่าน (เว้นว่างไว้หากไม่ต้องการเปลี่ยน)</h4>
              
              {/* รหัสผ่านเดิม */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">รหัสผ่านเดิม</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                    <FaLock />
                  </span>
                  <input
                    type="password"
                    name="oldPassword"
                    disabled={isPending}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition"
                    placeholder="ระบุรหัสเดิมเพื่อยืนยันสิทธิ์"
                  />
                </div>
              </div>

              {/* รหัสผ่านใหม่ */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">รหัสผ่านใหม่</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                    <FaKey />
                  </span>
                  <input
                    type="password"
                    name="newPassword"
                    disabled={isPending}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition"
                    placeholder="ระบุรหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)"
                  />
                </div>
              </div>
            </div>

            {/* ปุ่มกดบันทึกความเปลี่ยนแปลง */}
            <div className="pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 bg-sky-500 text-white font-bold py-3.5 rounded-xl hover:bg-sky-600 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaSave />
                {isPending ? "กำลังบันทึกข้อมูล..." : "บันทึกการเปลี่ยนแปลง"}
              </button>
            </div>

          </form>
        </div>

      </div>

    </div>
  );
}
