// src/hooks/useCredits.ts
"use client";

import { useCallback, useMemo } from "react";
import { useGlobal } from "@/lib/context/GlobalContext";

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
  const { user, refreshUserProfile, loading, isAuthenticated, sessionHealth } =
    useGlobal();

  const balance = user?.credits_balance ?? 0;

  // Función helper para hacer requests con retry
  const fetchWithRetry = useCallback(
    async (
      url: string,
      options: RequestInit,
      maxRetries = 2
    ): Promise<Response> => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetch(url, options);

          // Si es exitoso, retornar
          if (response.ok) {
            return response;
          }

          // Si es error de servidor, reintentar
          if (response.status >= 500 && attempt < maxRetries) {
            console.log(
              `Server error, retrying (${attempt + 1}/${maxRetries})`
            );
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * (attempt + 1))
            );
            continue;
          }

          // Si es error de cliente (4xx), no reintentar
          return response;
        } catch (error) {
          // Error de red
          if (attempt < maxRetries) {
            console.log(
              `Network error, retrying (${attempt + 1}/${maxRetries})`
            );
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * (attempt + 1))
            );
            continue;
          }
          throw error;
        }
      }

      throw new Error("Max retries exceeded");
    },
    []
  );

  const hasCredits = useMemo(() => balance > 0, [balance]);

  const canAfford = useCallback((cost: number) => balance >= cost, [balance]);

  const getCreditsDisplay = useCallback((credits: number) => {
    return `${credits} ${credits === 1 ? "crédito" : "créditos"}`;
  }, []);

  // Acciones avanzadas usando el servicio centralizado
  const consumeCreditsForVideo = useCallback(
    async (videoId: string) => {
      if (!user?.id) return { success: false, newBalance: balance };

      // Validar health de la sesión antes de proceder
      if (sessionHealth !== "healthy") {
        console.warn(
          "Session health check failed, attempting refresh before credit consumption"
        );
        await refreshUserProfile();
        // Continuar de todas formas - refreshUserProfile maneja los errores
      }

      try {
        const response = await fetchWithRetry("/api/credits/consume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, videoId }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error("Failed to consume credits:", data.error);
          return { success: false, newBalance: balance };
        }

        // El balance se actualiza automáticamente via suscripción en tiempo real
        return { success: true, newBalance: data.newBalance };
      } catch (error) {
        console.error("Error consuming credits:", error);
        return { success: false, newBalance: balance };
      }
    },
    [user?.id, balance, sessionHealth, refreshUserProfile, fetchWithRetry]
  );

  const applyPurchaseCredits = useCallback(
    async (purchaseId: string) => {
      // Validar health de la sesión antes de proceder
      if (sessionHealth !== "healthy") {
        console.warn(
          "Session health check failed, attempting refresh before purchase application"
        );
        await refreshUserProfile();
        // Continuar de todas formas - refreshUserProfile maneja los errores
      }

      try {
        const response = await fetchWithRetry("/api/credits/apply-purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purchaseId }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error("Failed to apply purchase:", data.error);
          return { success: false, newBalance: balance };
        }

        // El balance se actualiza automáticamente via suscripción en tiempo real
        return { success: true, newBalance: data.newBalance };
      } catch (error) {
        console.error("Error applying purchase:", error);
        return { success: false, newBalance: balance };
      }
    },
    [balance, sessionHealth, refreshUserProfile, fetchWithRetry]
  );

  const refundVideoCredits = useCallback(
    async (videoId: string) => {
      // Validar health de la sesión antes de proceder
      if (sessionHealth !== "healthy") {
        console.warn(
          "Session health check failed, attempting refresh before refund"
        );
        await refreshUserProfile();
        // Continuar de todas formas - refreshUserProfile maneja los errores
      }

      try {
        const response = await fetchWithRetry("/api/credits/refund", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error("Failed to refund credits:", data.error);
          return { success: false, newBalance: balance };
        }

        // El balance se actualiza automáticamente via suscripción en tiempo real
        return { success: true, newBalance: data.newBalance };
      } catch (error) {
        console.error("Error refunding credits:", error);
        return { success: false, newBalance: balance };
      }
    },
    [balance, sessionHealth, refreshUserProfile, fetchWithRetry]
  );

  return {
    // Estado
    balance,
    loading,
    hasCredits,

    // Acciones
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
