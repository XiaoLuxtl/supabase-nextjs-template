// src/components/SuccessClient.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useCredits } from "@/hooks/useCredits";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface ApiError extends Error {
  message: string;
  status?: number;
  retryable?: boolean;
}

export const SuccessClient: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [processing, setProcessing] = useState(true);
  const { user, refreshUserProfile, isAuthenticated } = useGlobal();
  const { balance } = useCredits();
  const [error, setError] = useState<string | null>(null);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  const processPayment = useCallback(async () => {
    const paymentId = searchParams.get("payment_id");
    const externalReference = searchParams.get("external_reference");
    const status = searchParams.get("status");
    const collectionStatus = searchParams.get("collection_status");

    console.log("🔍 Processing payment with params:", {
      paymentId,
      externalReference,
      status,
      collectionStatus,
    });

    // ✅ Si no hay payment_id, verificar si hay external_reference (fallback)
    if (!paymentId && !externalReference) {
      console.log("⚠️ No payment parameters found");
      await refreshUserProfile();
      setProcessing(false);
      return;
    }

    // ✅ Si el estado no es aprobado, refrescar y salir
    if (status && status !== "approved" && collectionStatus !== "approved") {
      console.log("⚠️ Payment not approved:", status || collectionStatus);
      await refreshUserProfile();
      setProcessing(false);
      return;
    }

    try {
      console.log("📞 Calling process-payment API...");

      // ✅ RUTA CORRECTA: /api/payments/process-payment
      const response = await fetch("/api/payments/process-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id: paymentId,
          external_reference: externalReference,
        }),
      });

      const data = await response.json();
      console.log("📥 API Response:", data);

      if (!response.ok) {
        // ✅ Si el pago no se encontró pero es retryable, reintentar
        if (data.retryable && retryCount < MAX_RETRIES) {
          console.log(`🔄 Retry ${retryCount + 1}/${MAX_RETRIES}...`);
          setRetryCount((prev) => prev + 1);

          // Esperar 3 segundos y reintentar
          await new Promise((resolve) => setTimeout(resolve, 3000));
          await processPayment();
          return;
        }

        throw Object.assign(
          new Error(data.error || "Error procesando el pago"),
          {
            status: response.status,
            retryable: data.retryable,
          }
        ) as ApiError;
      }

      // ✅ Pago procesado exitosamente
      console.log("✅ Payment processed successfully");

      if (data.credits_applied) {
        console.log("💰 Credits applied, new balance:", data.new_balance);
      }
    } catch (err) {
      const error = err as ApiError;
      console.error("❌ Error processing payment:", error);
      setError(error.message);
    } finally {
      // ✅ CRÍTICO: Siempre refrescar el perfil para sincronizar créditos
      console.log("🔄 Refreshing user profile...");
      await refreshUserProfile();
      setProcessing(false);
    }
  }, [searchParams, refreshUserProfile, retryCount]);

  useEffect(() => {
    if (!hasProcessed) {
      processPayment();
      setHasProcessed(true);
    }
  }, [hasProcessed, processPayment]);

  // 🔄 Pantalla de carga
  if (processing) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-pink-500 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Procesando tu pago...</p>
          <p className="text-zinc-400 text-sm mt-2">
            {retryCount > 0
              ? `Reintento ${retryCount}/${MAX_RETRIES}...`
              : "Esto solo tomará unos segundos."}
          </p>
        </div>
      </div>
    );
  }

  // 🔐 Manejo de sesión perdida
  if (!isAuthenticated && !processing && !error) {
    console.warn("⚠️ Session lost, redirecting to login");
    router.replace("/auth/login?redirect=/paquetes/success");
    return null;
  }

  // ❌ Pantalla de error
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
              onClick={() => {
                setError(null);
                setHasProcessed(false);
                setProcessing(true);
                setRetryCount(0);
              }}
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

  // ✅ Pantalla de éxito
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
          <div className="text-4xl font-bold text-emerald-500">{balance}</div>
        </div>

        {/* Info Card */}
        <div className="bg-zinc-800/50 rounded-xl p-4 mb-6 border border-zinc-700/50">
          <p className="text-zinc-300 text-sm">
            Los créditos nunca expiran. Puedes usarlos cuando quieras para crear
            tus videos.
          </p>
        </div>

        {/* 🧪 Botón de verificación manual en desarrollo */}
        {process.env.NODE_ENV === "development" &&
          !searchParams.get("payment_id") && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
              <p className="text-amber-300 text-sm mb-3">
                <strong>Modo Desarrollo:</strong> Mercado Pago no redirige
                automáticamente en localhost. Usa este botón para verificar y
                acreditar pagos pendientes.
              </p>
              <button
                onClick={async () => {
                  if (!user?.id) {
                    alert("Usuario no autenticado");
                    return;
                  }

                  try {
                    console.log("🔍 Checking pending payments...");
                    const response = await fetch(
                      "/api/payments/check-pending",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ user_id: user.id }),
                      }
                    );

                    const data = await response.json();
                    console.log("📥 Check pending response:", data);

                    if (data.success) {
                      await refreshUserProfile();

                      if (data.processed > 0) {
                        alert(
                          `✅ ¡Listo! Se procesaron ${data.processed} pagos pendientes.`
                        );
                        window.location.reload();
                      } else {
                        alert("ℹ️ No hay pagos pendientes para procesar.");
                      }
                    } else {
                      alert("❌ Error: " + (data.error || "Error desconocido"));
                    }
                  } catch (error) {
                    console.error("Error checking pending payments:", error);
                    alert("❌ Error al verificar pagos. Inténtalo nuevamente.");
                  }
                }}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                🔍 Verificar Pagos Pendientes
              </button>
            </div>
          )}

        {/* Action Buttons */}
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
};

SuccessClient.displayName = "SuccessClient";

export default SuccessClient;
