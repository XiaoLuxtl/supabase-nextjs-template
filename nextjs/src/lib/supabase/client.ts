// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/lib/types";
import {
  GenericSupabaseClient,
  SassClient,
  ClientType,
} from "@/lib/supabase/unified";

let cachedClient: GenericSupabaseClient | null = null;
let clientCreationTime = 0;
const CLIENT_TTL = 30 * 60 * 1000; // 30 minutos

const createSupabaseBrowserClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
          maxBytesPerSecond: 1024 * 100,
        },
      },
    }
  );

// Función para verificar si el cliente necesita ser recreado
const shouldRecreateClient = (): boolean => {
  const now = Date.now();
  return !cachedClient || now - clientCreationTime > CLIENT_TTL;
};

export function createSPAClient(): GenericSupabaseClient {
  if (shouldRecreateClient()) {
    console.log("🔄 Creating new Supabase client");
    cachedClient =
      createSupabaseBrowserClient() as unknown as GenericSupabaseClient;
    clientCreationTime = Date.now();
  }
  return cachedClient!;
}

// Función para forzar recreación del cliente (útil para recovery)
export function recreateSPAClient(): GenericSupabaseClient {
  console.log("🔄 Force recreating Supabase client");
  cachedClient =
    createSupabaseBrowserClient() as unknown as GenericSupabaseClient;
  clientCreationTime = Date.now();
  return cachedClient;
}

export function createSPASassClient() {
  const client = createSPAClient();
  return new SassClient(client, ClientType.SPA);
}

export async function createSPASassClientAuthenticated(): Promise<{
  client: SassClient;
  isAuthenticated: boolean;
}> {
  const client = createSPAClient();
  const { data: session } = await client.auth.getSession();
  if (!session?.session) {
    console.warn("Usuario no autenticado, se requiere redirección.");
  }
  return {
    client: new SassClient(client, ClientType.SPA),
    isAuthenticated: !!session?.session,
  };
}
