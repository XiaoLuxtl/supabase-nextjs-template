// src/app/not-found.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, AlertCircle, Heart } from "lucide-react";
import styles from "@/styles/not-found.module.css";

// Predefined positions to avoid hydration mismatch
const sparklePositions = [
  { top: "10%", left: "15%" },
  { top: "20%", left: "80%" },
  { top: "30%", left: "30%" },
  { top: "40%", left: "60%" },
  { top: "50%", left: "20%" },
  { top: "60%", left: "75%" },
  { top: "70%", left: "40%" },
  { top: "80%", left: "25%" },
  { top: "85%", left: "65%" },
  { top: "90%", left: "10%" },
  { top: "15%", left: "50%" },
  { top: "25%", left: "85%" },
];

export default function NotFound() {
  // Lista de sugerencias para prompts emocionales
  const promptSuggestions = [
    {
      title: "Bailando bajo las estrellas",
      description:
        "Anima una foto de tus padres bailando en su juventud, como en los años 60.",
    },
    {
      title: "Reunión familiar",
      description:
        "Convierte una foto de un picnic familiar en un video lleno de risas y recuerdos.",
    },
    {
      title: "Paseo por el pasado",
      description:
        "Da vida a una imagen de tus abuelos caminando por un parque antiguo.",
    },
    {
      title: "Momentos de infancia",
      description:
        "Transforma una foto de un ser querido jugando en el patio en un video nostálgico.",
    },
  ];

  // Estado para controlar la sugerencia actual y si está hidratado
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);

  // Ciclar sugerencias cada 7 segundos solo en el cliente
  useEffect(() => {
    setIsHydrated(true); // Marca como hidratado
    const interval = setInterval(() => {
      setCurrentSuggestionIndex(
        (prevIndex) => (prevIndex + 1) % promptSuggestions.length
      );
    }, 7000); // 7 segundos

    return () => clearInterval(interval); // Limpieza al desmontar
  }, [promptSuggestions.length]);

  // Colores para los sparkles
  const sparkleColors = [
    "text-pink-500/50",
    "text-emerald-500/50",
    "text-stone-50/50",
  ];

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Cyclic Sparkle Animation */}
      <div className="absolute inset-0 pointer-events-none">
        {sparklePositions.map((pos, i) => (
          <Sparkles
            key={i}
            className={`absolute pointer-events-auto ${
              sparkleColors[i % sparkleColors.length]
            } ${
              styles.sparkle
            } hover:text-pink-400 hover:scale-125 transition-transform duration-300`}
            style={{
              top: pos.top,
              left: pos.left,
              animationDelay: isHydrated ? `${Math.random() * 3}s` : "0s",
              animationDuration: isHydrated
                ? `${3 + Math.random() * 2}s`
                : "0s",
              transform: `scale(${
                0.5 + (isHydrated ? Math.random() * 0.5 : 0)
              })`,
            }}
          />
        ))}
      </div>

      <div className="max-w-lg w-full text-center relative z-10">
        {/* 404 Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 bg-red-500/20 rounded-full mb-4 animate-pulse">
          <AlertCircle className="w-12 h-12 text-red-500" />
        </div>

        {/* Heading */}
        <h1 className="text-4xl font-extrabold text-white mb-2">
          ¡404 - Página no encontrada!
        </h1>
        <p className="text-zinc-400 text-lg mb-6">
          Parece que este recuerdo se perdió en el tiempo. ¡Aquí tienes una idea
          para traer tus fotos a la vida!
        </p>

        {/* Single Suggestion */}
        {isHydrated && (
          <div
            className={`bg-zinc-800 rounded-2xl p-6 border border-zinc-700 mb-6 ${styles.fadeIn}`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-zinc-400 text-lg font-medium">
                Idea para tu video
              </span>
              <Heart className="w-5 h-5 text-pink-500" />
            </div>
            <div className="text-left min-h-24">
              <h3 className="text-emerald-500 font-semibold">
                {promptSuggestions[currentSuggestionIndex].title}
              </h3>
              <p className="text-zinc-400 text-sm">
                {promptSuggestions[currentSuggestionIndex].description}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href={`/app?prompt=${encodeURIComponent(
              promptSuggestions[currentSuggestionIndex].description
            )}`}
            className="flex items-center justify-center gap-2 w-full bg-pink-500 hover:bg-pink-600 text-white font-medium py-3 px-6 rounded-lg transition-colors shadow-lg shadow-pink-500/50"
            aria-label="Volver al estudio para animar un recuerdo"
          >
            Animar este Recuerdo
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/paquetes"
            className="block text-center w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 px-6 rounded-lg border border-zinc-700 transition-colors"
            aria-label="Obtener más créditos"
          >
            Obtener más créditos
          </Link>
        </div>

        {/* Fun Message */}
        <div className="mt-6">
          <p className="text-xs text-zinc-500">
            ¿Quieres más inspiración? Cada pocos segundos te mostramos una nueva
            idea.
          </p>
        </div>
      </div>
    </div>
  );
}
