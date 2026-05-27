"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getJsonItem, setJsonItem } from "@/lib/safe-storage";
import { getErrorMessage } from "@/lib/utils";

interface Boat {
  id: string;
  name: string;
  registration: string;
}

const DEFAULT_BOATS: Boat[] = [
  { id: "1", name: "Tind", registration: "" },
  { id: "2", name: "Nordlys", registration: "" },
];

function loadBoats(): Boat[] {
  if (typeof window === "undefined") return DEFAULT_BOATS;
  return getJsonItem("sb_boats", DEFAULT_BOATS);
}

export default function ConfigPage() {
  const router = useRouter();
  const [boats, setBoats] = useState<Boat[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      setBoats(loadBoats());
    } catch (error) {
      alert(getErrorMessage(error));
      setBoats(DEFAULT_BOATS);
    }
  }, []);

  function save() {
    try {
      setJsonItem("sb_boats", boats);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      alert(getErrorMessage(error));
    }
  }

  function updateBoat(id: string, value: string) {
    setBoats(prev => prev.map(b => b.id === id ? { ...b, registration: value } : b));
  }

  return (
    <div className="py-6 min-h-screen">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push("/")} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Configuration</h1>
          <p className="text-sm text-gray-500">Fleet</p>
        </div>
        <button onClick={save} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors" style={{ backgroundColor: saved ? "#16a34a" : "#1B2A4A" }}>
          {saved ? "Saved ✓" : "Save"}
        </button>
      </div>

      <div className="space-y-3">
        {boats.map(boat => (
          <div key={boat.id} className="rounded-xl border border-gray-100 p-4">
            <div className="flex gap-3 items-center">
              <span className="font-medium text-gray-800 flex-1 py-2">{boat.name}</span>
              <input className="w-28 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 focus:outline-none focus:border-brand" value={boat.registration} onChange={e => updateBoat(boat.id, e.target.value)} placeholder="Reg. no." />
            </div>
          </div>
        ))}
        <p className="text-xs text-gray-400">Edit registration numbers inline. Tap Save when done.</p>
      </div>
    </div>
  );
}
