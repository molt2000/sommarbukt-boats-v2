"use client";
import { QRCodeSVG } from "qrcode.react";
import { ExternalLink } from "lucide-react";
import Button from "@/components/ui/button";

export default function PaymentQR() {
  const url = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK;

  if (!url) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("PaymentQR: NEXT_PUBLIC_STRIPE_PAYMENT_LINK is not set — payment option hidden.");
    }
    return null;
  }

  return (
    <div className="max-w-sm mx-auto space-y-3 pt-2 border-t border-gray-200">
      <p className="text-sm text-gray-500 pt-3">Take payment now (optional)</p>
      <div className="flex justify-center">
        <QRCodeSVG value={url} size={160} />
      </div>
      <Button
        size="lg"
        variant="secondary"
        onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
      >
        <ExternalLink className="w-5 h-5 mr-2" /> Open Payment Link
      </Button>
    </div>
  );
}
