"use client";
import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/upload";

export default function StoredImg({ path, className, onClick }: { path: string; className?: string; onClick?: () => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    if (!path) { setUrl(""); return; }
    getSignedUrl(path).then((u) => { if (active) setUrl(u); }).catch((e) => console.error("Could not load image:", e));
    return () => { active = false; };
  }, [path]);
  if (!url) return <div className={className} style={{ background: "#f3f4f6" }} />;
  return <img src={url} className={className} alt="" onClick={onClick} />;
}
