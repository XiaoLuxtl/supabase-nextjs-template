// src/app/app/tutorial/page.tsx
"use client";

import { Play, HelpCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function TutorialPage() {
  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/app"
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver al inicio
          </Link>
        </div>

        {/* Título y descripción */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-pink-500/10 text-pink-400 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <HelpCircle className="w-4 h-4" />
            Guía de uso
          </div>
          <h1 className="text-4xl font-bold mb-4">Cómo usar la aplicación</h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Mira este video tutorial paso a paso para aprender a convertir tus
            imágenes en videos animados
          </p>
        </div>

        {/* Video Container */}
        <div className="bg-zinc-800 rounded-2xl border border-zinc-700 overflow-hidden shadow-2xl mb-8">
          <div className="aspect-video relative">
            <iframe
              src="https://www.youtube.com/embed/1Cd2_PNEZ-U"
              title="Tutorial: Cómo usar la aplicación"
              className="w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>

        {/* Información adicional */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
            <h3 className="text-xl font-semibold mb-3 text-pink-400">
              ¿Qué aprenderás?
            </h3>
            <ul className="space-y-2 text-zinc-300">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                Cómo subir imágenes
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                Redactar un buen prompt
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                Generar videos animados
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                Descargar tus videos
              </li>
            </ul>
          </div>

          <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
            <h3 className="text-xl font-semibold mb-3 text-pink-400">
              ¿Necesitas más ayuda?
            </h3>
            <p className="text-zinc-300 mb-4">
              Si tienes alguna duda después de ver el tutorial, puedes{" "}
              <a
                href="https://wa.me/8124804243?text=Hola%20compr%C3%A9%20cr%C3%A9ditos%20pero%20me%20surge%20una%20duda%2C%20%C2%BFHay%20alguien%20para%20atenderme%3F"
                target="_blank"
                rel="noopener noreferrer"
                className="text-pink-400 hover:text-pink-300 underline font-medium"
                aria-label="Contactar por WhatsApp para soporte técnico"
              >
                contactarnos por WhatsApp
              </a>
              .
            </p>
            <div className="space-y-3">
              <Link
                href="/app"
                className="block w-full bg-pink-500 hover:bg-pink-600 text-white font-medium py-3 px-6 rounded-lg transition-colors text-center"
              >
                <Play className="w-4 h-4 inline mr-2" />
                Probar la aplicación
              </Link>
              <Link
                href="/paquetes"
                className="block w-full border border-zinc-700 text-zinc-300 hover:bg-zinc-700 font-medium py-3 px-6 rounded-lg transition-colors text-center"
              >
                Comprar más créditos
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-zinc-500 text-sm">
          <p>
            ¿El video no se carga?{" "}
            <a
              href="https://youtu.be/1Cd2_PNEZ-U"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pink-400 hover:underline"
            >
              Ver en YouTube
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
