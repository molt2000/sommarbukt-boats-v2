"use client";
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => {
    const base = "inline-flex items-center justify-center font-medium rounded-lg transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none";
    const variants = {
      primary: "bg-brand text-white hover:bg-brand-dark",
      secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-200",
      danger: "bg-red-600 text-white hover:bg-red-700",
      ghost: "text-gray-600 hover:bg-gray-100",
    };
    const sizes = { sm: "px-3 py-2 text-sm", md: "px-5 py-3 text-base", lg: "w-full px-6 py-4 text-lg" };
    return <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} disabled={disabled} {...props} />;
  }
);
Button.displayName = "Button";
export default Button;
