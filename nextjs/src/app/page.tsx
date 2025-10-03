import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Importamos los componentes modulares
import Navbar from "@/components/HomeNavbar";
import AuthAwareButtons from "@/components/AuthAwareButtons";
import HomePricing from "@/components/HomePricing";
import HomeFooter from "@/components/HomeFooter";
import HomeFeatures from "@/components/HomeFeatures";
import HomeStats from "@/components/HomeStats";

export default function Home() {
  const productName = process.env.NEXT_PUBLIC_PRODUCTNAME || "PixelPages";

  // El array 'stats' ha sido movido a HomeStats.jsx

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* ======================= NAV BAR ======================= */}
      <Navbar />

      <div className="pt-16">
        {/* ======================= HERO SECTION ======================= */}
        <section className="relative pt-16 pb-24 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-white">
                Revive Tus Memorias,
                <span className="block text-emerald-500 drop-shadow-lg">
                  Dales Vida en Video
                </span>
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-3xl mx-auto">
                Utiliza nuestra IA para convertir en video tus fotos antiguas.
                Da vida a tu pasado en segundos.
              </p>
              <div className="mt-10 flex gap-4 justify-center">
                <AuthAwareButtons primaryStyle="bg-pink-500 hover:bg-pink-400 shadow-lg shadow-pink-500/50" />
              </div>
            </div>
          </div>
        </section>

        {/* ======================= STATS SECTION (Componente Separado) ======================= */}
        <HomeStats />

        {/* ======================= FEATURES SECTION ======================= */}
        <HomeFeatures />

        {/* HomePricing */}
        <HomePricing />

        {/* ======================= CTA FINAL SECTION ======================= */}
        <section className="py-24 bg-pink-600 shadow-2xl shadow-pink-500/30">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-white">
              ¿Listo para darle Nueva Vida a tus Fotos?
            </h2>
            <p className="mt-4 text-xl text-pink-100">
              Únete a miles de usuarios transformando sus recuerdos con{" "}
              {productName}.
            </p>
            <Link
              href="/auth/register"
              className="mt-8 inline-flex items-center px-6 py-3 rounded-lg bg-white text-pink-600 font-medium hover:bg-pink-50 transition-colors shadow-lg"
            >
              Comenzar Ahora
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </section>

        {/* ======================= FOOTER ======================= */}
        <HomeFooter />
      </div>
    </div>
  );
}
