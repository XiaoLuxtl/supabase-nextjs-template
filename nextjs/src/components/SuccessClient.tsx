// src/components/SuccessClient.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useCredits } from "@/hooks/useCredits";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ProcessPaymentResponse } from "@/types/types";
import {
  CheckCircle,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

export const SuccessClient: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [processing, setProcessing] = useState(true);
  const { user, refreshUserProfile, isAuthenticated } = useGlobal();
  const { balance } = useCredits();
  const [error, setError] = useState<string | null>(null);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [paymentResult, setPaymentResult] =
    useState<ProcessPaymentResponse | null>(null);
  const [timeoutReached, setTimeoutReached] = useState(false);
  const MAX_RETRIES = 3;
  const PROCESSING_TIMEOUT = 10000; // 10 segundos

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

      const response = await fetch("/api/payments/process-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id: paymentId,
          external_reference: externalReference,
        }),
      });

      const data: ProcessPaymentResponse = await response.json();
      console.log("📥 API Response:", data);

      // Guardar el resultado para mostrar información específica
      setPaymentResult(data);

      if (!response.ok) {
        // ✅ Manejar errores específicos de la nueva función
        if (data.error?.includes("UNAUTHORIZED_ACCESS")) {
          throw new Error("No tienes permisos para procesar este pago");
        }

        if (data.error?.includes("PAYMENT_NOT_APPROVED")) {
          throw new Error("El pago no ha sido aprobado todavía");
        }

        if (data.error?.includes("PURCHASE_NOT_FOUND")) {
          throw new Error("No se encontró la compra asociada");
        }

        // ✅ Si el pago no se encontró pero es retryable, reintentar
        if (data.retryable && retryCount < MAX_RETRIES) {
          console.log(`🔄 Retry ${retryCount + 1}/${MAX_RETRIES}...`);
          setRetryCount((prev) => prev + 1);

          await new Promise((resolve) => setTimeout(resolve, 3000));
          await processPayment();
          return;
        }

        throw new Error(data.error || "Error procesando el pago");
      }

      // ✅ Pago procesado exitosamente
      console.log("✅ Payment processed successfully");

      if (data.credits_applied) {
        console.log("💰 Credits applied, new balance:", data.new_balance);
      }
    } catch (err) {
      const error = err as Error;
      console.error("❌ Error processing payment:", error);
      setError(error.message);
    } finally {
      console.log("🔄 Refreshing user profile...");
      await refreshUserProfile();
      setProcessing(false);
    }
  }, [searchParams, refreshUserProfile, retryCount]);

  // Función para verificar si el pago ya se procesó
  const checkPaymentStatus = useCallback(async () => {
    try {
      console.log("🔄 Checking payment status...");
      await refreshUserProfile();

      // Si el balance cambió, asumimos que el pago se procesó
      if (balance > 0) {
        console.log("✅ Balance updated, payment likely processed");
        setProcessing(false);
        return true;
      }
      return false;
    } catch (error) {
      console.error("❌ Error checking payment status:", error);
      return false;
    }
  }, [refreshUserProfile, balance]);

  // Mensaje específico basado en el resultado
  const getPaymentMessage = () => {
    if (paymentResult?.already_applied) {
      return (
        <p className="text-amber-400 text-lg">
          ✅ Los créditos ya habían sido aplicados anteriormente
        </p>
      );
    }

    if (paymentResult?.credits_applied) {
      return (
        <p className="text-emerald-400 text-lg">
          ¡Tus créditos han sido añadidos a tu cuenta!
        </p>
      );
    }

    return (
      <p className="text-zinc-400 text-lg">
        Tu pago ha sido procesado correctamente
      </p>
    );
  };

  useEffect(() => {
    if (!hasProcessed) {
      // Iniciar timeout
      const timeoutId = setTimeout(() => {
        console.log("⏰ Processing timeout reached");
        setTimeoutReached(true);
        setProcessing(false);
      }, PROCESSING_TIMEOUT);

      // Iniciar verificación periódica cada 3 segundos
      const intervalId = setInterval(async () => {
        const isProcessed = await checkPaymentStatus();
        if (isProcessed) {
          clearInterval(intervalId);
          clearTimeout(timeoutId);
        }
      }, 3000);

      // Procesar pago
      processPayment().finally(() => {
        // Limpiar interval si el procesamiento termina antes del timeout
        clearInterval(intervalId);
        clearTimeout(timeoutId);
      });

      setHasProcessed(true);

      // Cleanup
      return () => {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
      };
    }
  }, [hasProcessed, processPayment, checkPaymentStatus]);

  // 🔄 Pantalla de carga mejorada
  if (processing || (!paymentResult && !error && !timeoutReached)) {
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
          <div className="mt-4 text-xs text-zinc-500">
            <p>Verificando estado cada 3 segundos...</p>
            <p>Si tarda mucho, se continuará automáticamente</p>
          </div>
        </div>
      </div>
    );
  }

  // 🕒 Pantalla de timeout - continuar de todos modos
  if (timeoutReached && !error) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-500/20 rounded-full mb-4">
              <AlertCircle className="w-12 h-12 text-amber-500" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Procesamiento Completo
            </h1>
            <p className="text-amber-400 text-lg mb-4">
              El proceso está tomando más tiempo de lo esperado
            </p>
            <p className="text-zinc-400 text-sm">
              Tu pago fue recibido y los créditos se acreditarán automáticamente
              en los próximos minutos. Puedes continuar usando la aplicación.
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

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link
              href="/app"
              className="flex items-center justify-center gap-2 w-full bg-pink-500 hover:bg-pink-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Crear mi primer video
              <ArrowRight className="w-5 h-5" />
            </Link>

            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 px-6 rounded-lg border border-zinc-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Verificar créditos nuevamente
            </button>
          </div>
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

            {paymentResult?.error && (
              <p className="text-zinc-500 text-sm mt-2">
                Detalle: {paymentResult.error}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                setError(null);
                setPaymentResult(null);
                setHasProcessed(false);
                setProcessing(true);
                setRetryCount(0);
                setTimeoutReached(false);
              }}
              className="flex items-center justify-center gap-2 w-full bg-pink-500 hover:bg-pink-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
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

          {/* Mensaje específico basado en el resultado */}
          {getPaymentMessage()}
        </div>

        {/* Credits Card */}
        <div className="bg-zinc-800 rounded-2xl p-6 border border-zinc-700 mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-zinc-400">Tus créditos disponibles:</span>
            <Sparkles className="w-5 h-5 text-pink-500" />
          </div>
          <div className="text-4xl font-bold text-emerald-500">{balance}</div>

          {/* Mostrar créditos añadidos si están disponibles */}
          {paymentResult?.credits_added && !paymentResult.already_applied && (
            <div className="mt-2 text-sm text-emerald-400">
              +{paymentResult.credits_added} créditos añadidos
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="bg-zinc-800/50 rounded-xl p-4 mb-6 border border-zinc-700/50">
          <p className="text-zinc-300 text-sm">
            Los créditos nunca expiran. Puedes usarlos cuando quieras para crear
            tus videos.
          </p>

          {/* Info adicional para desarrollo */}
          {process.env.NODE_ENV === "development" &&
            paymentResult?.used_fallback && (
              <p className="text-amber-400 text-xs mt-2">
                🔧 Modo desarrollo: Se usó fallback de aprobación automática
              </p>
            )}
        </div>

        {/* 🧪 Botón de verificación manual en desarrollo */}
        {process.env.NODE_ENV === "development" &&
          !searchParams.get("payment_id") && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
              <p className="text-amber-300 text-sm mb-3">
                <strong>Modo Desarrollo:</strong> Usa este botón para verificar
                y acreditar pagos pendientes manualmente.
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

        {/* Payment Info */}
        <div className="mt-6 text-center space-y-1">
          {searchParams.get("payment_id") && (
            <p className="text-xs text-zinc-500">
              ID de pago: {searchParams.get("payment_id")}
            </p>
          )}
          {paymentResult?.status && (
            <p className="text-xs text-zinc-500">
              Estado: {paymentResult.status}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

SuccessClient.displayName = "SuccessClient";

export default SuccessClient;
