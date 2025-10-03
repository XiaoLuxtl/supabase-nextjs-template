import Link from "next/link";
import React from "react";

export default function HomeFooter() {
  const productName = process.env.NEXT_PUBLIC_PRODUCTNAME || "PixelPages";

  return (
    <footer className="bg-zinc-800 border-t border-zinc-700">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Usamos grid-cols-2 en móvil y sm:grid-cols-3 en tablet/desktop para 3 columnas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
          {/* Columna 1: Producto */}
          <div>
            <h4 className="text-sm font-semibold text-white">Producto</h4>
            <ul className="mt-4 space-y-2">
              <li>
                <Link
                  href="#features"
                  className="text-zinc-400 hover:text-emerald-500 transition-colors"
                >
                  Características
                </Link>
              </li>
              <li>
                <Link
                  href="#pricing"
                  className="text-zinc-400 hover:text-emerald-500 transition-colors"
                >
                  Precios
                </Link>
              </li>
            </ul>
          </div>

          {/* Columna 2: Recursos */}
          <div>
            <h4 className="text-sm font-semibold text-white">Recursos</h4>
            <ul className="mt-4 space-y-2">
              <li>
                <Link
                  href="https://github.com/Razikus/supabase-nextjs-template"
                  className="text-zinc-400 hover:text-emerald-500 transition-colors"
                  target="_blank"
                >
                  Documentación
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="text-zinc-400 hover:text-emerald-500 transition-colors"
                >
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Columna 3: Legal */}
          <div>
            <h4 className="text-sm font-semibold text-white">Legal</h4>
            <ul className="mt-4 space-y-2">
              <li>
                <Link
                  href="/legal/privacy"
                  className="text-zinc-400 hover:text-emerald-500 transition-colors"
                >
                  Privacidad
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/terms"
                  className="text-zinc-400 hover:text-emerald-500 transition-colors"
                >
                  Términos
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Derechos de autor */}
        <div className="mt-8 pt-8 border-t border-zinc-700">
          <p className="text-center text-zinc-500 text-sm">
            © {new Date().getFullYear()} {productName}. Todos los derechos
            reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
