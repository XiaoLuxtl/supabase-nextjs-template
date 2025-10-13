"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { createSPASassClient } from "@/lib/supabase/client";

export type User = {
  email: string;
  id: string;
  registered_at: Date;
  credits_balance: number;
};

interface GlobalContextType {
  loading: boolean;
  user: User | null;
  refreshUserProfile: () => Promise<void>;
  isAuthenticated: boolean; // ✅ Nuevo: estado explícito de autenticación
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

type ProfileBalance = { credits_balance: number };

export function GlobalProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false); // ✅ Nuevo estado

  const refreshUserProfile = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createSPASassClient();
      const client = supabase.getSupabaseClient();
      const {
        data: { user: authUser },
        error,
      } = await client.auth.getUser();

      if (error) {
        console.error("Error getting user:", error);
        setUser(null);
        setIsAuthenticated(false);
        return;
      }

      if (authUser) {
        // Obtener créditos
        const { data } = await client
          .from("user_profiles")
          .select("credits_balance")
          .eq("id", authUser.id)
          .single();

        const profile = data as ProfileBalance | null;

        const userData = {
          email: authUser.email!,
          id: authUser.id,
          registered_at: new Date(authUser.created_at),
          credits_balance: profile?.credits_balance ?? 0,
        };

        setUser(userData);
        setIsAuthenticated(true); // ✅ Establecer autenticación
      } else {
        setUser(null);
        setIsAuthenticated(false); // ✅ Limpiar autenticación
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUserProfile();

    const setupSubscription = async () => {
      const supabase = createSPASassClient();
      const client = supabase.getSupabaseClient();

      // Solo configurar suscripción si hay usuario
      const {
        data: { user: authUser },
      } = await client.auth.getUser();

      if (authUser) {
        const subscription = client
          .channel("user-profile-changes")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "user_profiles",
              filter: `id=eq.${authUser.id}`,
            },
            () => {
              refreshUserProfile();
            }
          )
          .subscribe();

        return () => {
          subscription.unsubscribe();
        };
      }
    };

    setupSubscription();
  }, [refreshUserProfile]);

  const contextValue = useMemo(
    () => ({
      loading,
      user,
      isAuthenticated, // ✅ Incluir en el contexto
      refreshUserProfile,
    }),
    [loading, user, isAuthenticated, refreshUserProfile]
  );

  return (
    <GlobalContext.Provider value={contextValue}>
      {children}
    </GlobalContext.Provider>
  );
}

export const useGlobal = () => {
  const context = useContext(GlobalContext);
  if (context === undefined) {
    throw new Error("useGlobal must be used within a GlobalProvider");
  }
  return context;
};
