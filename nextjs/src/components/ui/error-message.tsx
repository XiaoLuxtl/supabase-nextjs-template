"use client";

import React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorMessageProps {
  error: string | null;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  className,
}) => {
  if (!error) return null;

  return (
    <div
      className={cn(
        "bg-red-500/20 border border-red-500 rounded-lg p-4 flex items-start gap-3 animate-in fade-in duration-300",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-red-200 text-sm whitespace-pre-wrap">{error}</p>
      </div>
    </div>
  );
};

export default ErrorMessage;
