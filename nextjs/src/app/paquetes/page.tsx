"use client";

import { useEffect, useState } from "react";
import { createSPAClient } from "@/lib/supabase/client";
import { Sparkles } from "lucide-react";
import HomePricing from "@/components/HomePricing";
import type { UserProfile } from "@/types/database.types";

export default function PaquetesPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createSPAClient();

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profileData } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        setProfile(profileData);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* Header con créditos del usuario */}
      <section className="relative pt-24 pb-8 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-4">
              Obtener más{" "}
              <span className="text-emerald-500 drop-shadow-lg">Créditos</span>
            </h1>
            <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-8">
              Selecciona el paquete perfecto para tus necesidades
            </p>

            {!loading && profile && (
              <div className="inline-flex items-center gap-2 bg-pink-500/20 border border-pink-500 rounded-full px-6 py-3">
                <Sparkles className="h-5 w-5 text-pink-500" />
                <span className="text-pink-500 font-bold text-lg">
                  Créditos disponibles: {profile.credits_balance}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Reutiliza HomePricing directamente */}
      <HomePricing />
    </div>
  );
}
