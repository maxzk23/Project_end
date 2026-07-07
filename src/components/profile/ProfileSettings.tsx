"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/app/actions/profile";
import { 
  FaUser, 
  FaLock, 
  FaKey, 
  FaSave, 
  FaExclamationCircle, 
  FaCheckCircle,
  FaArrowLeft
} from "react-icons/fa";

// รายชื่ออวาตาร์ Preset ที่มีสไตล์สวยงาม
export const AVATAR_PRESETS = [
  { id: "preset-1", emoji: "🎓", label: "นักเรียนดีเด่น", gradient: "from-sky-400 to-indigo-500" },
  { id: "preset-2", emoji: "🚀", label: "นักบินอวกาศ", gradient: "from-emerald-400 to-teal-500" },
  { id: "preset-3", emoji: "👾", label: "เกมเมอร์", gradient: "from-rose-400 to-red-500" },
  { id: "preset-4", emoji: "🧪", label: "นักวิทย์น้อย", gradient: "from-violet-400 to-fuchsia-500" },
  { id: "preset-5", emoji: "🎨", label: "ศิลปิน", gradient: "from-amber-400 to-orange-500" },
  { id: "preset-6", emoji: "🐱", label: "แมวน้อย", gradient: "from-slate-400 to-zinc-500" },
];

// Helper สำหรับเรนเดอร์อวาตาร์
export function renderAvatarHelper(avatarUrl: string | null, name: string, className = "w-16 h-16 text-2xl") {
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
    createdAt: Date;
  };
}

export default function ProfileSettings({ initialUser }: ProfileSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedAvatar, setSelectedAvatar] = useState(initialUser.avatarUrl || "preset-1");
  const [customUrl, setCustomUrl] = useState(initialUser.avatarUrl?.startsWith("http") ? initialUser.avatarUrl : "");
  const [activeTab, setActiveTab] = useState<"avatar" | "url">(initialUser.avatarUrl?.startsWith("http") ? "url" : "avatar");
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // เช็คว่าผู้ใช้เป็นครูหรือแอดมิน (มีสิทธิ์แก้ชื่อ/อวาตาร์) หรือไม่
  const canEditInfo = initialUser.role === "TEACHER" || initialUser.role === "ADMIN";

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const formData = new FormData(event.currentTarget);
    
    // ตั้งค่ารูปอวาตาร์ที่เลือกส่งไปหลังบ้าน
    if (canEditInfo) {
      if (activeTab === "avatar") {
        formData.set("avatarUrl", selectedAvatar);
      } else {
        formData.set("avatarUrl", customUrl);
      }
    }

    startTransition(async () => {
      const res = await updateProfile(null, formData);
      if (res.success) {
        setSuccessMsg(res.message || "อัปเดตข้อมูลสำเร็จ");
        router.refresh(); // รีเฟรชข้อมูลหน้าบ้านทั้งหมด
      } else {
        setErrorMsg(res.error || "เกิดข้อผิดพลาดในการอัปเดต");
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* ส่วนหัวของฟอร์ม */}
      <div className="flex items-center gap-4 mb-4">
        <button 
          onClick={() => router.back()} 
          className="p-2 bg-white border border-slate-200 text-slate-600 rounded-full hover:bg-slate-50 transition"
        >
          <FaArrowLeft />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">จัดการโปรไฟล์ส่วนตัว</h2>
          <p className="text-sm text-slate-500 mt-1">
            แก้ไขและอัปเดตข้อมูลประวัติส่วนตัวของคุณ ({initialUser.role === "STUDENT" ? "นักเรียน" : "คุณครู"})
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
            canEditInfo ? (activeTab === "avatar" ? selectedAvatar : customUrl) : initialUser.avatarUrl,
            initialUser.name,
            "w-24 h-24 text-4xl"
          )}
          
          <div>
            <h3 className="text-lg font-bold text-slate-800">{initialUser.name}</h3>
            <span className={`inline-block mt-2 px-3 py-1 text-xs font-bold rounded-full ${
              initialUser.role === "TEACHER" 
                ? "bg-sky-100 text-sky-700 border border-sky-200" 
                : "bg-purple-100 text-purple-700 border border-purple-200"
            }`}>
              {initialUser.role === "TEACHER" ? "คุณครูผู้สอน" : "นักเรียน ม.3/1"}
            </span>
          </div>

          <div className="w-full border-t border-slate-100 pt-4 text-left text-xs space-y-2 text-slate-500">
            <p>สถานะบัญชี: <span className="font-bold text-emerald-600">{initialUser.status}</span></p>
            <p>เข้าร่วมระบบเมื่อ: <span className="font-bold text-slate-700">{new Date(initialUser.createdAt).toLocaleDateString("th-TH")}</span></p>
          </div>
        </div>

        {/* คอลัมน์ขวา: แบบฟอร์มการกรอกข้อมูล */}
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <form onSubmit={handleFormSubmit} className="space-y-6">
            
            {/* หมวดหมู่: ข้อมูลทั่วไป */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">ข้อมูลทั่วไป</h4>
              
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
                    disabled={!canEditInfo || isPending}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition disabled:opacity-75 disabled:bg-slate-100 disabled:cursor-not-allowed"
                    placeholder="ป้อนชื่อจริงนามสกุล"
                  />
                </div>
                {!canEditInfo && (
                  <p className="text-xs text-amber-600 font-medium">⚠️ บัญชีนักเรียนไม่สามารถแก้ไขชื่อได้ด้วยตัวเอง กรุณาติดต่อครูประจำชั้นเพื่อขอเปลี่ยนชื่อ</p>
                )}
              </div>

              {/* ฟิลด์เลือกอวาตาร์ (เฉพาะครูแก้ไขได้) */}
              {canEditInfo ? (
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700">เลือกรูปภาพประจำตัว (Avatar)</label>
                  
                  {/* แถบเลือกโหมด (Preset vs Link) */}
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-fit">
                    <button
                      type="button"
                      onClick={() => setActiveTab("avatar")}
                      className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${activeTab === "avatar" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
                    >
                      รูปอวาตาร์ Preset
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("url")}
                      className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${activeTab === "url" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
                    >
                      ใส่ลิงก์ภาพภายนอก
                    </button>
                  </div>

                  {activeTab === "avatar" ? (
                    /* การ์ดสไตล์สำหรับการเลือก Preset */
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 pt-2">
                      {AVATAR_PRESETS.map((avatar) => (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => setSelectedAvatar(avatar.id)}
                          className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition hover:scale-105 active:scale-95 ${
                            selectedAvatar === avatar.id 
                              ? "border-sky-500 bg-sky-50 ring-2 ring-sky-500/20" 
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatar.gradient} text-white flex items-center justify-center text-lg`}>
                            {avatar.emoji}
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 truncate w-full text-center">{avatar.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    /* ช่องใส่ URL */
                    <input
                      type="url"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      disabled={isPending}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition"
                      placeholder="https://example.com/avatar.jpg"
                    />
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">รูปภาพประจำตัว</label>
                  <p className="text-xs text-slate-400">ภาพอวาตาร์ปัจจุบันถูกกำหนดโดยระบบ</p>
                </div>
              )}
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
