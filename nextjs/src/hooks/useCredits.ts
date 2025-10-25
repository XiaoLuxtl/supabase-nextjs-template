// src/hooks/useCredits.ts - VERSIÓN SIMPLIFICADA Y SEGURA
"use client";

import { useCallback, useMemo, useEffect, useRef, useState } from "react";
import { createSPAClient } from "@/lib/supabase/client";
import { useGlobal } from "@/lib/context/GlobalContext";
import {
  isCreditsBalanceUpdate,
  isValidCreditsBalance,
  type UserProfileRealtimePayload,
} from "@/types/type-guards";

// Singleton para suscripciones
let globalSubscription: { unsubscribe: () => void } | null = null;
let subscriberCount = 0;

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
  const { user, loading: globalLoading, initialized } = useGlobal();

  const [balance, setBalance] = useState<number>(user?.credits_balance ?? 0);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const supabase = useMemo(() => createSPAClient(), []);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const isMounted = useRef(true);

  const { refreshUserProfile } = useGlobal();

  // Handler type-safe para updates en tiempo real
  const handleRealtimeUpdate = useCallback(
    (payload: UserProfileRealtimePayload) => {
      if (!isMounted.current) return;

      try {
        if (!isCreditsBalanceUpdate(payload)) {
          console.warn("Invalid credits balance update payload:", payload);
          return;
        }

        const { new: newData } = payload;
        const newBalance = newData.credits_balance;

        if (!isValidCreditsBalance(newBalance)) {
          console.error("Invalid credits balance:", newBalance);
          return;
        }

        // Verificar que el usuario coincide
        if (user && newData.id !== user.id) {
          console.warn("Credit update for different user");
          return;
        }

        console.log("✅ Credits balance updated:", {
          previous: balance,
          new: newBalance,
        });

        setBalance(newBalance);
        setLastUpdate(new Date());
      } catch (error) {
        console.error("Error processing realtime credits update:", error);
      }
    },
    [balance, user]
  );

  // Configurar suscripción en tiempo real
  useEffect(() => {
    if (!user?.id || !initialized) return;

    isMounted.current = true;

    const setupSubscription = async () => {
      try {
        if (globalSubscription) {
          subscriberCount++;
          subscriptionRef.current = globalSubscription;
          return;
        }

        const subscription = supabase
          .channel(`credits-${user.id}-${Date.now()}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "user_profiles",
              filter: `id=eq.${user.id}`,
            },
            (payload: unknown) => {
              const typedPayload = payload as UserProfileRealtimePayload;
              handleRealtimeUpdate(typedPayload);
            }
          )
          .subscribe((status, error) => {
            if (error) {
              console.error("Credits subscription error:", error);
            }
          });

        globalSubscription = subscription;
        subscriberCount++;
        subscriptionRef.current = subscription;
      } catch (error) {
        console.error("Error setting up credits subscription:", error);
      }
    };

    setupSubscription();

    return () => {
      isMounted.current = false;

      if (subscriptionRef.current && globalSubscription) {
        subscriberCount--;

        if (subscriberCount === 0) {
          globalSubscription.unsubscribe();
          globalSubscription = null;
        }

        subscriptionRef.current = null;
      }
    };
  }, [user?.id, initialized, supabase, handleRealtimeUpdate]);

  // Sincronizar con GlobalContext cuando el usuario cambia
  useEffect(() => {
    if (
      user?.credits_balance !== undefined &&
      user.credits_balance !== balance
    ) {
      setBalance(user.credits_balance);
    }
  }, [user?.credits_balance, balance]);

  // Función helper para fetch con retry
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

          if (
            response.status >= 400 &&
            response.status < 500 &&
            response.status !== 429
          ) {
            return response;
          }

          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
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

  // Consumir créditos - SOLO PARA USO DIRECTO (no desde useVideoGeneration)
  const consumeCreditsForVideo = useCallback(
    async (videoId: string, cost: number = 1) => {
      if (!user?.id) {
        throw new Error("Usuario no autenticado");
      }

      if (balance < cost) {
        throw new Error("Créditos insuficientes");
      }

      setIsLoading(true);

      try {
        const response = await fetchWithRetry("/api/credits/consume", {
          method: "POST",
          body: JSON.stringify({
            userId: user.id,
            videoId,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Error al consumir créditos");
        }

        // Actualizar balance desde la respuesta
        if (data.newBalance !== undefined) {
          setBalance(data.newBalance);
        }

        return {
          success: true,
          newBalance: data.newBalance,
        };
      } catch (error) {
        console.error("Error consumiendo créditos:", error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [user?.id, balance, fetchWithRetry]
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
          body: JSON.stringify({
            purchaseId,
            userId: user.id,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Error al aplicar compra");
        }

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
          body: JSON.stringify({
            videoId,
            userId: user.id,
          }),
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
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [refreshUserProfile]);

  // Utilidades
  const hasCredits = useMemo(() => balance > 0, [balance]);
  const canAfford = useCallback((cost: number) => balance >= cost, [balance]);
  const getCreditsDisplay = useCallback((credits: number) => {
    return `${credits} ${credits === 1 ? "crédito" : "créditos"}`;
  }, []);

  return {
    // Estado
    balance,
    isLoading: isLoading || globalLoading,
    initialized,
    hasCredits,
    lastUpdate,

    // Acciones
    canAfford,
    consumeCreditsForVideo,
    applyPurchaseCredits,
    refundVideoCredits,
    forceRefreshBalance,
    getCreditsDisplay,

    // Utilidades
    user,
    isAuthenticated: !!user,
  };
}
