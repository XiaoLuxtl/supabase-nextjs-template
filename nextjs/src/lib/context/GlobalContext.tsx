"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { createSPAClient, recreateSPAClient } from "@/lib/supabase/client";
import { GenericSupabaseClient } from "@/lib/supabase/unified";
export type User = {
  email: string;
  id: string;
  registered_at: Date;
  credits_balance: number;
};

interface GlobalContextType {
  loading: boolean;
  initialized: boolean;
  user: User | null;
  refreshUserProfile: () => Promise<void>;
  isAuthenticated: boolean;
  forceLogout: () => Promise<void>;
  sessionHealth: SessionHealth;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

type ProfileBalance = { credits_balance: number };
type SessionHealth = "healthy" | "expiring" | "expired" | "unknown";

// Utilidades para manejo de sesiones
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos
const TOKEN_REFRESH_THRESHOLD = 10 * 60 * 1000; // 10 minutos antes de expirar

type DatabaseChangePayload = {
  new: { id?: string; [key: string]: unknown } | null;
  old: { id?: string; [key: string]: unknown } | null;
  eventType: string;
  table: string;
  schema: string;
};

export function GlobalProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionHealth, setSessionHealth] = useState<SessionHealth>("unknown");
  const [initialized, setInitialized] = useState(false);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const userIdRef = useRef<string | null>(null);
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSessionCheckRef = useRef<number>(0);
  const isInitializingRef = useRef<boolean>(false);

  // Función para verificar la salud de la sesión
  const checkSessionHealth = useCallback(async (): Promise<SessionHealth> => {
    try {
      const supabase = createSPAClient();
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session) {
        return "expired";
      }

      const now = Date.now();
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const timeUntilExpiry = expiresAt - now;

      if (timeUntilExpiry < 0) {
        return "expired";
      } else if (timeUntilExpiry < TOKEN_REFRESH_THRESHOLD) {
        return "expiring";
      } else {
        return "healthy";
      }
    } catch (error) {
      console.error("Error checking session health:", error);
      return "unknown";
    }
  }, []);

  // Función helper para obtener perfil de usuario
  const fetchUserProfile = useCallback(
    async (
      supabase: GenericSupabaseClient,
      userId: string
    ): Promise<ProfileBalance | null> => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("credits_balance")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error);
        return null;
      }

      return data;
    },
    []
  );

  // Función para intentar recovery de sesión
  const attemptSessionRecovery = useCallback(async (): Promise<boolean> => {
    try {
      console.log("🔄 Attempting session recovery");
      const supabase = createSPAClient();
      const { error } = await supabase.auth.refreshSession();

      if (error) {
        console.log("❌ Session refresh failed, recreating client");
        recreateSPAClient();
        return false;
      }

      console.log("✅ Session recovered successfully");
      return true;
    } catch (error) {
      console.error("Error in session recovery:", error);
      recreateSPAClient();
      return false;
    }
  }, []);

  const refreshUserProfile = useCallback(async () => {
    // Evitar múltiples inicializaciones simultáneas
    if (isInitializingRef.current) {
      console.log("🔄 refreshUserProfile already running, skipping");
      return;
    }

    isInitializingRef.current = true;
    console.log("🔄 Starting refreshUserProfile");

    const timeout = setTimeout(() => {
      console.error("🔴 refreshUserProfile timeout - forcing initialization");
      setUser(null);
      setIsAuthenticated(false);
      setSessionHealth("unknown");
      setLoading(false);
      setInitialized(true);
      isInitializingRef.current = false;
    }, 10000); // 10 second timeout

    try {
      setLoading(true);
      setInitialized(false); // Reset initialized state

      // Verificar variables de entorno
      if (
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ) {
        console.error("Supabase environment variables not found");
        setUser(null);
        setIsAuthenticated(false);
        setSessionHealth("unknown");
        return;
      }

      const supabase = createSPAClient();

      // Verificar sesión con recovery automático
      const {
        data: { user: authUser },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error("Auth error:", error);
        // Intentar recovery
        const recovered = await attemptSessionRecovery();
        if (recovered) {
          console.log("🔄 Session recovered, re-checking user");
          // En lugar de recursión, volver a intentar getUser después del recovery
          const {
            data: { user: recoveredUser },
            error: recoveryError,
          } = await supabase.auth.getUser();
          if (recoveryError) {
            console.error("Recovery failed:", recoveryError);
            setUser(null);
            userIdRef.current = null;
            setIsAuthenticated(false);
            setSessionHealth("expired");
            return;
          }

          if (recoveredUser) {
            // Continuar con el usuario recuperado
            const profile = await fetchUserProfile(supabase, recoveredUser.id);
            const userData = {
              email: recoveredUser.email!,
              id: recoveredUser.id,
              registered_at: new Date(recoveredUser.created_at),
              credits_balance: profile?.credits_balance ?? 0,
            };

            setUser(userData);
            userIdRef.current = recoveredUser.id;
            setIsAuthenticated(true);
            setSessionHealth("healthy");
            return;
          }
        }

        setUser(null);
        userIdRef.current = null;
        setIsAuthenticated(false);
        setSessionHealth("expired");
        return;
      }

      if (authUser) {
        // Obtener perfil con manejo de errores
        const profile = await fetchUserProfile(supabase, authUser.id);

        const userData = {
          email: authUser.email!,
          id: authUser.id,
          registered_at: new Date(authUser.created_at),
          credits_balance: profile?.credits_balance ?? 0,
        };

        setUser(userData);
        userIdRef.current = authUser.id;
        setIsAuthenticated(true);
        setSessionHealth("healthy");
      } else {
        setUser(null);
        userIdRef.current = null;
        setIsAuthenticated(false);
        setSessionHealth("expired");
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
      setUser(null);
      userIdRef.current = null;
      setIsAuthenticated(false);
      setSessionHealth("unknown");
    } finally {
      clearTimeout(timeout);
      setLoading(false);
      setInitialized(true); // Always mark as initialized
      isInitializingRef.current = false;
    }
  }, [fetchUserProfile, attemptSessionRecovery]);

  const forceLogout = useCallback(async () => {
    try {
      console.log("🚪 Force logout initiated");
      setLoading(true);

      const supabase = createSPAClient();

      // Limpiar storage local
      localStorage.clear();
      sessionStorage.clear();

      // Sign out
      await supabase.auth.signOut();

      // Limpiar estado completamente
      setUser(null);
      userIdRef.current = null;
      setIsAuthenticated(false);
      setSessionHealth("unknown");
      setInitialized(false);
      setLoading(false);

      console.log("✅ Force logout completed");

      // Redirigir a login después de un breve delay
      setTimeout(() => {
        globalThis.location.href = "/auth/login";
      }, 100);
    } catch (error) {
      console.error("❌ Error in force logout:", error);
      // Limpiar estado de todas formas
      setUser(null);
      userIdRef.current = null;
      setIsAuthenticated(false);
      setSessionHealth("unknown");
      setInitialized(false);
      setLoading(false);

      // Redirigir de todas formas
      setTimeout(() => {
        globalThis.location.href = "/auth/login";
      }, 100);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Cargar perfil inicial
    const initializeAuth = async () => {
      try {
        console.log("🚀 Starting auth initialization");
        await refreshUserProfile();
        console.log("✅ Auth initialization completed");
      } catch (error) {
        console.error("❌ Failed to initialize auth:", error);
        // Ensure we mark as initialized even on error
        if (mounted) {
          setInitialized(true);
          setLoading(false);
          console.log("🔄 Marked as initialized after error");
        }
      }
    };

    initializeAuth();

    // Cleanup function
    return () => {
      mounted = false;
    };
  }, []); // Empty dependency array - only run once on mount

  // Segundo useEffect para configurar suscripciones y health checks
  useEffect(() => {
    if (!initialized) return; // Solo configurar después de la inicialización

    // Configurar health check periódico
    sessionCheckIntervalRef.current = setInterval(async () => {
      const now = Date.now();
      if (now - lastSessionCheckRef.current > SESSION_CHECK_INTERVAL) {
        lastSessionCheckRef.current = now;
        const health = await checkSessionHealth();
        setSessionHealth(health);

        // Si la sesión está expirando, refrescar proactivamente
        if (health === "expiring") {
          console.log("🔄 Token expiring soon, refreshing proactively");
          try {
            const supabase = createSPAClient();
            const { error } = await supabase.auth.refreshSession();
            if (!error) {
              setSessionHealth("healthy");
              // Actualizar perfil después del refresh
              await refreshUserProfile();
            }
          } catch (error) {
            console.error("Proactive token refresh failed:", error);
          }
        }
      }
    }, 60000); // Verificar cada minuto

    // Configurar suscripción para cambios en el perfil
    const setupSubscription = () => {
      const supabase = createSPAClient();

      // Limpiar suscripción anterior si existe
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }

      subscriptionRef.current = supabase
        .channel("user-profile-changes")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "user_profiles",
            filter: `id=eq.${userIdRef.current}`,
          },
          async (payload: DatabaseChangePayload) => {
            console.log("📊 User profile updated:", payload);
            const newCredits = payload.new?.credits_balance;
            if (typeof newCredits === "number" && user) {
              setUser({
                ...user,
                credits_balance: newCredits,
              });
            }
          }
        )
        .subscribe();
    };

    setupSubscription();

    // Configurar listener para cambios de autenticación
    const setupAuthListener = () => {
      const supabase = createSPAClient();

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log("🔄 Auth state change:", event, session?.user?.id);

        if (event === "SIGNED_IN" && session?.user) {
          console.log("✅ User signed in, checking if profile refresh needed");
          // Solo refrescar si no se está inicializando (evita conflictos con la inicialización inicial)
          if (!isInitializingRef.current && initialized) {
            await refreshUserProfile();
          } else {
            console.log(
              "🔄 Skipping profile refresh - initialization in progress or not initialized yet"
            );
          }
        } else if (event === "SIGNED_OUT") {
          console.log("🚪 User signed out, clearing state");
          setUser(null);
          userIdRef.current = null;
          setIsAuthenticated(false);
          setSessionHealth("unknown");
          setInitialized(true);
          setLoading(false);
        } else if (event === "TOKEN_REFRESHED") {
          console.log("🔑 Token refreshed, updating profile");
          if (!isInitializingRef.current) {
            await refreshUserProfile();
          }
        } else if (event === "USER_UPDATED") {
          console.log("👤 User updated, refreshing profile");
          if (!isInitializingRef.current) {
            await refreshUserProfile();
          }
        }
      });

      return subscription;
    };

    const authSubscription = setupAuthListener();

    // Cleanup
    return () => {
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      authSubscription.unsubscribe();
    };
  }, [checkSessionHealth, refreshUserProfile]); // Dependencies are stable due to useCallback

  const contextValue = useMemo(
    () => ({
      loading,
      initialized,
      user,
      isAuthenticated,
      refreshUserProfile,
      forceLogout,
      sessionHealth,
    }),
    [
      loading,
      initialized,
      user,
      isAuthenticated,
      refreshUserProfile,
      forceLogout,
      sessionHealth,
    ]
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
