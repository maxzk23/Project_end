"use client";

import { useEffect, useState, useTransition } from "react";
import { getStudentDefaultClass, saveGameScoreAndSync } from "@/app/actions/student";
import { getStudentClassrooms } from "@/app/actions/classroom";
import { 
  FaGamepad, 
  FaRocket, 
  FaPlay, 
  FaTrophy, 
  FaExclamationCircle, 
  FaCheckCircle,
  FaTimes,
  FaStar,
  FaShieldAlt
} from "react-icons/fa";

interface Classroom {
  id: string;
  name: string;
  yearLevel: string;
  room: string;
}

const GAMES = [
  {
    id: "theme-customizer",
    title: "ดีไซเนอร์เปลี่ยนธีมสี (UI/UX Customizer)",
    description: "เลือกส่วนประกอบและรหัสสี HEX Code เพื่อตกแต่งหน้าเว็บ!",
    category: "UI/UX Design",
    level: "ม.1–3",
    score: 200,
    emoji: "🎨",
    fileUrl: "/games/theme_customizer.html"
  },
  {
    id: "typing-diner",
    title: "ร้านอาหารพิมพ์เร็วไซเบอร์ (Typing Diner)",
    description: "พิมพ์ศัพท์คอมพิวเตอร์และอาหารตามออเดอร์เพื่อเสิร์ฟลูกค้า!",
    category: "Typing Skill",
    level: "ม.1–3",
    score: 200,
    emoji: "🍳",
    fileUrl: "/games/restaurant_typing.html"
  },
  {
    id: "fiber-optic",
    title: "ลากสายไฟเบอร์ออปติก (Fiber Optic)",
    description: "ลากลำแสงเลเซอร์ผ่านช่องแคบไปส่งเน็ตถึงบ้านเรือน!",
    category: "Data Network",
    level: "ม.1–3",
    score: 200,
    emoji: "🔌",
    fileUrl: "/games/fiber_optic.html"
  },
  {
    id: "space-waves",
    title: "สเปซเวฟส์ (Space Waves)",
    description: "กดคลิกค้างเพื่อเฉียงขึ้น ปล่อยเพื่อเฉียงลง หลบฟันเฟือง!",
    category: "Reflex Arc",
    level: "ม.1–3",
    score: 250,
    emoji: "⚡",
    fileUrl: "/games/space_waves.html"
  },
  {
    id: "cyber-parkour",
    title: "ไซเบอร์พาร์กัวร์ (Cyber Parkour)",
    description: "วิ่ง กระโดด หลบหนามและเก็บเหรียญเพื่อเข้าเส้นชัย!",
    category: "Action Fun",
    level: "ม.1–3",
    score: 200,
    emoji: "🏃‍♂️",
    fileUrl: "/games/parkour.html"
  },
  {
    id: "coding-robot",
    title: "เดินตามสั่ง สู่เส้นชัย (Phaser)",
    description: "วางบล็อกคำสั่งพาหุ่นยนต์เดินทางไปยังจุดหมาย!",
    category: "Algorithm",
    level: "ม.1–3",
    score: 150,
    emoji: "🤖",
    fileUrl: "/games/coding_robot.html"
  },
  {
    id: "phaser-conveyor",
    title: "สายพานแยกของ (Phaser)",
    description: "คัดแยก Hardware & Software ตามจังหวะสายพาน!",
    category: "Data Sort",
    level: "ม.1–3",
    score: 120,
    emoji: "📦",
    fileUrl: "/games/conveyor.html"
  },
  {
    id: "whack-a-bug",
    title: "ทุบบั๊กป่วนโค้ด (Phaser)",
    description: "จิ้มทุบบั๊กสีเขียวให้ไวที่สุดก่อนมันจะหนีไป!",
    category: "Debugging",
    level: "ม.1–3",
    score: 100,
    emoji: "🪲",
    fileUrl: "/games/whack_a_bug.html"
  }
];

