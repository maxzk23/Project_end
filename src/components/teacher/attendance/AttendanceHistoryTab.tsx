"use client";

import { useState } from "react";
import { 
  FaCalendarAlt, 
  FaUserCheck, 
  FaArrowRight, 
  FaFilter, 
  FaUndoAlt, 
  FaChevronDown, 
  FaSearch, 
  FaHistory 
} from "react-icons/fa";

interface AttendanceHistoryTabProps {
  historyLogs: any[];
  isLoading: boolean;
  onViewDetails: (classId: string, dateStr: string) => void;
}

export default function AttendanceHistoryTab({
  historyLogs,
  isLoading,
  onViewDetails,
}: AttendanceHistoryTabProps) {
  // ตัวกรองภายในคอมโพเนนต์
  const [historyViewMode, setHistoryViewMode] = useState<"monthly" | "daily">("monthly");
  const [historyMonthFilter, setHistoryMonthFilter] = useState<string>("all");
  const [historyClassFilter, setHistoryClassFilter] = useState<string>("all");
  const [historyRoomFilter, setHistoryRoomFilter] = useState<string>("all");
  const [collapsedGroups, setCollapsedGroups] = useState<{ [key: string]: boolean }>({});

  // แปลงฟอร์แมตวันที่แบบไทย
  const formatThaiDate = (dateStr: string) => {
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10) + 543;
    const monthNum = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    const monthMap: { [key: number]: string } = {
      1: "ม.ค.", 2: "ก.พ.", 3: "มี.ค.", 4: "เม.ย.",
      5: "พ.ค.", 6: "มิ.ย.", 7: "ก.ค.", 8: "ส.ค.",
      9: "ก.ย.", 10: "ต.ค.", 11: "พ.ย.", 12: "ธ.ค."
    };
    return `${day} ${monthMap[monthNum]} ${year}`;
  };

  // กรองข้อมูลประวัติการเช็คชื่อตามฟิลเตอร์
  const getFilteredHistory = () => {
    return historyLogs.filter((log) => {
      if (historyViewMode === "daily" && historyMonthFilter !== "all") {
        const thaiD = formatThaiDate(log.date);
        if (!thaiD.includes(historyMonthFilter)) return false;
      }
      if (historyClassFilter !== "all" && log.classLabel !== historyClassFilter) {
        return false;
      }
      if (historyRoomFilter !== "all" && log.roomLabel !== historyRoomFilter) {
        return false;
      }
      return true;
    });
  };

  // จัดกลุ่มข้อมูลสรุปรายเดือน
  const getMonthlyGroups = (filteredList: any[]) => {
    const monthFullNames: { [key: string]: string } = {
      "ม.ค.": "มกราคม", "ก.พ.": "กุมภาพันธ์", "มี.ค.": "มีนาคม", "เม.ย.": "เมษายน",
      "พ.ค.": "พฤษภาคม", "มิ.ย.": "มิถุนายน", "ก.ค.": "กรกฎาคม", "ส.ค.": "สิงหาคม",
      "ก.ย.": "กันยายน", "ต.ค.": "ตุลาคม", "พ.ย.": "พฤศจิกายน", "ธ.ค.": "ธันวาคม"
    };

    const groups: { [key: string]: any } = {};

    filteredList.forEach((log) => {
      const thaiD = formatThaiDate(log.date);
      const parts = thaiD.split(" ");
      if (parts.length >= 3) {
        const monthKey = parts[1];
        const yearKey = parts[2];
        const monthFull = monthFullNames[monthKey] || monthKey;
        const groupName = `${monthFull} ${yearKey}`;

        if (!groups[groupName]) {
          groups[groupName] = {
            groupName,
            monthKey,
            yearText: yearKey,
            days: 0,
            present: 0,
            late: 0,
            leave: 0,
            absent: 0
          };
        }

        groups[groupName].days++;
        groups[groupName].present += log.present;
        groups[groupName].late += log.late;
        groups[groupName].leave += log.leave;
        groups[groupName].absent += log.absent;
      }
    });

    return Object.values(groups);
  };

  // จัดกลุ่มข้อมูลแยกตามเดือนสำหรับการ์ดรายวัน
  const getDailyGroups = (filteredList: any[]) => {
    const monthFullNames: { [key: string]: string } = {
      "ม.ค.": "มกราคม", "ก.พ.": "กุมภาพันธ์", "มี.ค.": "มีนาคม", "เม.ย.": "เมษายน",
      "พ.ค.": "พฤษภาคม", "มิ.ย.": "มิถุนายน", "ก.ค.": "กรกฎาคม", "ส.ค.": "สิงหาคม",
      "ก.ย.": "กันยายน", "ต.ค.": "ตุลาคม", "พ.ย.": "พฤศจิกายน", "ธ.ค.": "ธันวาคม"
    };

    const groups: { [key: string]: any[] } = {};

    filteredList.forEach((log) => {
      const thaiD = formatThaiDate(log.date);
      const parts = thaiD.split(" ");
      if (parts.length >= 3) {
        const monthKey = parts[1];
        const yearKey = parts[2];
        const monthFull = monthFullNames[monthKey] || monthKey;
        const groupName = `${monthFull} ${yearKey}`;

        if (!groups[groupName]) {
          groups[groupName] = [];
        }
        groups[groupName].push(log);
      }
    });

    return groups;
  };

  const filteredHistory = getFilteredHistory();

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-left">
      {/* ส่วนตัวกรองแบบ Interactive */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
              <FaHistory className="text-sky-500" /> คลังข้อมูลประวัติการเช็คชื่อเข้าเรียน
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-semibold">
              เรียกดูรายละเอียด อัตราการเข้าเรียน และรายงานประวัติเช็คชื่อเข้าเรียนย้อนหลัง
            </p>
          </div>

          {/* ปลั๊กสวิตช์ สรุปรายเดือน / รายวัน */}
          <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => {
                setHistoryViewMode("monthly");
                setHistoryMonthFilter("all");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                historyViewMode === "monthly"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <FaCalendarAlt className="text-[10px]" />
              <span>สรุปรายเดือน</span>
            </button>
            <button
              onClick={() => setHistoryViewMode("daily")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                historyViewMode === "daily"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <FaUserCheck className="text-[10px]" />
              <span>รายงานรายวัน</span>
            </button>
          </div>
        </div>

        {/* แผงตัวกรองหลัก */}
        <div className={`grid grid-cols-1 ${historyViewMode === "daily" ? "md:grid-cols-3" : "md:grid-cols-2"} gap-4 pt-4 border-t border-slate-100`}>
          {/* ตัวกรองรายเดือน (แสดงเฉพาะรายงานรายวัน) */}
          {historyViewMode === "daily" && (
            <div className="flex flex-col gap-1.5 animate-in fade-in duration-200">
              <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <FaCalendarAlt className="text-[10px]" /> เลือกดูตามเดือน
              </label>
              <select
                value={historyMonthFilter}
                onChange={(e) => setHistoryMonthFilter(e.target.value)}
                className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer text-slate-700"
              >
                <option value="all">ทุกเดือน (ทั้งหมด)</option>
                <option value="ม.ค.">มกราคม</option>
                <option value="ก.พ.">กุมภาพันธ์</option>
                <option value="มี.ค.">มีนาคม</option>
                <option value="เม.ย.">เมษายน</option>
                <option value="พ.ค.">พฤษภาคม</option>
                <option value="มิ.ย.">มิถุนายน</option>
                <option value="ก.ค.">กรกฎาคม</option>
                <option value="ส.ค.">สิงหาคม</option>
                <option value="ก.ย.">กันยายน</option>
                <option value="ต.ค.">ตุลาคม</option>
                <option value="พ.ย.">พฤศจิกายน</option>
                <option value="ธ.ค.">ธันวาคม</option>
              </select>
            </div>
          )}

          {/* กรองระดับชั้น */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <FaUserCheck className="text-[10px]" /> กรองระดับชั้นปี
            </label>
            <select
              value={historyClassFilter}
              onChange={(e) => setHistoryClassFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer text-slate-700"
            >
              <option value="all">ทุกระดับชั้น (ทั้งหมด)</option>
              <option value="ม.1">มัธยมศึกษาปีที่ 1 (ม.1)</option>
              <option value="ม.2">มัธยมศึกษาปีที่ 2 (ม.2)</option>
              <option value="ม.3">มัธยมศึกษาปีที่ 3 (ม.3)</option>
            </select>
          </div>

          {/* กรองห้อง */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <FaArrowRight className="text-[10px] transform rotate-90" /> กรองห้องเรียนย่อย
            </label>
            <select
              value={historyRoomFilter}
              onChange={(e) => setHistoryRoomFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer text-slate-700"
            >
              <option value="all">ทุกห้องเรียน (ทั้งหมด)</option>
              <option value="1">ห้อง 1</option>
              <option value="2">ห้อง 2</option>
              <option value="3">ห้อง 3</option>
            </select>
          </div>
        </div>

        {/* ป้ายแสดงสถานะการกรองข้อมูล */}
        {(historyMonthFilter !== "all" || historyClassFilter !== "all" || historyRoomFilter !== "all") && (
          <div className="flex justify-between items-center bg-sky-50 border border-sky-100 rounded-xl px-4 py-2.5 text-xs text-sky-700 font-bold">
            <span className="flex items-center gap-1">
              <FaFilter />
              กำลังแสดงผลการกรอง: {historyMonthFilter !== "all" && `เดือน ${historyMonthFilter}`}{" "}
              {historyClassFilter !== "all" && `ชั้น ${historyClassFilter}`}{" "}
              {historyRoomFilter !== "all" && `ห้อง /${historyRoomFilter}`} ({filteredHistory.length} รายการ)
            </span>
            <button
              onClick={() => {
                setHistoryMonthFilter("all");
                setHistoryClassFilter("all");
                setHistoryRoomFilter("all");
              }}
              className="flex items-center gap-1 hover:underline text-sky-600 hover:text-sky-800"
            >
              <FaUndoAlt className="text-[10px]" />
              <span>ล้างตัวกรองทั้งหมด</span>
            </button>
          </div>
        )}
      </div>

      {/* รายการประวัติหลัก */}
      {isLoading ? (
        <div className="py-24 text-center text-slate-400 bg-white border rounded-2xl">
          กำลังโหลดข้อมูลประวัติเช็คชื่อ...
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
          <FaCalendarAlt className="text-5xl mx-auto text-slate-300 opacity-60" />
          <p className="text-base font-bold">ไม่พบข้อมูลประวัติการเช็คชื่อเข้าเรียน</p>
          <p className="text-xs opacity-75 mt-1 font-semibold">
            ไม่พบข้อมูลการบันทึกที่สอดคล้องกับวิชา ห้องเรียน หรือช่วงเวลาที่เลือกกรองในขณะนี้
          </p>
          <button
            onClick={() => {
              setHistoryMonthFilter("all");
              setHistoryClassFilter("all");
              setHistoryRoomFilter("all");
            }}
            className="mx-auto px-4 py-2 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-200 transition flex items-center gap-1.5"
          >
            <FaUndoAlt className="text-[9px]" />
            <span>รีเซ็ตและแสดงทั้งหมด</span>
          </button>
        </div>
      ) : historyViewMode === "monthly" ? (
        /* ================= สรุปรายเดือน (Monthly Summary Card View) ================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {getMonthlyGroups(filteredHistory).map((g: any) => {
            const total = g.present + g.late + g.leave + g.absent;
            const rate = total > 0 ? Math.round(((g.present + g.late + g.leave) / total) * 100) : 0;

            const rateColorClass = rate >= 90 ? "bg-emerald-500" : rate >= 75 ? "bg-amber-500" : "bg-rose-500";
            const rateTextClass = rate >= 90 ? "text-emerald-600" : rate >= 75 ? "text-amber-600" : "text-rose-600";

            return (
              <div
                key={g.groupName}
                onClick={() => {
                  setHistoryMonthFilter(g.monthKey);
                  setHistoryViewMode("daily");
                }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden p-5 flex flex-col justify-between hover:shadow-md cursor-pointer hover:border-sky-300 transition-all group"
              >
                <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${rateColorClass}`} />

                <div className="flex justify-between items-start w-full">
                  <div className="flex items-center gap-2">
                    <FaCalendarAlt className="text-slate-400 group-hover:text-sky-500 transition-colors text-base" />
                    <h4 className="font-bold text-slate-800 text-sm">{g.groupName}</h4>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-black block ${rateTextClass}`}>{rate}%</span>
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">เข้าเรียนเฉลี่ย</span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 mt-4 font-semibold">
                  เช็คชื่อแล้ว: <strong className="text-slate-800">{g.days}</strong> วัน
                </p>

                <div className="grid grid-cols-4 gap-1 pt-4 mt-4 border-t border-slate-100 text-center select-none">
                  <div className="border-r border-slate-100">
                    <span className="text-xs font-black text-slate-700 block">{g.present}</span>
                    <span className="text-[9px] text-slate-400 font-bold">มา</span>
                  </div>
                  <div className="border-r border-slate-100">
                    <span className="text-xs font-black text-slate-700 block">{g.late}</span>
                    <span className="text-[9px] text-slate-400 font-bold">สาย</span>
                  </div>
                  <div className="border-r border-slate-100">
                    <span className="text-xs font-black text-purple-600 block">{g.leave}</span>
                    <span className="text-[9px] text-slate-400 font-bold">ลา</span>
                  </div>
                  <div>
                    <span className="text-xs font-black text-rose-500 block">{g.absent}</span>
                    <span className="text-[9px] text-slate-400 font-bold">ขาด</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ================= รายงานรายวัน (Daily Log Accordion List View) ================= */
        <div className="space-y-4">
          {Object.keys(getDailyGroups(filteredHistory)).map((groupName) => {
            const logs = getDailyGroups(filteredHistory)[groupName];
            const isCollapsed = collapsedGroups[groupName] === true;

            return (
              <div key={groupName} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div
                  onClick={() => setCollapsedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }))}
                  className="flex justify-between items-center px-5 py-4 bg-slate-50 border-b border-slate-200 cursor-pointer select-none"
                >
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <FaCalendarAlt className="text-slate-400 text-[10px]" />
                    <span>ประจำเดือน {groupName}</span>
                    <span className="text-[10px] text-slate-400 font-medium">({logs.length} วัน)</span>
                  </h4>
                  <FaChevronDown
                    className={`text-slate-400 text-xs transition-transform duration-200 ${
                      isCollapsed ? "transform -rotate-90" : ""
                    }`}
                  />
                </div>

                {!isCollapsed && (
                  <div className="divide-y divide-slate-100 flex flex-col">
                    {logs.map((log: any) => {
                      const rateColorClass = log.rate >= 90 ? "bg-emerald-500" : log.rate >= 75 ? "bg-amber-500" : "bg-rose-500";
                      const rateTextClass = log.rate >= 90 ? "text-emerald-600" : log.rate >= 75 ? "text-amber-600" : "text-rose-600";

                      return (
                        <div
                          key={`${log.date}_${log.classId}`}
                          className="px-5 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative pl-7 hover:bg-slate-50/50 transition-all"
                        >
                          <div className={`absolute top-0 left-0 bottom-0 w-1 ${rateColorClass}`} />

                          <div className="space-y-2">
                            <h5 className="font-bold text-slate-800 text-sm flex items-center gap-2 flex-wrap">
                              <span>รายงานเข้าเรียนประจำวันที่ {formatThaiDate(log.date)}</span>
                              <span className="bg-sky-50 text-sky-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-sky-100">
                                ห้อง {log.classLabel}/{log.roomLabel}
                              </span>
                            </h5>

                            <div className="flex flex-wrap gap-2 text-[10px] font-bold select-none">
                              <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded">
                                นักเรียน: {log.total} คน
                              </span>
                              <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded">
                                มาเรียน: {log.present}
                              </span>
                              <span className="px-2 py-0.5 bg-amber-50 border border-amber-100 text-amber-700 rounded">
                                สาย: {log.late}
                              </span>
                              <span className="px-2 py-0.5 bg-purple-50 border border-purple-100 text-purple-700 rounded">
                                ลา: {log.leave}
                              </span>
                              <span className="px-2 py-0.5 bg-rose-50 border border-rose-100 text-rose-700 rounded">
                                ขาด: {log.absent}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t border-slate-100 md:border-none pt-3 md:pt-0">
                            <div className="text-right">
                              <span className={`text-base font-black block ${rateTextClass}`}>{log.rate}%</span>
                              <span className="text-[9px] font-bold text-slate-400">อัตราเข้าเรียน</span>
                            </div>
                            <button
                              onClick={() => onViewDetails(log.classId, log.date)}
                              className="px-3.5 py-2 bg-slate-100 border border-slate-200 text-slate-700 hover:bg-sky-500 hover:text-white hover:border-sky-500 rounded-lg text-xs font-bold transition flex items-center gap-1"
                            >
                              <FaSearch className="text-[10px]" />
                              <span>ดูรายละเอียด</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
