// src/lib/context/GlobalContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";

type User = {
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

export function GlobalProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Función para refrescar el perfil y créditos
  const refreshUserProfile = async () => {
    try {
      const supabase = await createSPASassClient();
      const client = supabase.getSupabaseClient();
      const {
        data: { user: authUser },
      } = await client.auth.getUser();
      if (authUser) {
        // Obtener créditos
        const { data: profile } = await client
          .from("user_profiles")
          .select("credits_balance")
          .eq("id", authUser.id)
          .single();
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
  };

  useEffect(() => {
    refreshUserProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GlobalContext.Provider value={{ loading, user, refreshUserProfile }}>
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
