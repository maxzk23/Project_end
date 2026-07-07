import { db } from "@/lib/db";
import { FaUserGraduate, FaChalkboardTeacher, FaSchool, FaBookOpen } from "react-icons/fa";

// Next.js App Router จะให้ฟังก์ชันนี้ทำงานในฝั่ง Server อัตโนมัติ (Server Component)
export default async function Home() {
  // ดึงข้อมูลจำนวนสถิติและรายชื่อแบบเรียลไทม์จาก PostgreSQL
  const totalStudents = await db.user.count({ where: { role: "STUDENT" } });
  const totalClassrooms = await db.classroom.count();
  const students = await db.user.findMany({
    where: { role: "STUDENT" },
    orderBy: { name: "asc" },
  });
  const classrooms = await db.classroom.findMany({
    include: {
      teacher: true, // ดึงข้อมูลคุณครูผู้สอนที่เชื่อมโยงอยู่ขึ้นมาด้วย
    },
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* หัวข้อเว็บแอปพลิเคชัน */}
        <header className="text-center space-y-2">
          <div className="inline-flex p-3 bg-sky-100 text-sky-600 rounded-2xl mb-2">
            <FaSchool className="text-4xl" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">
            ระบบจัดการการเรียนรู้ (LMS) - วิทยาลัยเทคโนโลยี
          </h1>
          <p className="text-slate-500">
            ฐานข้อมูลเชื่อมต่อ PostgreSQL สำเร็จ • กำลังดึงข้อมูลสดจากระบบ Localhost
          </p>
        </header>

        {/* บล็อกสรุปสถิติจำนวนย่อย (Dashboard Cards) */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="p-4 bg-sky-50 text-sky-600 rounded-xl">
              <FaChalkboardTeacher className="text-2xl" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">ห้องเรียนทั้งหมด</p>
              <h3 className="text-2xl font-bold text-slate-700">{totalClassrooms} ห้องเรียน</h3>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl">
              <FaUserGraduate className="text-2xl" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">นักเรียนรวมในระบบ</p>
              <h3 className="text-2xl font-bold text-slate-700">{totalStudents} คน</h3>
            </div>
          </div>
        </section>

        {/* แสดงผลห้องเรียนในระบบ */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FaBookOpen className="text-sky-500" /> รายชื่อวิชาและห้องเรียน
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {classrooms.map((room) => (
              <div key={room.id} className="p-4 rounded-xl bg-slate-50 border border-slate-150 space-y-2">
                <h4 className="font-bold text-slate-700">{room.name} ({room.yearLevel}/{room.room})</h4>
                <p className="text-xs text-slate-400">ปีการศึกษา: {room.academicYear}</p>
                <div className="text-sm text-slate-500 flex items-center gap-2 pt-1 border-t border-slate-200">
                  <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                  <span>ครูผู้สอน: {room.teacher.name}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* แสดงรายชื่อนักเรียนที่ดึงสดจาก DB */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FaUserGraduate className="text-sky-500" /> ทำเนียบนักเรียนตัวอย่าง (Seed Data)
          </h2>
          <div className="overflow-hidden rounded-xl border border-slate-150">
            <table className="min-w-full divide-y divide-slate-200 bg-white">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">รูปโปรไฟล์</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">ชื่อ-นามสกุล</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">บทบาท</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <img 
                        src={student.avatarUrl || "https://via.placeholder.com/150"} 
                        alt={student.name}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-700">{student.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      <span className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-600 rounded-full">
                        {student.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-600 rounded-full">
                        {student.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
