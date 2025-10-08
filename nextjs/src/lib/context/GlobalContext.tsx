"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo, // 👈 Importado
  useCallback, // 👈 Importado
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
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

// Definimos el tipo esperado para el perfil
type ProfileBalance = { credits_balance: number };

export function GlobalProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // 1. Usamos useCallback para estabilizar la función (dependency: [setLoading, setUser])
  const refreshUserProfile = useCallback(async () => {
    try {
      const supabase = createSPASassClient();
      const client = supabase.getSupabaseClient();
      const {
        data: { user: authUser },
      } = await client.auth.getUser();

      if (authUser) {
        // Obtener créditos
        const { data } = await client
          .from("user_profiles")
          .select("credits_balance")
          .eq("id", authUser.id)
          .single();

        const profile = data as ProfileBalance | null;

        setUser({
          email: authUser.email!,
          id: authUser.id,
          registered_at: new Date(authUser.created_at),
          credits_balance: profile?.credits_balance ?? 0,
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    } finally {
      setLoading(false);
    }
    // Las funciones setX de useState son estables, pero se incluyen para satisfacer linters estrictos.
  }, [setLoading, setUser]);

  useEffect(() => {
    refreshUserProfile();

    const setupSubscription = async () => {
      const supabase = createSPASassClient();
      const client = supabase.getSupabaseClient();

      const subscription = client
        .channel("user-profile-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_profiles",
            filter: `id=eq.${user?.id}`,
          },
          () => {
            // Refrescar el perfil cuando haya cambios
            refreshUserProfile();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    };

    if (user?.id) {
      // El linter de React debe estar satisfecho con [user?.id, refreshUserProfile]
      // ya que refreshUserProfile es ahora estable.
      setupSubscription();
    }
  }, [user?.id, refreshUserProfile]); // 👈 Añadido refreshUserProfile a dependencias

  // 2. Usamos useMemo para estabilizar el objeto 'value' (Soluciona S6481)
  const contextValue = useMemo(
    () => ({
      loading,
      user,
      refreshUserProfile,
    }),
    [loading, user, refreshUserProfile]
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
