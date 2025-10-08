// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';
import { Database } from "@/lib/types";
import { GenericSupabaseClient, SassClient, ClientType } from "@/lib/supabase/unified"; // Importa ClientType

let cachedClient: GenericSupabaseClient | null = null;

const createSupabaseBrowserClient = () => createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function createSPAClient(): GenericSupabaseClient {
    if (cachedClient) {
        return cachedClient;
    }
    cachedClient = createSupabaseBrowserClient() as unknown as GenericSupabaseClient;
    return cachedClient;
}

export function createSPASassClient() {
    const client = createSPAClient();
    return new SassClient(client, ClientType.SPA); // Usa ClientType.SPA en lugar de CLIENT_MODES.SPA
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