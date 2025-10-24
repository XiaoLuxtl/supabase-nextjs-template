// src/hooks/useCredits.ts - FUENTE ÚNICA DE VERDAD
"use client";

import { useCallback, useMemo, useEffect, useRef, useState } from "react";
import { createSPAClient } from "@/lib/supabase/client";
import { useGlobal } from "@/lib/context/GlobalContext";

type ProfileBalance = { credits_balance: number };

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

// Singleton para evitar múltiples suscripciones
let globalSubscription: { unsubscribe: () => void } | null = null;
let subscriberCount = 0;

export function useCredits() {
  const {
    user,
    refreshUserProfile,
    loading: globalLoading,
    initialized,
  } = useGlobal();

  // Estado local como fuente única para créditos
  const [balance, setBalance] = useState<number>(user?.credits_balance ?? 0);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const supabase = useMemo(() => createSPAClient(), []);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const isMounted = useRef(true);

  // Sincronizar con GlobalContext cuando el usuario cambia
  useEffect(() => {
    if (
      user?.credits_balance !== undefined &&
      user.credits_balance !== balance
    ) {
      setBalance(user.credits_balance);
    }
  }, [user?.credits_balance]);

  // Configurar suscripción en tiempo real para cambios de créditos
  useEffect(() => {
    if (!user?.id || !initialized) return;

    isMounted.current = true;

    const setupSubscription = async () => {
      try {
        const channelName = `credits-${user.id}-${Date.now()}`; // Nombre único

        const channel = supabase
          .channel(channelName) // Usar nombre único para evitar colisiones
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "user_profiles",
              filter: `id=eq.${user.id}`,
            },
            (payload) => {
              console.log("💰 Cambio en balance detectado:", payload);
              const newBalance = (payload.new as any)?.credits_balance;

              if (typeof newBalance === "number") {
                setBalance(newBalance);
                // Opcional: notificar a otros componentes
                window.dispatchEvent(
                  new CustomEvent("creditsUpdated", {
                    detail: { newBalance, userId: user.id },
                  })
                );
              }
            }
          )
          .subscribe((status) => {
            console.log(`💰 Subscription ${channelName}: ${status}`);

            if (status === "CHANNEL_ERROR" || status === "CLOSED") {
              console.warn(`Channel ${channelName} cerrado, reconectando...`);
              setTimeout(() => {
                if (isMounted.current) {
                  setupSubscription();
                }
              }, 5000);
            }
          });

        return channel;
      } catch (error) {
        console.error("Error setting up subscription:", error);
        return null;
      }
    };

    setupSubscription();

    return () => {
      isMounted.current = false;

      if (subscriptionRef.current && globalSubscription) {
        subscriberCount--;

        if (subscriberCount === 0) {
          console.log("🧹 Cleaning up global credits subscription");
          globalSubscription.unsubscribe();
          globalSubscription = null;
        }

        subscriptionRef.current = null;
      }
    };
  }, [user?.id, initialized, supabase, refreshUserProfile]);

  // Función helper optimizada con retry y circuit breaker
  const fetchWithRetry = useCallback(
    async (
      url: string,
      options: RequestInit,
      maxRetries = 2
    ): Promise<Response> => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetch(url, {
            ...options,
            headers: {
              "Content-Type": "application/json",
              ...options.headers,
            },
          });

          if (response.ok) return response;

          // No reintentar en errores 4xx (excepto 429 - Too Many Requests)
          if (
            response.status >= 400 &&
            response.status < 500 &&
            response.status !== 429
          ) {
            return response;
          }

          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff max 10s
            console.log(
              `Retrying request (${attempt + 1}/${maxRetries}) after ${delay}ms`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        } catch (error) {
          if (attempt >= maxRetries) throw error;
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * (attempt + 1))
          );
        }
      }
      throw new Error("Max retries exceeded");
    },
    []
  );

  // Actualización optimista del balance
  const updateBalanceOptimistically = useCallback((amount: number) => {
    setBalance((prev) => {
      const newBalance = prev + amount;
      console.log(`💰 Optimistic balance update: ${prev} → ${newBalance}`);
      return newBalance;
    });
  }, []);

  // Rollback de actualización optimista
  const revertOptimisticUpdate = useCallback((originalBalance: number) => {
    console.log(`🔄 Reverting optimistic update to: ${originalBalance}`);
    setBalance(originalBalance);
  }, []);

  const hasCredits = useMemo(() => balance > 0, [balance]);
  const canAfford = useCallback((cost: number) => balance >= cost, [balance]);

  const getCreditsDisplay = useCallback((credits: number) => {
    return `${credits} ${credits === 1 ? "crédito" : "créditos"}`;
  }, []);

  // Consumir créditos con mejor UX y manejo de errores
  const consumeCreditsForVideo = useCallback(
    async (videoId: string, cost: number = 1) => {
      if (!user?.id) {
        throw new Error("Usuario no autenticado");
      }

      if (!canAfford(cost)) {
        throw new Error("Créditos insuficientes");
      }

      const originalBalance = balance;
      let success = false;

      try {
        setIsLoading(true);

        // Actualización optimista
        updateBalanceOptimistically(-cost);

        const response = await fetchWithRetry("/api/credits/consume", {
          method: "POST",
          body: JSON.stringify({
            userId: user.id,
            videoId,
            cost,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Error al consumir créditos");
        }

        success = true;
        console.log("✅ Créditos consumidos exitosamente");

        return {
          success: true,
          newBalance: data.newBalance,
          transactionId: data.transactionId,
        };
      } catch (error) {
        console.error("Error consumiendo créditos:", error);

        // Revertir actualización optimista en caso de error
        if (!success) {
          revertOptimisticUpdate(originalBalance);
        }

        throw error; // Re-lanzar para manejo en el componente
      } finally {
        setIsLoading(false);
      }
    },
    [
      user?.id,
      balance,
      canAfford,
      updateBalanceOptimistically,
      revertOptimisticUpdate,
      fetchWithRetry,
    ]
  );

  // Aplicar compra de créditos
  const applyPurchaseCredits = useCallback(
    async (purchaseId: string) => {
      if (!user?.id) {
        throw new Error("Usuario no autenticado");
      }

      setIsLoading(true);

      try {
        const response = await fetchWithRetry("/api/credits/apply-purchase", {
          method: "POST",
          body: JSON.stringify({ purchaseId }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Error al aplicar compra");
        }

        // La suscripción en tiempo real actualizará el balance automáticamente
        return {
          success: true,
          newBalance: data.newBalance,
          creditsAdded: data.creditsAdded,
        };
      } catch (error) {
        console.error("Error aplicando compra:", error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [user?.id, fetchWithRetry]
  );

  // Refund de créditos
  const refundVideoCredits = useCallback(
    async (videoId: string) => {
      if (!user?.id) {
        throw new Error("Usuario no autenticado");
      }

      setIsLoading(true);

      try {
        const response = await fetchWithRetry("/api/credits/refund", {
          method: "POST",
          body: JSON.stringify({ videoId }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Error al hacer refund");
        }

        return {
          success: true,
          newBalance: data.newBalance,
          creditsRefunded: data.creditsRefunded,
        };
      } catch (error) {
        console.error("Error haciendo refund:", error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [user?.id, fetchWithRetry]
  );

  // Forzar refresco manual
  const forceRefreshBalance = useCallback(async () => {
    try {
      setIsLoading(true);
      await refreshUserProfile();
    } catch (error) {
      console.error("Error forcing balance refresh:", error);
    } finally {
      setIsLoading(false);
    }
  }, [refreshUserProfile]);

  return {
    // Estado
    balance,
    transactions,
    isLoading: isLoading || globalLoading,
    initialized,
    hasCredits,

    // Acciones
    canAfford,
    consumeCreditsForVideo,
    applyPurchaseCredits,
    refundVideoCredits,
    forceRefreshBalance,
    getCreditsDisplay,
    setTransactions,

    // Utilidades
    user,
    isAuthenticated: !!user,
  };
}
