"use client"; // Necesario para componentes que usan estado o eventos
import React, { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
// Importación con alias, la ruta correcta de Next.js
import AuthAwareButtons from "@/components/AuthAwareButtons";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const productName = process.env.NEXT_PUBLIC_PRODUCTNAME || "PixelPages";

  const navLinks = [
    { href: "/#features", label: "Características" },
    { href: "/#pricing", label: "Precios" },
  ];

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <nav className="fixed top-0 w-full bg-zinc-900/95 backdrop-blur-md z-50 border-b border-zinc-700 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo - Ajuste de tamaño en móvil (sm:text-2xl) */}
          <div className="flex-shrink-0">
            <Link
              href="/"
              className="text-xl sm:text-2xl font-extrabold bg-gradient-to-r from-pink-500 to-emerald-500 bg-clip-text text-transparent"
            >
              {productName}
            </Link>
          </div>

          {/* Menú de Escritorio (Oculto en Mobile) */}
          <div className="hidden p-2 md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-zinc-100 hover:text-pink-500 transition-colors font-medium"
              >
                {link.label}
              </Link>
            ))}
            {/* Botones de autenticación para escritorio (variant="nav" suele ser compacto) */}
            <AuthAwareButtons variant="nav" />
          </div>

          {/* Botón de Hamburguesa (Visible solo en Mobile) */}
          <div className="md:hidden">
            <button
              onClick={toggleMenu}
              className="p-2 text-zinc-300 hover:text-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500 rounded-lg transition-colors"
              aria-expanded={isMenuOpen}
              aria-label="Toggle navigation"
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Menú Móvil Desplegable */}
      {isMenuOpen && (
        <div className="md:hidden absolute w-full bg-zinc-900/95 border-b border-zinc-700 pb-4 shadow-2xl transition-all duration-300 ease-in-out">
          <div className="px-4 pt-2 pb-3 space-y-2 sm:px-3 flex flex-col">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={toggleMenu} // Cerrar el menú al hacer clic en un enlace
                // Texto de tamaño base con padding mayor para fácil toque
                className="block text-base font-medium text-zinc-100 hover:bg-zinc-800 hover:text-pink-500 p-3 rounded-lg transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-zinc-800 mx-3">
              {/* Botones de autenticación para móvil, ocupando todo el ancho */}
              <AuthAwareButtons primaryStyle="w-full justify-center bg-pink-500 hover:bg-pink-400" />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