export default function StudentGamesPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // States สำหรับระบายความเคลื่อนไหวเล่นเกมใน Iframe
  const [activeGame, setActiveGame] = useState<typeof GAMES[0] | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const initData = async () => {
      try {
        const classes = await getStudentClassrooms();
        setClassrooms(classes);
        
        const defaultClass = await getStudentDefaultClass();
        if (defaultClass) {
          setSelectedClassId(defaultClass.id);
        } else if (classes.length > 0) {
          setSelectedClassId(classes[0].id);
        }
      } catch (e) {
        console.error("Failed to load classrooms for student games", e);
      } finally {
        setIsLoading(false);
      }
    };
    initData();
  }, []);

  // ดักรอข้อความคะแนนจากการเล่นเกมใน Iframe
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data && event.data.type === "GAME_OVER") {
        const { score, gameId } = event.data;
        if (!selectedClassId) {
          showToast("error", "กรุณาลงชื่อสมัครเข้าชั้นเรียนก่อนส่งคะแนน");
          return;
        }

        startTransition(async () => {
          const res = await saveGameScoreAndSync(gameId, score, selectedClassId);
          if (res.success) {
            showToast("success", `บันทึกคะแนนสะสม ${score} แต้ม เข้าระบบและอัปเดตตาราง Leaderboard สำเร็จ! 🏆`);
          } else {
            showToast("error", res.error || "เกิดข้อผิดพลาดในการบันทึกคะแนน");
          }
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [selectedClassId]);

  const showToast = (type: "success" | "error", text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  return (
    <div className="space-y-8 text-left">
      
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

      {/* ส่วนหัวหน้าจอ */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FaGamepad className="text-sky-600" /> มินิเกมฝึกทักษะ
          </h1>
          <p className="text-sm text-slate-500 mt-1">ท้าทายตนเองด้วยมินิเกมเก็บคะแนนเสริมเพื่ออัปอันดับลีดเดอร์บอร์ดชั้นเรียน</p>
        </div>

        {/* ห้องเรียนที่เก็บแต้มสะสม */}
        {classrooms.length > 0 && selectedClassId && (
          <div className="flex items-center gap-2">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition shadow-sm"
            >
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  ห้อง {c.name} ({c.yearLevel}/{c.room})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* คอนเทนต์หลัก */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-400 font-medium animate-pulse">กำลังโหลดรายชื่อมินิเกม...</div>
      ) : classrooms.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-100 shadow-sm text-center text-slate-500 max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto border border-amber-100 text-amber-500 text-3xl">
            <FaExclamationCircle />
          </div>
          <div>
            <p className="text-base font-bold text-slate-800">ยังไม่ได้ลงทะเบียนเข้าเรียน</p>
            <p className="text-xs text-slate-400 mt-1 font-semibold">กรุณารอคุณครูลงทะเบียนสิทธิ์เพื่อให้เข้ามาท้าทายเก็บแต้มได้ครับ</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {GAMES.map((game) => (
            <div 
              key={game.id}
              className="bg-white border border-slate-100 hover:border-sky-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="space-y-4">
                {/* Emoji & Badge */}
                <div className="flex justify-between items-start">
                  <span className="text-4xl bg-slate-50 border border-slate-100/50 w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-200">
                    {game.emoji}
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 bg-sky-50 text-sky-700 rounded-md select-none">
                    {game.category}
                  </span>
                </div>

                {/* Content */}
                <div className="space-y-1.5">
                  <h3 className="font-bold text-sm text-slate-800 group-hover:text-sky-600 transition-colors line-clamp-1">
                    {game.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-semibold line-clamp-2 leading-relaxed">
                    {game.description}
                  </p>
                </div>
              </div>

              {/* Bottom specs and button */}
              <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                  <span>{game.level}</span>
                  <span>•</span>
                  <span className="text-amber-500 flex items-center gap-0.5">
                    <FaStar className="text-[9px]" /> +{game.score} แต้ม
                  </span>
                </div>
                <button
                  onClick={() => setActiveGame(game)}
                  className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-[10px] rounded-lg transition shadow-sm flex items-center gap-1"
                >
                  <FaPlay className="text-[8px]" /> เล่นเกม
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* modal ท็อปอัปทับเล่นเกมแบบ Fullscreen */}
      {activeGame && (
        <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col w-screen h-screen overflow-hidden animate-in fade-in duration-200">
          
          {/* ปุ่มกดออกจากเกมทางด้านขวาบนแบบลอยตัว (F11 Style) */}
          <button
            onClick={() => setActiveGame(null)}
            className="absolute top-4 right-4 bg-slate-900/80 hover:bg-slate-800 hover:text-white text-slate-300 rounded-full p-3.5 z-50 transition-all shadow-lg border border-slate-700/50 hover:scale-110 active:scale-95"
            title="ออกจากเกม"
          >
            <FaTimes className="text-xl" />
          </button>

          {/* Area Iframe Game */}
          <div className="flex-1 bg-slate-950 relative w-full h-full">
            <iframe
              src={activeGame.fileUrl}
              className="w-full h-full border-none block"
              title={activeGame.title}
              sandbox="allow-scripts allow-same-origin allow-modals"
            ></iframe>
          </div>

        </div>
      )}

    </div>
  );
}
