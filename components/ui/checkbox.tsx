"use client";
import { Check } from "lucide-react";

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  required?: boolean;
}

export default function Checkbox({ checked, onChange, label, required }: Props) {
  return (
    <label className="flex items-center gap-3 py-3 px-1 cursor-pointer select-none active:bg-gray-50 rounded-lg transition">
      <div
        className={`w-7 h-7 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
          checked ? "bg-brand border-brand" : "border-gray-300 bg-white"
        }`}
        onClick={() => onChange(!checked)}
      >
        {checked && <Check className="w-5 h-5 text-white" strokeWidth={3} />}
      </div>
      <span className="text-base text-gray-800">{label}{required && !checked && <span className="text-red-500 ml-1">*</span>}</span>
    </label>
  );
}
