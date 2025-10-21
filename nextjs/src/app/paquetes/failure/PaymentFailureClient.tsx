"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function PaymentFailureClient() {
  const searchParams = useSearchParams();
  const externalReference = searchParams.get("external_reference");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Pago cancelado
        </h2>

        <p className="text-zinc-300 mb-4">
          No te preocupes, no se realizó ningún cargo a tu cuenta.
        </p>
        <p className="text-zinc-400 text-sm">
          Puedes intentar nuevamente o contactarnos por WhatsApp si necesitas
          ayuda.
        </p>

        {externalReference && (
          <p className="text-xs text-gray-400 mb-6">
            Referencia: {externalReference}
          </p>
        )}

        <div className="space-y-3">
          <Link
            href="/paquetes"
            className="block w-full bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Intentar nuevamente
          </Link>

          <Link
            href="/app"
            className="block w-full border border-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Volver a la aplicación
          </Link>
        </div>
      </div>
    </div>
  );
}
