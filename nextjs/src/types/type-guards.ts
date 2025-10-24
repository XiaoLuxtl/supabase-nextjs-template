// src/lib/type-guards.ts
import type { Database } from "@/types/database.types";

type Tables = Database["public"]["Tables"];
type UserProfileRow = Tables["user_profiles"]["Row"];

export interface UserProfileRealtimePayload {
  new: UserProfileRow | null;
  old: UserProfileRow | null;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  schema: string;
  table: string;
}

// Type guard principal para el payload
export function isUserProfilePayload(
  payload: unknown
): payload is UserProfileRealtimePayload {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const p = payload as Record<string, unknown>;

  if (
    !("eventType" in p) ||
    !["INSERT", "UPDATE", "DELETE"].includes(p.eventType as string)
  ) {
    return false;
  }

  if (!("schema" in p) || typeof p.schema !== "string") {
    return false;
  }

  if (!("table" in p) || p.table !== "user_profiles") {
    return false;
  }

  // Validar estructura de 'new'
  if (p.new !== null) {
    if (typeof p.new !== "object") return false;
    const newObj = p.new as Record<string, unknown>;
    if (
      typeof newObj.id !== "string" ||
      typeof newObj.credits_balance !== "number"
    ) {
      return false;
    }
  }

  // Validar estructura de 'old' (puede ser null)
  if (p.old !== null && typeof p.old !== "object") {
    return false;
  }

  return true;
}

// Type guard específico para créditos balance
export function isValidCreditsBalance(balance: unknown): balance is number {
  return (
    typeof balance === "number" &&
    Number.isInteger(balance) &&
    balance >= 0 &&
    balance <= 1000000 // Límite razonable
  );
}

// Type guard para payload con créditos
export function hasValidCreditsBalance(
  payload: unknown
): payload is { new: { credits_balance: number; id: string } } {
  if (!isUserProfilePayload(payload)) {
    return false;
  }

  if (!payload.new) {
    return false;
  }

  return isValidCreditsBalance(payload.new.credits_balance);
}

// Type guard para cambios de créditos específicamente
export function isCreditsBalanceUpdate(
  payload: unknown
): payload is UserProfileRealtimePayload & {
  new: { credits_balance: number; id: string };
} {
  return (
    isUserProfilePayload(payload) &&
    payload.new !== null &&
    isValidCreditsBalance(payload.new.credits_balance) &&
    typeof payload.new.id === "string"
  );
}
