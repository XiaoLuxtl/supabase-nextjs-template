// src/lib/supabase/server.ts

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ClientType, SassClient, GenericSupabaseClient } from "@/lib/supabase/unified";
import { Database } from "@/lib/types";

export async function createSSRClient(): Promise<GenericSupabaseClient> {
    const cookieStore = await cookies();

    return createServerClient<Database, 'public'>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // Ignorar errores si setAll se llama desde un Server Component
                    }
                },
            },
            db: {
                schema: 'public',
            },
        }
    ) as unknown as GenericSupabaseClient;
}

export async function createSSRSassClient() {
    const client = await createSSRClient();
    return new SassClient(client, ClientType.SERVER);
}