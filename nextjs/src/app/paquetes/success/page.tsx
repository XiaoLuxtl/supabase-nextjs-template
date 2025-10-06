"use client";

import { useEffect, useState } from "react";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { createSPAClient } from "@/lib/supabase/client";

export default function SuccessPage() {
  const searchParams = useSearchParams();

  // ✅ Eliminamos 'loading' y usamos solo 'processing', inicializado en true
  const [processing, setProcessing] = useState(true);

  const { user, refreshUserProfile } = useGlobal();
  const [error, setError] = useState<string | null>(null);
  const supabase = createSPAClient();

  useEffect(() => {
    // Llama a la función de procesamiento al montar el componente
    processPayment();
  }, []);

  async function processPayment() {
    const paymentId = searchParams.get("payment_id");
    const externalReference = searchParams.get("external_reference");
    const status = searchParams.get("status");

    let apiCallAttempted = false;

    // Si el pago no está aprobado o faltan referencias, solo refrescamos y terminamos.
    if (!paymentId || !externalReference || status !== "approved") {
      setProcessing(false);
      await refreshUserProfile();
      return;
    }

    try {
      apiCallAttempted = true;

      const response = await fetch("/api/payments/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id: paymentId,
          external_reference: externalReference,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.retryable) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          window.location.reload();
          return;
        }
        throw new Error(data.error || "Error procesando el pago");
      }

      console.log("Payment processed:", data);

      if (data.credits_applied) {
        await refreshUserProfile();
      }
    } catch (err: any) {
      console.error("Error processing payment:", err);
      if (apiCallAttempted) {
        setError(err.message);
      }
    }

    // ✅ FIN DEL PROCESAMIENTO: Siempre se ejecuta
    setProcessing(false);
    await refreshUserProfile();
  }

  // Muestra la pantalla de carga SÓLO si 'processing' es true
  if (processing) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-pink-500 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Procesando tu pago...</p>
          <p className="text-zinc-400 text-sm mt-2">
            Esto solo tomará unos segundos.
          </p>
        </div>
      </div>
    );
  }

  // --- El resto del código de manejo de errores y éxito es correcto ---

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-500/20 rounded-full mb-4">
              <AlertCircle className="w-12 h-12 text-red-500" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Error al Procesar
            </h1>
            <p className="text-zinc-400 text-lg">{error}</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-pink-500 hover:bg-pink-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Reintentar
            </button>

            <Link
              href="/paquetes"
              className="block text-center w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 px-6 rounded-lg border border-zinc-700 transition-colors"
            >
              Volver a paquetes
            </Link>
          </div>
        </div>
      </div>
    );
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
            Tus créditos han sido añadidos a tu cuenta.
          </p>
        </div>

        {/* Credits Card */}
        <div className="bg-zinc-800 rounded-2xl p-6 border border-zinc-700 mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-zinc-400">Tus créditos disponibles:</span>
            <Sparkles className="w-5 h-5 text-pink-500" />
          </div>
          <div className="text-4xl font-bold text-emerald-500">
            {user?.credits_balance ?? 0}
          </div>
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
            <ArrowRight className="w-5 w-5" />
          </Link>

          <Link
            href="/paquetes"
            className="flex items-center justify-center w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 px-6 rounded-lg border border-zinc-700 transition-colors"
          >
            Comprar más créditos
          </Link>
        </div>

        {/* Payment ID */}
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
