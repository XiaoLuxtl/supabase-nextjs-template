// src/app/paquetes/pending/page.tsx
"use client";

import { Clock } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function PaymentPendingPage() {
  const searchParams = useSearchParams();
  const externalReference = searchParams.get("external_reference");

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-zinc-800 rounded-lg shadow-lg p-8 text-center border border-zinc-700">
        <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />

        <h2 className="text-2xl font-bold text-white mb-2">Pago Pendiente</h2>

        <p className="text-zinc-400 mb-6">
          Tu pago está siendo procesado. Los créditos se agregarán a tu cuenta
          una vez que se confirme el pago.
        </p>

        {externalReference && (
          <p className="text-xs text-zinc-500 mb-6">
            Referencia: {externalReference}
          </p>
        )}

        <div className="bg-zinc-900 rounded-lg p-4 mb-6 border border-zinc-700">
          <p className="text-zinc-300 text-sm">
            Recibirás una notificación por correo electrónico cuando tu pago sea
            confirmado.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/app"
            className="block w-full bg-pink-500 hover:bg-pink-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Ir a la aplicación
          </Link>

          <Link
            href="/paquetes"
            className="block w-full border border-zinc-700 text-zinc-300 hover:bg-zinc-700 font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Ver paquetes
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-zinc-700">
          <p className="text-sm text-zinc-500">
            ¿Necesitas ayuda?{" "}
            <Link href="/soporte" className="text-pink-500 hover:underline">
              Contacta soporte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
