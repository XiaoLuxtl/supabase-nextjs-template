// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/lib/types";
import {
  GenericSupabaseClient,
  SassClient,
  ClientType,
} from "@/lib/supabase/unified";

let cachedClient: GenericSupabaseClient | null = null;

const createSupabaseBrowserClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: true },
      realtime: {
        params: {
          eventsPerSecond: 10, // Límite razonable
          maxBytesPerSecond: 1024 * 100, // 100 KB/s
        },
      },
    }
  );

export function createSPAClient(): GenericSupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }
  cachedClient =
    createSupabaseBrowserClient() as unknown as GenericSupabaseClient;
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
  if (!session || !session.session) {
    console.warn("Usuario no autenticado, se requiere redirección.");
  }
  return {
    client: new SassClient(client, ClientType.SPA),
    isAuthenticated: !!(session && session.session),
  };
}
