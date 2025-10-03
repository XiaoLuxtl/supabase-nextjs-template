"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Sparkles, ArrowRight } from "lucide-react";
import { createSPAClient } from "@/lib/supabase/client";

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(0);
  const supabase = createSPAClient();

  useEffect(() => {
    loadUserCredits();
  }, []);

  async function loadUserCredits() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("credits_balance")
          .eq("id", user.id)
          .single();

        if (profile) {
          setCredits(profile.credits_balance);
        }
      }
    } catch (error) {
      console.error("Error loading credits:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Success Icon */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500/20 rounded-full mb-4">
            <CheckCircle className="w-12 h-12 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">¡Pago Exitoso!</h1>
          <p className="text-zinc-400 text-lg">
            Tus créditos han sido acreditados
          </p>
        </div>

        {/* Credits Card */}
        <div className="bg-zinc-800 rounded-2xl p-6 border border-zinc-700 mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-zinc-400">Tus créditos disponibles:</span>
            <Sparkles className="w-5 h-5 text-pink-500" />
          </div>
          {loading ? (
            <div className="h-12 bg-zinc-700 animate-pulse rounded" />
          ) : (
            <div className="text-4xl font-bold text-emerald-500">{credits}</div>
          )}
        </div>

        {/* Info */}
        <div className="bg-zinc-800/50 rounded-xl p-4 mb-6 border border-zinc-700/50">
          <p className="text-zinc-300 text-sm">
            Los créditos nunca expiran. Puedes usarlos cuando quieras para crear
            tus videos.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="/app"
            className="flex items-center justify-center gap-2 w-full bg-pink-500 hover:bg-pink-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Crear mi primer video
            <ArrowRight className="w-5 h-5" />
          </Link>

          <Link
            href="/paquetes"
            className="flex items-center justify-center w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 px-6 rounded-lg border border-zinc-700 transition-colors"
          >
            Comprar más créditos
          </Link>
        </div>

        {/* Payment ID (opcional, para soporte) */}
        {searchParams.get("payment_id") && (
          <div className="mt-6 text-center">
            <p className="text-xs text-zinc-500">
              ID de pago: {searchParams.get("payment_id")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
