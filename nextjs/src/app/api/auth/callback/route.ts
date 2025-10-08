import { NextResponse } from 'next/server'
// Asumo que createSSRSassClient devuelve una instancia de SassClient,
// y que está definido en "@/lib/supabase/server".
import { createSSRSassClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    if (code) {
        // 'supabase' es el SassClient (wrapper)
        const supabase = await createSSRSassClient()
        // 'client' es el SupabaseClient real
        const client = supabase.getSupabaseClient()

        // Corregido: La función debe llamarse en el objeto 'auth' del cliente Supabase real ('client').
        // La implementación moderna de @supabase/ssr usa este patrón para el intercambio de código.
        const { error: sessionError } = await client.auth.exchangeCodeForSession(code)
        
        if (sessionError) {
            console.error('Error exchanging code for session:', sessionError)
            return NextResponse.redirect(new URL('/auth/login', request.url))
        }

        // Check MFA status
        const { data: aal, error: aalError } = await client.auth.mfa.getAuthenticatorAssuranceLevel()

        if (aalError) {
            console.error('Error checking MFA status:', aalError)
            return NextResponse.redirect(new URL('/auth/login', request.url))
        }

        // If user needs to complete MFA verification
        if (aal.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
            return NextResponse.redirect(new URL('/auth/2fa', request.url))
        }

        // If MFA is not required or already verified, proceed to app
        return NextResponse.redirect(new URL('/app', request.url))
    }

    // If no code provided, redirect to login
    return NextResponse.redirect(new URL('/auth/login', request.url))
}
