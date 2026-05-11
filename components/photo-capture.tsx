"use client";
import { Camera, X, CheckCircle } from "lucide-react";
import { PhotoEntry } from "@/lib/types";
import { useRef } from "react";

interface Props {
  labels: string[];
  photos: PhotoEntry[];
  onChange: (photos: PhotoEntry[]) => void;
}

export default function PhotoCapture({ labels, photos, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingLabel = useRef("");

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const dataUrl = await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    // Resize to max 1200px for storage efficiency
    const resized = await resizeImage(dataUrl, 1200);

    const entry: PhotoEntry = {
      label: pendingLabel.current,
      dataUrl: resized,
      timestamp: new Date().toISOString(),
    };

    const updated = [...photos.filter(p => p.label !== entry.label), entry];
    onChange(updated);
    if (inputRef.current) inputRef.current.value = "";
  };

  const takePhoto = (label: string) => {
    pendingLabel.current = label;
    inputRef.current?.click();
  };

  const removePhoto = (label: string) => {
    onChange(photos.filter(p => p.label !== label));
  };

  return (
    <div className="space-y-3">
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCapture} />
      <div className="grid grid-cols-2 gap-3">
        {labels.map(label => {
          const photo = photos.find(p => p.label === label);
          return (
            <div key={label} className="relative">
              {photo ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200">
                  <img src={photo.dataUrl} alt={label} className="w-full h-32 object-cover" />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button onClick={() => removePhoto(label)} className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center">
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-400" />
                    <span className="text-xs text-white truncate">{label}</span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => takePhoto(label)}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 hover:border-brand hover:bg-brand/5 transition"
                >
                  <Camera className="w-6 h-6 text-gray-400" />
                  <span className="text-xs text-gray-500 text-center px-2">{label}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function resizeImage(dataUrl: string, maxSize: number): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width *= ratio;
        height *= ratio;
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.src = dataUrl;
  });
}
