// src/hooks/useCredits.ts
"use client";

import { useCallback, useMemo } from "react";
import { useGlobal } from "@/lib/context/GlobalContext";
import { CreditsService } from "@/lib/creditsService";

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  balance_after: number;
  transaction_type: string;
  purchase_id?: string | null;
  video_id?: string | null;
  description: string;
  created_at: string;
}

export function useCredits() {
  const { user, refreshUserProfile, loading, isAuthenticated } = useGlobal();

  const balance = user?.credits_balance ?? 0;

  const refreshBalance = useCallback(async () => {
    await refreshUserProfile();
  }, [refreshUserProfile]);

  const hasCredits = useMemo(() => balance > 0, [balance]);

  const canAfford = useCallback((cost: number) => balance >= cost, [balance]);

  const getCreditsDisplay = useCallback((credits: number) => {
    return `${credits} ${credits === 1 ? "crédito" : "créditos"}`;
  }, []);

  // Acciones avanzadas usando el servicio centralizado
  const consumeCreditsForVideo = useCallback(
    async (videoId: string) => {
      if (!user?.id) return { success: false, newBalance: balance };
      return await CreditsService.consumeCreditsForVideo(user.id, videoId);
    },
    [user?.id, balance]
  );

  const applyPurchaseCredits = useCallback(async (purchaseId: string) => {
    return await CreditsService.applyPurchaseCredits(purchaseId);
  }, []);

  const refundVideoCredits = useCallback(async (videoId: string) => {
    return await CreditsService.refundVideoCredits(videoId);
  }, []);

  return {
    // Estado
    balance,
    loading,
    hasCredits,

    // Acciones
    refreshBalance,
    canAfford,
    consumeCreditsForVideo,
    applyPurchaseCredits,
    refundVideoCredits,
    getCreditsDisplay,

    // Utilidades
    user,
    isAuthenticated,
  };
}
