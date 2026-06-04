"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRentals } from "@/lib/storage";
import { Rental } from "@/lib/types";
import { formatDate, getErrorMessage } from "@/lib/utils";
import Button from "@/components/ui/button";
import { Plus, Ship, ArrowRight, Clock, CheckCircle2, Search, Settings } from "lucide-react";

export default function Dashboard() {
  const router = useRouter();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setRentals(await getRentals());
      } catch (error) {
        alert(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const active = rentals.filter(r => r.status === "active");
  const completed = rentals.filter(r => r.status === "completed");
  const filtered = search
    ? rentals.filter(r => r.guestName.toLowerCase().includes(search.toLowerCase()) || r.boatName.toLowerCase().includes(search.toLowerCase()))
    : null;

  return (
    <div className="py-8 space-y-8">
      {loading && <p className="text-center text-gray-400 py-20">Loading…</p>}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SOMMARBUKT</h1>
          <p className="text-sm text-gray-500 mt-0.5">Boat Rental</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push("/config")} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition"><Settings className="w-5 h-5 text-gray-500" /></button>
          <Button size="md" onClick={() => router.push("/rental/new")}>
            <Plus className="w-5 h-5 mr-2" /> New Rental
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Active" value={active.length} icon={<Ship className="w-5 h-5" />} />
        <StatCard label="Today" value={rentals.filter(r => r.createdAt.startsWith(new Date().toISOString().slice(0, 10))).length} icon={<Clock className="w-5 h-5" />} />
        <StatCard label="Completed" value={completed.length} icon={<CheckCircle2 className="w-5 h-5" />} />
      </div>

      {/* Active Rentals */}
      {active.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Active Rentals</h2>
          <div className="space-y-3">
            {active.map(r => (
              <RentalCard key={r.id} rental={r} onClick={() => router.push(`/rental/${r.id}`)} />
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-base focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            placeholder="Search rentals..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {filtered && (
          <div className="space-y-2">
            {filtered.length === 0 && <p className="text-gray-400 text-center py-6">No results</p>}
            {filtered.map(r => (
              <RentalCard key={r.id} rental={r} onClick={() => router.push(`/rental/${r.id}`)} compact />
            ))}
          </div>
        )}
      </div>

      {/* Recent Completed */}
      {!search && completed.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Recent Completed</h2>
          <div className="space-y-2">
            {completed.slice(0, 10).map(r => (
              <RentalCard key={r.id} rental={r} onClick={() => router.push(`/rental/${r.id}`)} compact />
            ))}
          </div>
        </div>
      )}

      {!loading && rentals.length === 0 && (
        <div className="text-center py-20">
          <Ship className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">No rentals yet</p>
          <p className="text-gray-400 text-sm mt-1">Tap "New Rental" to get started</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 text-center">
      <div className="text-gray-400 mb-1 flex justify-center">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function RentalCard({ rental, onClick, compact }: { rental: Rental; onClick: () => void; compact?: boolean }) {
  return (
    <button onClick={onClick} className="w-full text-left rounded-xl border border-gray-100 p-4 hover:bg-gray-50 transition flex items-center gap-4 active:scale-[0.99]">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${rental.status === "active" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"}`}>
        <Ship className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{rental.guestName || "Unnamed"}</div>
        {!compact && <div className="text-sm text-gray-500">{rental.boatName} · Return: {formatDate(rental.returnDate)}</div>}
        {compact && <div className="text-sm text-gray-400">{rental.boatName} · {formatDate(rental.createdAt)}</div>}
      </div>
      <div className="flex items-center gap-2">
        {rental.status === "active" && <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Active</span>}
        <ArrowRight className="w-4 h-4 text-gray-300" />
      </div>
    </button>
  );
}
