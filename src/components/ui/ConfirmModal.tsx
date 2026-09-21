"use client";

import React from "react";
import { FaTrash, FaExclamationTriangle, FaInfoCircle } from "react-icons/fa";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "ลบอย่างถาวร",
  cancelText = "ยกเลิก",
  variant = "danger",
  isLoading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (variant) {
      case "danger":
        return <FaTrash className="text-2xl text-rose-500" />;
      case "warning":
        return <FaExclamationTriangle className="text-2xl text-amber-500" />;
      default:
        return <FaInfoCircle className="text-2xl text-sky-500" />;
    }
  };

  const getIconBg = () => {
    switch (variant) {
      case "danger":
        return "bg-rose-50/80 border-rose-100";
      case "warning":
        return "bg-amber-50/80 border-amber-100";
      default:
        return "bg-sky-50/80 border-sky-100";
    }
  };

  const getConfirmBtnStyle = () => {
    switch (variant) {
      case "danger":
        return "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/25";
      case "warning":
        return "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25";
      default:
        return "bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/25";
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      {/* กล่องเนื้อหาของ Modal */}
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-sm sm:max-w-md rounded-[28px] shadow-2xl border border-slate-100 dark:border-slate-800 p-6 sm:p-7 text-center flex flex-col items-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ไอคอนวงกลมด้านบน */}
        <div className={`w-16 h-16 rounded-full border flex items-center justify-center mb-4 shrink-0 ${getIconBg()}`}>
          {getIcon()}
        </div>

        {/* หัวข้อเรื่อง */}
        <h3 className="text-lg sm:text-xl font-extrabold text-slate-800 dark:text-slate-100 text-center mb-2 tracking-tight">
          {title}
        </h3>

        {/* รายละเอียดคำอธิบาย */}
        <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-400 font-semibold text-center leading-relaxed mb-6 max-w-sm">
          {description}
        </p>

        {/* ปุ่มกดยืนยัน และ ปุ่มยกเลิก */}
        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-3 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-2xl text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer disabled:opacity-50 outline-none"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            disabled={isLoading}
            className={`flex-1 py-3 px-4 font-bold rounded-2xl text-xs sm:text-sm shadow-lg transition hover:scale-[1.02] active:scale-95 cursor-pointer disabled:opacity-50 outline-none ${getConfirmBtnStyle()}`}
          >
            {isLoading ? "กำลังดำเนินการ..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
