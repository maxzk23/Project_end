import { getCurrentProfile } from "@/app/actions/profile";
import ProfileSettings from "@/components/profile/ProfileSettings";
import { redirect } from "next/navigation";

// หน้าจัดการโปรไฟล์สำหรับคุณครู (Server Component)
export default async function TeacherProfilePage() {
  // ดึงข้อมูลผู้ใช้ปัจจุบันจาก Database ผ่านคุกกี้เซสชัน
  const user = await getCurrentProfile();

  // หากตรวจไม่พบข้อมูลผู้ใช้ (เช่น เซสชันหมดอายุ) ให้เด้งกลับหน้าล็อกอิน
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="py-6">
      {/* 
        ส่งผ่านข้อมูลผู้ใช้ไปให้ Client Component 
        ซึ่งจะได้รับสิทธิ์ในการแก้ไขชื่อและรูปประจำตัวเนื่องจากมีบทบาทเป็น TEACHER หรือ ADMIN
      */}
      <ProfileSettings initialUser={user} />
    </div>
  );
}
