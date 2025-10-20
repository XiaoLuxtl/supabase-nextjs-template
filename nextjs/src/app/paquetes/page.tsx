"use client";

import { useRouter } from "next/navigation"; // Usamos usePathname para saber qué link está activo
import HomePricing from "@/components/HomePricing";
import { ArrowLeft } from "lucide-react";
import { CreditBalance } from "@/components/CreditBalance";

export default function PaquetesPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* Header con créditos del usuario */}
      <section className="relative pt-24 pb-8 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => router.back()}
            // Adaptamos el botón "Volver" a la paleta emerald
            className="p-5 inline-flex items-center text-sm text-emerald-600 font-medium hover:text-emerald-800 transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a la aplicación
          </button>
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-4">
              Obtener más{" "}
              <span className="text-emerald-500 drop-shadow-lg">Créditos</span>
            </h1>
            <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-8">
              Selecciona el paquete perfecto para tus necesidades
            </p>

            <CreditBalance
              variant="centered"
              className="bg-pink-500/20 border border-pink-500 rounded-full px-4 py-2 text-pink-500 text-sm font-medium"
            />
          </div>
        </div>
      </section>

      {/* Reutiliza HomePricing directamente */}
      <HomePricing />
    </div>
  );
}
