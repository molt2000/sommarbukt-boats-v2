"use client";
import { QRCodeSVG } from "qrcode.react";
import { CreditCard, ExternalLink } from "lucide-react";
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
    <div className="mt-4 p-5 bg-brand/5 border border-brand/20 rounded-xl space-y-4">
      <div className="flex items-center gap-2 text-brand-dark">
        <CreditCard className="w-5 h-5" />
        <span className="font-semibold text-sm">Take payment now (optional)</span>
      </div>
      <p className="text-sm text-gray-500 -mt-2">
        Scan with the guest&apos;s phone, or open the link on this device.
      </p>
      <div className="flex justify-center">
        <div className="p-3 bg-white rounded-xl shadow-sm">
          <QRCodeSVG value={url} size={160} />
        </div>
      </div>
      <Button
        size="lg"
        onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
      >
        <ExternalLink className="w-5 h-5 mr-2" /> Open Payment Link
      </Button>
    </div>
  );
}
