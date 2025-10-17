import React from "react";
import { Shield, Video, Image, Zap, Star, Database } from "lucide-react";

const features = [
  // Mover Generación de Video a la posición 1
  {
    icon: Video,
    title: "Generación de Video Instantánea", // Titulo levemente mejorado
    description:
      "Convierte cualquier imagen fija o foto restaurada en un video dinámico, listo para redes sociales.",
    color: "text-pink-400",
  },
  {
    icon: Image,
    title: "Restauración Fotográfica Avanzada",
    description:
      "Mejora la calidad de tus fotos antiguas, corrige el color y elimina el ruido con nuestros servicios.",
    color: "text-emerald-400",
  },
  {
    icon: Zap, // Mover la velocidad a los primeros 3 para impacto.
    title: "Procesamiento Ultra Rápido",
    description:
      "Genera videos sin largas esperas, gracias a nuestra infraestructura optimizada.",
    color: "text-pink-400",
  },
  // Resto de features en el orden original
  {
    icon: Database,
    title: "Almacenamiento Seguro de Archivos",
    description:
      "Guarda videos generados con almacenamiento integrado y permisos de descarga.",
    color: "text-zinc-400",
  },
  {
    icon: Star,
    title: "Guías Detalladas y Video Tutoriales",
    description:
      "Guías paso a paso para dominar la restauración de fotos y la creación de videos con nuestro sistema.",
    color: "text-emerald-400",
  },
  {
    icon: Shield,
    title: "Cuenta y Privacidad",
    description:
      "Autenticación segura con email/contraseña y controles de privacidad para tus archivos multimedia.",
    color: "text-zinc-400",
  },
];

export default function HomeFeatures() {
  return (
    <section id="features" className="py-24 bg-zinc-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-emerald-500">
            Herramientas de Transformación
          </h2>
          <p className="mt-4 text-xl text-zinc-400">
            Tecnología de punta para animar fotos y crear contenido dinámico.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-zinc-800 p-6 rounded-xl shadow-lg border-2 border-zinc-700 hover:border-pink-500 transition-all duration-300"
            >
              <feature.icon className={`h-8 w-8 ${feature.color}`} />
              <h3 className="mt-4 text-xl font-semibold text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-zinc-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
