// components/HomeHero.jsx (ACTUALIZADO)

import React from "react";
import AuthAwareButtons from "@/components/AuthAwareButtons";

export default function HomeHero() {
  // ID del video de YouTube: 58kYu-gSuiU
  const videoId = "1Cd2_PNEZ-U";
  const embedUrl = `https://www.youtube.com/embed/${videoId}`;

  return (
    // 1. Usamos min-h-[100dvh] para que la sección ocupe toda la altura de la pantalla
    // También ajustamos el padding superior a pt-32 para dar espacio al contenido.
    <section className="relative min-h-[100dvh] pt-4 md:pt-16 pb-24 overflow-hidden flex items-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center">
          {/* Títulos y Descripción Originales */}
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-white">
            Revive Tus Memorias,
            <span className="block text-emerald-500 drop-shadow-lg">
              Dales Vida en Video
            </span>
          </h1>
        </div>

        {/* ------------------ VIDEO EMBED DE YOUTUBE (MOVIDO ARRIBA DE BOTONES) ------------------ */}
        <div className="mt-12 mx-auto w-full max-w-5xl">
          {/* Contenedor responsivo 16:9 (56.25% es 9/16) */}
          <div
            className="relative"
            style={{ paddingBottom: "56.25%", height: 0 }}
          >
            <iframe
              className="absolute top-0 left-0 w-full h-full rounded-xl shadow-2xl shadow-zinc-800/50 border border-zinc-700"
              src={`${embedUrl}?autoplay=0&controls=1`}
              title="Video explicativo de la página"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            ></iframe>
          </div>
          <p className="mt-4 text-center text-sm text-zinc-500">
            Mira este video para entender cómo funciona la plataforma.
          </p>
        </div>
        {/* ----------------------------------------------------------------------------------------- */}

        {/* Botones de CTA Originales (MOVIMO ABAJO DEL VIDEO) */}
        <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-3xl mx-auto">
          Utiliza nuestra IA para convertir en video tus fotos antiguas. Da vida
          a tu pasado en segundos.
        </p>
        <div className="mt-12 flex gap-4 justify-center">
          <AuthAwareButtons primaryStyle="bg-pink-500 hover:bg-pink-400 shadow-lg shadow-pink-500/50" />
        </div>
      </div>
    </section>
  );
}
