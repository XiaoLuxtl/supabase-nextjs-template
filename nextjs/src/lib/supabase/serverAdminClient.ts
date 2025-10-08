// src/lib/supabase/serverAdminClient.ts
import { createServerClient } from '@supabase/ssr';
import { Database } from "@/lib/types";
import { GenericSupabaseClient, ClientType } from "@/lib/supabase/unified";
import { SassClient } from "@/lib/supabase/unified";

export async function createServerAdminClient(): Promise<GenericSupabaseClient> {
    return createServerClient<Database, 'public'>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.PRIVATE_SUPABASE_SERVICE_KEY!,
        {
            cookies: {
                getAll: () => [],
                setAll: () => {},
            },
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
            db: {
                schema: 'public',
            },
        }
    ) as unknown as GenericSupabaseClient;
}

export async function createServerAdminSassClient() {
    const client = await createServerAdminClient();
    return new SassClient(client, ClientType.ADMIN); // Necesitarás agregar ClientType.ADMIN
}