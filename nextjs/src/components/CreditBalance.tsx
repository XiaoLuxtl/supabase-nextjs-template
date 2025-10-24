// src/components/CreditBalance.tsx
"use client";

import React from "react";
import { CreditCard, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";

interface CreditBalanceProps {
  showIcon?: boolean;
  showLabel?: boolean;
  className?: string;
  variant?: "default" | "compact" | "badge" | "centered" | "minimal";
  onClick?: () => void;
  showStatus?: boolean;
  showRefreshButton?: boolean;
}

export function CreditBalance({
  showIcon = true,
  showLabel = true,
  className = "",
  variant = "default",
  onClick,
  showStatus = false,
  showRefreshButton = false,
}: CreditBalanceProps) {
  const {
    balance,
    isLoading,
    getCreditsDisplay,
    forceRefreshBalance,
    hasCredits,
  } = useCredits();

  const baseClasses =
    "flex items-center justify-center gap-2 transition-colors";

  const variantClasses = {
    default: "text-emerald-600 hover:text-emerald-700",
    compact: "text-sm text-emerald-600",
    badge:
      "bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 text-emerald-700 hover:bg-emerald-100 transition-colors",
    centered: "text-emerald-600 text-center w-auto mx-auto",
    minimal: "text-emerald-600 text-sm",
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${className} ${
    onClick ? "cursor-pointer hover:opacity-80" : ""
  }`.trim();

  // Manejo de estados de carga y error mejorado
  if (isLoading && variant !== "minimal") {
    return (
      <div className={classes} role="status" aria-label="Cargando créditos">
        {showIcon && <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />}
        <span className="text-gray-500">Cargando...</span>
      </div>
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick();
    }
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevenir trigger del onClick principal
    forceRefreshBalance();
  };

  const BalanceContent = (
    <>
      {showIcon && (
        <CreditCard className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      )}
      {showLabel && <span className="whitespace-nowrap">Créditos:</span>}
      <span
        className="font-semibold whitespace-nowrap"
        aria-live="polite"
        aria-atomic="true"
      >
        {getCreditsDisplay(balance)}
      </span>

      {showStatus && (
        <div className="flex items-center gap-1 ml-2">
          {hasCredits ? (
            <CheckCircle2
              className="h-3 w-3 text-emerald-500"
              aria-label="Créditos disponibles"
            />
          ) : (
            <AlertCircle
              className="h-3 w-3 text-amber-500"
              aria-label="Sin créditos"
            />
          )}
        </div>
      )}

      {showRefreshButton && (
        <button
          onClick={handleRefresh}
          className="ml-1 p-1 rounded hover:bg-gray-100 transition-colors"
          aria-label="Actualizar saldo"
          type="button"
        >
          <Loader2 className="h-3 w-3" />
        </button>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        className={`${classes} focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded-md`}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        type="button"
        aria-label={`Saldo actual: ${getCreditsDisplay(
          balance
        )}. Click para más opciones`}
      >
        {BalanceContent}
      </button>
    );
  }

  return (
    <div
      className={classes}
      aria-label={`Saldo actual: ${getCreditsDisplay(balance)}`}
    >
      {BalanceContent}
    </div>
  );
}

// Componente específico para header/navbar - MEJORADO
export function CreditBalanceHeader({
  onClick,
  showRefresh = true,
}: {
  readonly onClick?: () => void;
  readonly showRefresh?: boolean;
}) {
  return (
    <CreditBalance
      variant="badge"
      showLabel={false}
      showRefreshButton={showRefresh}
      onClick={onClick}
      className="text-sm font-medium shadow-sm hover:shadow transition-shadow"
      aria-label="Balance de créditos en header"
    />
  );
}

// Componente para mostrar estado de créditos - MEJORADO
export function CreditStatus({
  cost = 1,
  showBalance = true,
  variant = "default",
}: {
  readonly cost?: number;
  readonly showBalance?: boolean;
  readonly variant?: "default" | "compact" | "minimal";
}) {
  const { canAfford, hasCredits, balance, isLoading } = useCredits();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-500" role="status">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className={variant === "compact" ? "text-xs" : "text-sm"}>
          Verificando créditos...
        </span>
      </div>
    );
  }

  if (!hasCredits) {
    return (
      <div
        className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200"
        role="alert"
        aria-label="Sin créditos disponibles"
      >
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <div>
          <span
            className={
              variant === "compact"
                ? "text-xs font-medium"
                : "text-sm font-medium"
            }
          >
            Sin créditos disponibles
          </span>
          {showBalance && (
            <p
              className={
                variant === "compact"
                  ? "text-xs text-red-500"
                  : "text-sm text-red-500"
              }
            >
              Saldo actual: {balance}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!canAfford(cost)) {
    return (
      <div
        className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200"
        role="alert"
        aria-label="Créditos insuficientes"
      >
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <div>
          <span
            className={
              variant === "compact"
                ? "text-xs font-medium"
                : "text-sm font-medium"
            }
          >
            Créditos insuficientes
          </span>
          {showBalance && (
            <p
              className={
                variant === "compact"
                  ? "text-xs text-amber-500"
                  : "text-sm text-amber-500"
              }
            >
              Necesitas {cost}, tienes {balance}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200"
      role="status"
      aria-label="Créditos suficientes disponibles"
    >
      <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
      <div>
        <span
          className={
            variant === "compact"
              ? "text-xs font-medium"
              : "text-sm font-medium"
          }
        >
          {cost === 1 ? "Listo para generar" : "Créditos suficientes"}
        </span>
        {showBalance && (
          <p
            className={
              variant === "compact"
                ? "text-xs text-emerald-500"
                : "text-sm text-emerald-500"
            }
          >
            {balance} créditos disponibles
          </p>
        )}
      </div>
    </div>
  );
}

// NUEVO: Componente para mostrar balance optimista durante transacciones
export function OptimisticCreditBalance({
  pendingBalance,
  transactionType,
}: {
  readonly pendingBalance: number;
  readonly transactionType: "consumption" | "purchase" | "refund";
}) {
  const { balance, getCreditsDisplay } = useCredits();

  const isProcessing = pendingBalance !== balance;

  if (!isProcessing) return null;

  const transactionLabels = {
    consumption: "Consumiendo créditos...",
    purchase: "Aplicando compra...",
    refund: "Procesando reembolso...",
  };

  return (
    <div
      className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 animate-pulse"
      role="status"
      aria-label="Transacción en proceso"
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      <div className="text-sm">
        <span className="font-medium">
          {transactionLabels[transactionType]}
        </span>
        <p className="text-blue-500">
          Saldo temporal: {getCreditsDisplay(pendingBalance)}
        </p>
      </div>
    </div>
  );
}
