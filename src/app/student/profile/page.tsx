import { getCurrentProfile } from "@/app/actions/profile";
import ProfileSettings from "@/components/profile/ProfileSettings";
import { redirect } from "next/navigation";

// หน้าจัดการโปรไฟล์สำหรับนักเรียน (Server Component)
export default async function StudentProfilePage() {
  // ดึงข้อมูลผู้ใช้ปัจจุบันจาก Database ผ่านคุกกี้เซสชัน
  const user = await getCurrentProfile();

  // หากตรวจไม่พบข้อมูลผู้ใช้ (เช่น เซสชันหมดอายุหรือแฮกเข้าหลังบ้าน) ให้เด้งกลับหน้าล็อกอิน
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="py-6">
      {/* 
        ส่งผ่านข้อมูลผู้ใช้ไปให้ Client Component 
        ซึ่งจะถูกล็อกโดยอัตโนมัติเนื่องจากมีบทบาทเป็น STUDENT
      */}
      <ProfileSettings initialUser={user} />
    </div>
  );
}
