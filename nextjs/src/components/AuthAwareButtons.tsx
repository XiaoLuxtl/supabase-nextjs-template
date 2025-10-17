"use client";
import { useState, useEffect } from "react";
import { createSPASassClient } from "@/lib/supabase/client";
import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";

interface AuthAwareButtonsProps {
  variant?: "primary" | "nav";
  // Prop para recibir estilos de la Landing Page modificada (Hero CTA)
  primaryStyle?: string;
}

// Usamos la interfaz para tipar las props
export default function AuthAwareButtons({
  variant = "primary",
  primaryStyle,
}: AuthAwareButtonsProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = await createSPASassClient();
        const {
          data: { user },
        } = await supabase.getSupabaseClient().auth.getUser();
        setIsAuthenticated(!!user);
      } catch (error) {
        console.error("Error checking auth status:", error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return null;
  }

  // --- Estilos de Navegación (variant="nav") ---
  if (variant === "nav") {
    return isAuthenticated ? (
      // Botón "Ir al Panel" (Color de Éxito/Resultado: EMERALD)
      <Link
        href="/app"
        className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-emerald-400 transition-colors shadow-md shadow-emerald-500/50"
      >
        Ir al Panel
      </Link>
    ) : (
      // Links de "Iniciar Sesión" y "Comenzar" (Oscuro/Acción: PINK)
      <>
        <Link
          href="/auth/login"
          // Ajustado para el fondo oscuro de la Nav Bar (zinc-900)
          className="text-zinc-100 hover:text-pink-500 transition-colors font-medium"
        >
          Iniciar Sesión
        </Link>
        <Link
          href="/auth/register"
          // Botón de CTA primario en la nav (Color de Acción: PINK)
          className="bg-pink-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-pink-400 transition-colors shadow-md shadow-pink-500/50"
        >
          Comenzar
        </Link>
      </>
    );
  }

  // --- Estilos Primarios (Hero Section - variant="primary") ---

  // Define el estilo base del botón de acción (Comenzar/Panel)
  const primaryCtaStyle =
    primaryStyle ||
    "bg-pink-500 text-white font-medium hover:bg-pink-400 transition-colors shadow-xl shadow-pink-500/50";

  return isAuthenticated ? (
    // Botón "Ir al Panel" (Color de Éxito/Resultado: EMERALD)
    <Link
      href="/app"
      className={`inline-flex items-center px-6 py-3 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-400 transition-colors shadow-xl shadow-emerald-500/50`}
    >
      Ir al Panel
      <ArrowRight className="ml-2 h-5 w-5" />
    </Link>
  ) : (
    <>
      {/* Botón "Comenzar" (Color de Acción: PINK) */}
      <Link
        href="/auth/register"
        className={`inline-flex items-center px-6 py-3 rounded-lg ${primaryCtaStyle}`}
      >
        Comenzar
        <ArrowRight className="ml-2 h-5 w-5" />
      </Link>
      {/* Botón "Leer Más" (Estilo Secundario/Claro, adaptado al oscuro) */}
      <Link
        href="#features"
        // Adaptamos el botón secundario a un estilo más oscuro y neutro (zinc)
        className="hidden md:inline-flex items-center px-6 py-3 rounded-lg border-2 border-zinc-700 text-stone-50 font-medium hover:bg-zinc-800 transition-colors shadow-md"
      >
        Leer Más
        <ChevronRight className="ml-2 h-5 w-5" />
      </Link>
    </>
  );
}
