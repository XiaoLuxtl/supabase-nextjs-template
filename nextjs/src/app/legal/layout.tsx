"use client";
import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation"; // Usamos usePathname para saber qué link está activo
import { ArrowLeft, FileText, ShieldAlert, RefreshCw } from "lucide-react";

const legalDocuments = [
  {
    id: "privacy",
    title: "Política de Privacidad",
    icon: ShieldAlert,
    description: "Cómo manejamos y protegemos tus datos",
    href: "/legal/privacy",
  },
  {
    id: "terms",
    title: "Términos de Servicio",
    icon: FileText,
    description: "Reglas y directrices para el uso de nuestro servicio",
    href: "/legal/terms",
  },
  {
    id: "refund",
    title: "Política de Reembolso",
    icon: RefreshCw,
    description: "Nuestra política sobre reembolsos y cancelaciones",
    href: "/legal/refund",
  },
];

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname(); // Hook para obtener la URL actual

  return (
    // CAMBIO 1: Fondo principal a stone-50 (blanco suave)
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Envoltorio del contenido, con padding superior e inferior */}
        <div>
          <div className="flex flex-col lg:flex-row gap-10">
            {/* ====================================================== */}
            {/* SIDEBAR NAVIGATION (Menú Fijo/Sticky) */}
            {/* ====================================================== */}
            <div className="w-full lg:w-64 flex-shrink-0">
              {/* CAMBIO 2: Hacemos el menú sticky en pantallas grandes */}
              {/* El `top-8` deja espacio debajo del botón "Volver" */}
              <div className="lg:sticky lg:top-8 bg-white rounded-xl shadow-lg border border-gray-100">
                <button
                  onClick={() => router.back()}
                  // Adaptamos el botón "Volver" a la paleta emerald
                  className="p-5 inline-flex items-center text-sm text-emerald-600 font-medium hover:text-emerald-800 transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver a la aplicación
                </button>
                {/* Header del menú */}
                <div className="p-5 border-b border-gray-100">
                  <h2 className="text-xl font-bold text-gray-900">
                    Documentos Legales
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Información importante sobre nuestros servicios
                  </p>
                </div>

                {/* Lista de Navegación */}
                <nav className="p-3 space-y-1">
                  {legalDocuments.map((doc) => {
                    // Determinar si el enlace está activo
                    const isActive = pathname.includes(doc.href);

                    return (
                      <Link
                        key={doc.id}
                        href={doc.href}
                        // CAMBIO 3: Estilos de Link y hover/activo con Emerald
                        className={`block p-3 rounded-lg transition-all duration-150 ${
                          isActive
                            ? "bg-emerald-50 text-emerald-800 font-semibold shadow-inner" // Activo
                            : "text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 font-medium" // Inactivo
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* CAMBIO 4: Iconos con color dinámico basado en estado activo */}
                          <doc.icon
                            className={`w-5 h-5 ${
                              isActive ? "text-emerald-500" : "text-gray-400"
                            }`}
                          />
                          <div>
                            <div className="text-sm">{doc.title}</div>
                            <div
                              className={`text-xs ${
                                isActive ? "text-emerald-600" : "text-gray-500"
                              }`}
                            >
                              {doc.description}
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>

            {/* ====================================================== */}
            {/* MAIN CONTENT (Scrollable) */}
            {/* ====================================================== */}
            <div className="flex-1 min-w-0">
              {/* CAMBIO 5: Contenido principal envuelto en una tarjeta blanca para el contraste */}
              <div className="bg-white p-8 sm:p-10 rounded-xl shadow-lg border border-gray-100 prose prose-emerald max-w-none">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
