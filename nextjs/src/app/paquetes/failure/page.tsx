"use client";

import Link from "next/link";
import { XCircle, ArrowLeft, RefreshCw } from "lucide-react";

export default function FailurePage() {
  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Error Icon */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-500/20 rounded-full mb-4">
            <XCircle className="w-12 h-12 text-red-500" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Pago No Completado
          </h1>
          <p className="text-zinc-400 text-lg">Hubo un problema con tu pago</p>
        </div>

        {/* Info */}
        <div className="bg-zinc-800 rounded-2xl p-6 border border-zinc-700 mb-6">
          <p className="text-zinc-300 mb-4">
            No te preocupes, no se realizó ningún cargo a tu cuenta.
          </p>
          <p className="text-zinc-400 text-sm">
            Puedes intentar nuevamente o contactarnos por WhatsApp si necesitas
            ayuda.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="/paquetes"
            className="flex items-center justify-center gap-2 w-full bg-pink-500 hover:bg-pink-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Intentar nuevamente
          </Link>

          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 px-6 rounded-lg border border-zinc-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
