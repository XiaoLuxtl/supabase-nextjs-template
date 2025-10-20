// src/components/CreditBalance.tsx
"use client";

import React from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";

interface CreditBalanceProps {
  showIcon?: boolean;
  showLabel?: boolean;
  className?: string;
  variant?: "default" | "compact" | "badge" | "centered";
  onClick?: () => void;
}

export function CreditBalance({
  showIcon = true,
  showLabel = true,
  className = "",
  variant = "default",
  onClick,
}: CreditBalanceProps) {
  const { balance, loading, getCreditsDisplay } = useCredits();

  const baseClasses =
    "flex items-center justify-center gap-2 transition-colors";

  const variantClasses = {
    default: "text-emerald-500",
    compact: "text-sm text-emerald-600",
    badge:
      "bg-emerald-500/20 border border-emerald-500 rounded-full px-3 py-1 text-emerald-600 text-center",
    centered: "text-emerald-500 text-center w-auto mx-auto",
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick();
    }
  };

  if (onClick) {
    return (
      <button
        className={`${classes} cursor-pointer hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded-md`}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        type="button"
      >
        {showIcon && <CreditCard className="h-4 w-4 flex-shrink-0" />}
        {showLabel && <span className="whitespace-nowrap">Créditos:</span>}
        <span className="font-semibold whitespace-nowrap">
          {getCreditsDisplay(balance)}
        </span>
      </button>
    );
  }

  return (
    <div className={classes}>
      {showIcon && <CreditCard className="h-4 w-4 flex-shrink-0" />}
      {showLabel && <span className="whitespace-nowrap">Créditos:</span>}
      <span className="font-semibold whitespace-nowrap">
        {getCreditsDisplay(balance)}
      </span>
    </div>
  );
}

// Componente específico para mostrar balance en header/navbar
export function CreditBalanceHeader({
  onClick,
}: {
  readonly onClick?: () => void;
}) {
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
export function CreditStatus({ cost = 1 }: { readonly cost?: number }) {
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
