import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Globe,
  Shield,
  Users,
  Key,
  Database,
  Clock,
} from "lucide-react";
import AuthAwareButtons from "@/components/AuthAwareButtons";
import HomePricing from "@/components/HomePricing";

export default function Home() {
  const productName = process.env.NEXT_PUBLIC_PRODUCTNAME;

  const features = [
    {
      icon: Shield,
      title: "Autenticación Robusta",
      description:
        "Autenticación segura con email/contraseña, Autenticación Multifactor y proveedores SSO",
      color: "text-green-600",
    },
    {
      icon: Database,
      title: "Gestión de Archivos",
      description:
        "Almacenamiento de archivos integrado con uso compartido seguro, descargas y permisos granulares",
      color: "text-orange-600",
    },
    {
      icon: Users,
      title: "Configuración de Usuarios",
      description:
        "Gestión completa de usuarios con actualizaciones de contraseña, configuración de MFA y controles de perfil",

      color: "text-red-600",
    },
    {
      icon: Clock,
      title: "Gestión de Tareas",
      description:
        "Sistema de tareas integrado con actualizaciones en tiempo real y gestión de prioridades",

      color: "text-teal-600",
    },
    {
      icon: Globe,
      title: "Documentos Legales",
      description:
        "Páginas de política de privacidad, términos de servicio y política de reembolso preconfiguradas",
      color: "text-purple-600",
    },
    {
      icon: Key,
      title: "Consentimiento de Cookies",
      description:
        "Sistema de consentimiento de cookies conforme al GDPR con preferencias personalizables",
      color: "text-blue-600",
    },
  ];

  const stats = [
    { label: "Usuarios Activos", value: "155+" },
    { label: "Organizaciones", value: "2+" },
    { label: "Países", value: "5+" },
    { label: "Tiempo de Actividad", value: "99.9%" },
  ];

  return (
    <div className="min-h-screen">
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-sm z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex-shrink-0">
              <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent">
                {productName}
              </span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <Link
                href="#features"
                className="text-gray-600 hover:text-gray-900"
              >
                Carácterísticas
              </Link>

              <Link
                href="#pricing"
                className="text-gray-600 hover:text-gray-900"
              >
                Precios
              </Link>
              <Link
                href="https://github.com/Razikus/supabase-nextjs-template"
                className="text-gray-600 hover:text-gray-900"
                target="_blank"
                rel="noopener noreferrer"
              >
                Documentación
              </Link>

              <Link
                href="https://github.com/Razikus/supabase-nextjs-template"
                className="bg-primary-800 text-white px-4 py-2 rounded-lg hover:bg-primary-900 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Obten esta plantilla
              </Link>

              <AuthAwareButtons variant="nav" />
            </div>
          </div>
        </div>
      </nav>

      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              Arranque su SaaS
              <span className="block text-primary-600">En 5 minutos </span>
            </h1>
            <p className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto">
              Lanza tu producto SaaS en días, no meses. Completo con
              autenticación y seguridad de nivel empresarial integradas.
            </p>
            <div className="mt-10 flex gap-4 justify-center">
              <AuthAwareButtons />
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl font-bold text-primary-600">
                  {stat.value}
                </div>
                <div className="mt-2 text-sm text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold">Todo lo que Necesitas</h2>
            <p className="mt-4 text-xl text-gray-600">
              Construido con tecnologías modernas para confiabilidad y velocidad
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow"
              >
                <feature.icon className={`h-8 w-8 ${feature.color}`} />
                <h3 className="mt-4 text-xl font-semibold">{feature.title}</h3>
                <p className="mt-2 text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <HomePricing />

      <section className="py-24 bg-primary-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white">
            ¿Estás Listo para Transformar Tu Idea en Realidad?
          </h2>
          <p className="mt-4 text-xl text-primary-100">
            U´nete a cientos de personas creando sus videos con {productName}
          </p>
          <Link
            href="/auth/register"
            className="mt-8 inline-flex items-center px-6 py-3 rounded-lg bg-white text-primary-600 font-medium hover:bg-primary-50 transition-colors"
          >
            Comenzar Ahora
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>

      <footer className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Product</h4>
              <ul className="mt-4 space-y-2">
                <li>
                  <Link
                    href="#features"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Características
                  </Link>
                </li>
                <li>
                  <Link
                    href="#pricing"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Precios
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Resources</h4>
              <ul className="mt-4 space-y-2">
                <li>
                  <Link
                    href="https://github.com/Razikus/supabase-nextjs-template"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Documentación
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Legal</h4>
              <ul className="mt-4 space-y-2">
                <li>
                  <Link
                    href="/legal/privacy"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Privacidad
                  </Link>
                </li>
                <li>
                  <Link
                    href="/legal/terms"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Términos
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-center text-gray-600">
              © {new Date().getFullYear()} {productName}. Todos los derechos
              reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
