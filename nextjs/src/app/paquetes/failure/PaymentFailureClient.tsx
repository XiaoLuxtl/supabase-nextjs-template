"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function PaymentFailureClient() {
  const searchParams = useSearchParams();
  const externalReference = searchParams.get("external_reference");

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900 px-4">
      <div className="max-w-md w-full bg-zinc-800 rounded-lg shadow-lg p-8 text-center border border-zinc-700">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />

        <h2 className="text-2xl font-bold text-white mb-2">Pago cancelado</h2>

        <p className="text-zinc-400 mb-4">
          No te preocupes, no se realizó ningún cargo a tu cuenta.
        </p>
        <p className="text-zinc-500 text-sm">
          Puedes intentar nuevamente o contactarnos por WhatsApp si necesitas
          ayuda.
        </p>

        {externalReference && (
          <p className="text-xs text-zinc-500 mb-6">
            Referencia: {externalReference}
          </p>
        )}

        <div className="space-y-3">
          <Link
            href="/paquetes"
            className="block w-full bg-pink-500 hover:bg-pink-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Intentar nuevamente
          </Link>

          <Link
            href="/app"
            className="block w-full border border-zinc-700 text-zinc-300 hover:bg-zinc-700 font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Volver a la aplicación
          </Link>
        </div>
      </div>
    </div>
  );
}
