// src/components/CreditBalance.tsx
"use client";

import React from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";

interface CreditBalanceProps {
  showIcon?: boolean;
  showLabel?: boolean;
  className?: string;
  variant?: "default" | "compact" | "badge";
  onClick?: () => void;
}

export function CreditBalance({
  showIcon = true,
  showLabel = true,
  className = "",
  variant = "default",
  onClick,
}: CreditBalanceProps) {
  const { balance, loading, hasCredits, getCreditsDisplay } = useCredits();

  const baseClasses = "flex items-center gap-2 transition-colors";

  const variantClasses = {
    default: "text-emerald-500",
    compact: "text-sm text-emerald-600",
    badge:
      "bg-emerald-500/20 border border-emerald-500 rounded-full px-3 py-1 text-emerald-600",
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${className}`;

  if (loading) {
    return (
      <div className={classes}>
        {showIcon && <Loader2 className="h-4 w-4 animate-spin" />}
        <span>Cargando...</span>
      </div>
    );
  }

  return (
    <div
      className={`${classes} ${
        onClick ? "cursor-pointer hover:opacity-80" : ""
      }`}
      onClick={onClick}
    >
      {showIcon && <CreditCard className="h-4 w-4" />}
      {showLabel && <span>Créditos:</span>}
      <span className="font-semibold">{getCreditsDisplay(balance)}</span>
    </div>
  );
}

// Componente específico para mostrar balance en header/navbar
export function CreditBalanceHeader({ onClick }: { onClick?: () => void }) {
  return (
    <CreditBalance
      variant="badge"
      showLabel={false}
      onClick={onClick}
      className="text-sm"
    />
  );
}

// Componente para mostrar si puede generar videos
export function CreditStatus({ cost = 1 }: { cost?: number }) {
  const { canAfford, hasCredits, balance } = useCredits();

  if (!hasCredits) {
    return (
      <div className="flex items-center gap-2 text-red-500">
        <CreditCard className="h-4 w-4" />
        <span className="text-sm">Sin créditos disponibles</span>
      </div>
    );
  }

  if (!canAfford(cost)) {
    return (
      <div className="flex items-center gap-2 text-orange-500">
        <CreditCard className="h-4 w-4" />
        <span className="text-sm">Créditos insuficientes</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-emerald-500">
      <CreditCard className="h-4 w-4" />
      <span className="text-sm">{balance} créditos disponibles</span>
    </div>
  );
}
