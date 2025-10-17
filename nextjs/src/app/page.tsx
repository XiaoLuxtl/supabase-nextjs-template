// page.tsx (RESTAURADO)
"use client";

import React from "react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { createSPASassClient } from "@/lib/supabase/client";
import { ArrowRight } from "lucide-react";

// Importamos los componentes modulares
import Navbar from "@/components/HomeNavbar";
import HomePricing from "@/components/HomePricing";
import HomeFooter from "@/components/HomeFooter";
import HomeFeatures from "@/components/HomeFeatures";
import HomeStats from "@/components/HomeStats";
import HomeHero from "@/components/HomeHero";

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = await createSPASassClient();
        const {
          data: { user },
        } = await supabase.getSupabaseClient().auth.getUser();
        setIsAuthenticated(!!user);
      } catch {
        setIsAuthenticated(false);
      } finally {
        setLoadingAuth(false);
      }
    };
    checkAuth();
  }, []);
  const productName = process.env.NEXT_PUBLIC_PRODUCTNAME || "PixelPages";

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* ======================= NAV BAR ======================= */}
      <Navbar />

      <div className="pt-16">
        {/* ======================= HERO SECTION (Todo incluido en HomeHero) ======================= */}
        <HomeHero />

        {/* ======================= STATS SECTION ======================= */}
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
            {!loadingAuth && (
              <Link
                href={isAuthenticated ? "/app" : "/auth/register"}
                className="mt-8 inline-flex items-center px-6 py-3 rounded-lg bg-white text-pink-600 font-medium hover:bg-pink-50 transition-colors shadow-lg"
              >
                {isAuthenticated ? "Ir al Panel" : "Comenzar Ahora"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            )}
          </div>
        </section>

        {/* ======================= FOOTER ======================= */}
        <HomeFooter />
      </div>
    </div>
  );
}
