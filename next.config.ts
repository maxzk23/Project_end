import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb", // เพิ่มขีดจำกัดขนาดไฟล์ในการอัปโหลดผ่าน Server Actions เป็น 50MB
    },
  },
};

export default nextConfig;
