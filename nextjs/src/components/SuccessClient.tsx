"use client";

import { useEffect, useState, useCallback } from "react"; // ✅ Importar useCallback
import { useGlobal } from "@/lib/context/GlobalContext";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";

// Interface para errores de la API
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
  const [error, setError] = useState<string | null>(null);

  // Bandera interna para saber si el componente ya intentó procesar el pago.
  const [hasProcessed, setHasProcessed] = useState(false);

  // ✅ SOLUCIÓN AL WARNING DE DEPENDENCIA:
  // 1. Envolver processPayment con useCallback para que sea estable.
  // 2. Incluir todas sus dependencias externas.
  const processPayment = useCallback(async () => {
    const paymentId = searchParams.get("payment_id");
    const externalReference = searchParams.get("external_reference");
    const status = searchParams.get("status");

    let apiCallAttempted = false;
    // let creditsWereApplied = false; // Se elimina, ya que no es necesaria para el control final

    // Si el pago no está aprobado o faltan referencias, solo refrescamos y terminamos
    if (!paymentId || !externalReference || status !== "approved") {
      // En desarrollo, si no hay parámetros de MP, mostrar botón para verificar estado
      const isDevelopment = process.env.NODE_ENV === "development";
      const mercadoPagoRedirected = paymentId && externalReference && status;

      if (isDevelopment && !mercadoPagoRedirected) {
        await refreshUserProfile();
        setProcessing(false);
        return;
      }

      await refreshUserProfile();
      setProcessing(false);
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

      const data = (await response.json()) as {
        credits_applied?: boolean;
        error?: string;
        retryable?: boolean;
      };

      if (!response.ok) {
        if (data.retryable) {
          // Lógica de reintento con recarga
          await new Promise((resolve) => setTimeout(resolve, 3000));
          window.location.reload();
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

      // La bandera creditsWereApplied ya no es necesaria aquí.
      // El refreshUserProfile() en el finally garantiza la sincronización.
    } catch (err) {
      const error = err as ApiError;
      console.error("Error processing payment:", error);
      if (apiCallAttempted) {
        setError(error.message);
      }
    } finally {
      // **PUNTO CRÍTICO DE SINCRONIZACIÓN:**
      // Forzamos el refresco del perfil. Esto es lo que resuelve la visualización de 0 créditos.
      await refreshUserProfile();

      setProcessing(false);
    }
  }, [searchParams, refreshUserProfile]); // ✅ Dependencias de useCallback

  // ✅ SOLUCIÓN AL WARNING DE DEPENDENCIA:
  // Se incluye processPayment en el array de dependencias.
  useEffect(() => {
    if (!hasProcessed) {
      processPayment();
      setHasProcessed(true); // Evitar reejecuciones accidentales
    }
  }, [hasProcessed, processPayment]);

  // Pantalla de carga (SIN CAMBIOS)
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

  // Manejo de SESIÓN PERDIDA: (Lógica robusta)
  if (!isAuthenticated && !processing && !error) {
    console.warn(
      "Sesión perdida después de la redirección de pago. Redirigiendo a login."
    );
    router.replace("/login?redirect=/paquetes/success");
    return null;
  }

  // Pantalla de error (SIN CAMBIOS)
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

  // Pantalla de éxito
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
            {/* Si user es null (aunque la lógica de isAuthenticated debe prevenir esto), muestra 'Cargando...' */}
            {user?.credits_balance ?? "Cargando..."}
          </div>
        </div>

        {/* Info y Actions */}
        <div className="bg-zinc-800/50 rounded-xl p-4 mb-6 border border-zinc-700/50">
          <p className="text-zinc-300 text-sm">
            Los créditos nunca expiran. Puedes usarlos cuando quieras para crear
            tus videos.
          </p>
        </div>

        {/* Botón de verificación en desarrollo */}
        {process.env.NODE_ENV === "development" &&
          !searchParams.get("payment_id") && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
              <p className="text-amber-300 text-sm mb-3">
                En desarrollo: Mercado Pago no redirige automáticamente. Haz
                clic para verificar y acreditar tus créditos.
              </p>
              <button
                onClick={async () => {
                  try {
                    const response = await fetch(
                      "/api/payments/check-pending",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ user_id: user?.id }),
                      }
                    );

                    const data = await response.json();

                    if (data.success) {
                      // Refrescar perfil para actualizar créditos
                      await refreshUserProfile();
                      alert(
                        `¡Listo! Se procesaron ${data.processed} pagos pendientes.`
                      );
                      globalThis.location.reload();
                    } else {
                      alert(
                        "Error al verificar pagos: " +
                          (data.error || "Error desconocido")
                      );
                    }
                  } catch (error) {
                    console.error("Error checking pending payments:", error);
                    alert("Error al verificar pagos. Inténtalo nuevamente.");
                  }
                }}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Verificar Estado de Pagos
              </button>
            </div>
          )}

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

// Set displayName for React DevTools
SuccessClient.displayName = "SuccessClient";

export default SuccessClient;
