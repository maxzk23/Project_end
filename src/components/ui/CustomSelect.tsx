"use client";

import { useState, useRef, useEffect } from "react";
import { FaChevronDown, FaCheck } from "react-icons/fa";

export interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  accentColor?: "purple" | "emerald" | "blue" | "amber";
  align?: "left" | "right" | "auto";
}

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "เลือกรายการ...",
  className = "",
  accentColor = "purple",
  align = "auto",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [resolvedAlign, setResolvedAlign] = useState<"left" | "right">("left");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // ปิดดร็อปดาวน์เมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // คำนวณตำแหน่งอัตโนมัติเมื่อเปิด dropdown
  useEffect(() => {
    if (isOpen && align === "auto" && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      // ถ้าปุ่มอยู่ครึ่งขวาของหน้าจอ → ชิดขวา, ไม่งั้น → ชิดซ้าย
      setResolvedAlign(rect.left + rect.width / 2 > viewportWidth / 2 ? "right" : "left");
    } else if (align !== "auto") {
      setResolvedAlign(align);
    }
  }, [isOpen, align]);

  const colorStyles = {
    purple: {
      activeBg: "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold",
      activeIcon: "text-purple-600 dark:text-purple-400",
      ring: "focus:ring-purple-500/20 focus:border-purple-500",
      chevronActive: "text-purple-600 dark:text-purple-400"
    },
    emerald: {
      activeBg: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold",
      activeIcon: "text-emerald-600 dark:text-emerald-400",
      ring: "focus:ring-emerald-500/20 focus:border-emerald-500",
      chevronActive: "text-emerald-600 dark:text-emerald-400"
    },
    blue: {
      activeBg: "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold",
      activeIcon: "text-blue-600 dark:text-blue-400",
      ring: "focus:ring-blue-500/20 focus:border-blue-500",
      chevronActive: "text-blue-600 dark:text-blue-400"
    },
    amber: {
      activeBg: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold",
      activeIcon: "text-amber-600 dark:text-amber-400",
      ring: "focus:ring-amber-500/20 focus:border-amber-500",
      chevronActive: "text-amber-600 dark:text-amber-400"
    }
  };

  const style = colorStyles[accentColor] || colorStyles.purple;

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:shadow transition-all duration-150 outline-none ${style.ring} cursor-pointer`}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <FaChevronDown className={`text-xs text-slate-400 dark:text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? `rotate-180 ${style.chevronActive}` : ""}`} />
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 min-w-full max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-1.5 space-y-0.5 animate-in fade-in-50 zoom-in-95 duration-150 ${
            resolvedAlign === "right" ? "right-0" : "left-0"
          }`}
          style={{ minWidth: "160px", maxWidth: "min(340px, calc(100vw - 32px))" }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-colors duration-150 text-left cursor-pointer ${
                  isSelected
                    ? style.activeBg
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <FaCheck className={`${style.activeIcon} text-xs shrink-0 ml-2`} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
