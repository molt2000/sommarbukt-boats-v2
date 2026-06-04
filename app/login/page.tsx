"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/utils";
import Button from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error("Login failed. Check email and password.");
      router.push("/");
      router.refresh();
    } catch (e) {
      alert(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center max-w-sm mx-auto px-6 space-y-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">SOMMARBUKT</h1>
        <p className="text-sm text-gray-500 mt-0.5">Boat Rental — Staff Login</p>
      </div>
      <input className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && signIn()} />
      <Button size="lg" onClick={signIn} disabled={busy || !email || !password}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </div>
  );
}
