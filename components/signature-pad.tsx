"use client";
import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import Button from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface Props {
  value: string;
  onChange: (dataUrl: string) => void;
}

export default function SignaturePad({ value, onChange }: Props) {
  const sigRef = useRef<SignatureCanvas>(null);
  const [signed, setSigned] = useState(!!value);

  const clear = () => {
    sigRef.current?.clear();
    setSigned(false);
    onChange("");
  };

  const handleEnd = () => {
    if (sigRef.current && !sigRef.current.isEmpty()) {
      setSigned(true);
      onChange(sigRef.current.toDataURL("image/png"));
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <SignatureCanvas
          ref={sigRef}
          canvasProps={{
            className: `signature-canvas w-full ${signed ? "signed" : ""}`,
            style: { height: 200 },
          }}
          penColor="#1A1A1A"
          minWidth={1.5}
          maxWidth={3}
          onEnd={handleEnd}
        />
        {!signed && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-gray-400 text-lg">Sign here</span>
          </div>
        )}
      </div>
      <Button variant="ghost" size="sm" onClick={clear} type="button">
        <RotateCcw className="w-4 h-4 mr-2" /> Clear
      </Button>
    </div>
  );
}
