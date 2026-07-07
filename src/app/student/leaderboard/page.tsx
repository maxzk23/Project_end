"use client";

import { useEffect, useState } from "react";
import { getStudentDefaultClass, getClassLeaderboard } from "@/app/actions/student";
import { getStudentClassrooms } from "@/app/actions/classroom";
import { 
  FaTrophy, 
  FaExclamationCircle, 
  FaMedal, 
  FaCrown,
  FaStar
} from "react-icons/fa";

interface Classroom {
  id: string;
  name: string;
  yearLevel: string;
  room: string;
}

interface LeaderboardEntry {
  id: string;
  studentId: string;
  totalPoints: number;
  student: {
    name: string;
    avatarUrl: string | null;
  };
}

export default function StudentLeaderboardPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
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
      loadLeaderboard();
    }
  }, [selectedClassId]);

  const loadLeaderboard = async () => {
    setIsLoading(true);
    const data = await getClassLeaderboard(selectedClassId);
    setLeaderboard(data as unknown as LeaderboardEntry[]);
    setIsLoading(false);
  };

  // Helper สำหรับดึงไอคอนลำดับเหรียญรางวัล
  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 border border-yellow-200 flex items-center justify-center font-bold text-sm shrink-0">
            <FaCrown className="text-yellow-500 animate-bounce" />
          </div>
        );
      case 2:
        return (
          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center font-bold text-sm shrink-0">
            <FaMedal className="text-slate-400" />
          </div>
        );
      case 3:
        return (
          <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 border border-orange-200 flex items-center justify-center font-bold text-sm shrink-0">
            <FaMedal className="text-orange-500" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-slate-50 text-slate-500 border border-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
            {rank}
          </div>
        );
    }
  };

  return (
    <div className="space-y-8">
      
      {/* ส่วนหัว */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FaTrophy className="text-yellow-500" /> ทำเนียบเกียรติยศนักเรียน (Leaderboard)
          </h1>
          <p className="text-sm text-slate-500 mt-1">ตารางจัดอันดับสะสมคะแนนจากการตอบคำถามและการเล่นมินิเกมของห้องเรียน</p>
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
          <p className="text-sm opacity-75 mt-1">ยังไม่มีบอร์ดจัดอันดับคะแนนสะสมครับ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* === ส่วนซ้าย: ตารางจัดอันดับทั้งหมด === */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
              <FaTrophy className="text-yellow-500 animate-pulse" /> อันดับคะแนนสะสมห้องเรียน
            </h3>

            {isLoading ? (
              <div className="py-12 text-center text-slate-400 font-medium">กำลังดึงข้อมูลอันดับ...</div>
            ) : leaderboard.length === 0 ? (
              <div className="py-12 text-center text-slate-400">ยังไม่มีประวัติการส่งคะแนนเพื่อขึ้นจัดอันดับ</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-200">
                      <th className="pb-3.5 font-medium pl-2 w-20">อันดับ</th>
                      <th className="pb-3.5 font-medium">ชื่อ-นามสกุล</th>
                      <th className="pb-3.5 font-medium text-right pr-2">คะแนนสะสม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leaderboard.map((entry, idx) => (
                      <tr key={entry.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-4 pl-2 font-medium text-slate-500">
                          {getRankBadge(idx + 1)}
                        </td>
                        <td className="py-4 font-bold text-slate-700">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs">
                              {entry.student.name.charAt(0)}
                            </div>
                            <span>{entry.student.name}</span>
                          </div>
                        </td>
                        <td className="py-4 text-right pr-2 font-mono text-base font-black text-sky-600">
                          {entry.totalPoints.toLocaleString()} <span className="text-[10px] text-slate-400 font-semibold font-sans">pts</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* === ส่วนขวา: โพเดียมอันดับ 1 (ดีไซน์พรีเมียม) === */}
          <div className="space-y-6">
            
            <div className="bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 p-6 rounded-3xl shadow-lg text-white text-center space-y-4">
              <FaCrown className="text-5xl mx-auto text-white animate-bounce drop-shadow" />
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider opacity-90">อันดับที่ 1 ของห้องในสัปดาห์นี้</h4>
                
                {leaderboard.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <div className="w-20 h-20 rounded-full bg-white/20 border-4 border-white/40 flex items-center justify-center text-4xl mx-auto drop-shadow-sm font-bold">
                      {leaderboard[0].student.name.charAt(0)}
                    </div>
                    <h3 className="text-xl font-black mt-2 truncate">{leaderboard[0].student.name}</h3>
                    <div className="inline-flex items-center gap-1 bg-white text-orange-600 px-4.5 py-1 rounded-full text-sm font-black shadow-md mt-2">
                      <FaStar />
                      <span>{leaderboard[0].totalPoints.toLocaleString()} pts</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm opacity-75 mt-4">รอนักเรียนเข้าแข่งขันชิงอันดับ...</p>
                )}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
