import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import CookieConsent from "@/components/Cookies";
import { GoogleAnalytics } from "@next/third-parties/google";
import { GlobalProvider } from "@/lib/context/GlobalContext";
import "@/lib/utils/logger"; // ✅ IMPORTACIÓN CLAVE: Asegura que se ejecute al inicio

export const metadata: Metadata = {
  title: {
    default: "Convertir Fotos a Video | PixelPages",
    template: "%s | PixelPages",
  },
  description:
    "Convierte imágenes en videos animados con música y frases personalizadas. Servicio rápido, económico y 100% online.",

  icons: {
    icon: {
      url: "/favicon.svg",
      sizes: "any",
      type: "image/svg+xml",
    },
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },

  keywords: [
    "convertir imagen a video",
    "crear video con fotos",
    "foto a video online",
    "video con música y fotos",
    "animación de fotos",
    "PixelPages",
  ],
  openGraph: {
    title: "Convierte tus fotos en videos animados 🎞️",
    description:
      "Crea recuerdos únicos: transforma tus imágenes en videos con música y frases personalizadas.",
    url: "https://fotosavideo.pixelpages.com.mx",
    siteName: "PixelPages",
    images: [
      {
        url: "https://fotosavideo.pixelpages.com.mx/og-image.png",
        width: 1200,
        height: 630,
        alt: "Ejemplo de imagen convertida en video",
      },
    ],
    locale: "es_MX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Convierte tus fotos en videos con música 🎶",
    description:
      "Haz de tus recuerdos algo único: convierte fotos en videos animados con música y frases personalizadas.",
    images: ["https://fotosavideo.pixelpages.com.mx/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let theme = process.env.NEXT_PUBLIC_THEME;
  if (!theme) {
    theme = "theme-sass3";
  }
  const gaID = process.env.NEXT_PUBLIC_GOOGLE_TAG;
  return (
    <html lang="es">
      <body className={theme}>
        <GlobalProvider>{children}</GlobalProvider>
        <Analytics />
        <CookieConsent />
        {gaID && <GoogleAnalytics gaId={gaID} />}
      </body>
    </html>
  );
}
