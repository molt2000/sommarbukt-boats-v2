"use client";
import { ReactNode } from "react";

export default function Field({ label, children, optional }: { label: string; children: ReactNode; optional?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-600">
        {label}
        {optional && <span className="text-gray-400 font-normal ml-1">(optional)</span>}
      </label>
      {children}
    </div>
  );
}
