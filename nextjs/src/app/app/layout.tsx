// src/app/app/layout.tsx
import type { Metadata } from "next";
import AppLayout from "@/components/AppLayout";
import { GlobalProvider } from "@/lib/context/GlobalContext";

export const metadata: Metadata = {
  title: {
    default: "Imagen a video",
    template: "%s",
  },
  description:
    "Convierte imágenes en videos animados con música y frases personalizadas. Servicio rápido, económico y 100% online.",

  icons: {
    icon: "/favicon.svg", // Favicon principal (SVG recomendado)
    apple: "/apple-touch-icon.png", // Icono para dispositivos Apple
    shortcut: "/favicon.ico", // Icono de respaldo si lo tienes
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <GlobalProvider>
      <AppLayout>{children}</AppLayout>
    </GlobalProvider>
  );
}
