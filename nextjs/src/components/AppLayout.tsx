"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  User,
  Menu,
  X,
  ChevronDown,
  LogOut,
  PlayCircle,
  Key,
  ChevronLast,
  ChevronFirst,
} from "lucide-react";
import { useGlobal } from "@/lib/context/GlobalContext";
import { cn } from "@/lib/utils";

export default function AppLayout({ children }: React.PropsWithChildren) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isUserDropdownOpen, setUserDropdownOpen] = useState(false);
  const [forceShowContent, setForceShowContent] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, forceLogout, initialized, isAuthenticated } = useGlobal();

  // Failsafe: Forzar mostrar contenido después de 2 segundos si no se inicializó
  useEffect(() => {
    if (!initialized && !forceShowContent) {
      const timeout = setTimeout(() => {
        console.warn(
          "⏰ Failsafe activado: Mostrando contenido después de 2 segundos de carga"
        );
        setForceShowContent(true);
      }, 2000); // 2 segundos

      return () => clearTimeout(timeout);
    }
  }, [initialized, forceShowContent]);

  // Redirigir automáticamente si no hay usuario autenticado
  useEffect(() => {
    console.log("🔍 AppLayout useEffect:", { initialized, isAuthenticated });
    if (initialized && !isAuthenticated) {
      console.log("🔒 No authenticated user, redirecting to login");
      // Usar window.location para redirección forzada
      globalThis.location.href = "/auth/login";
    }
  }, [initialized, isAuthenticated]);

  // Manejar clics fuera del dropdown de usuario
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isUserDropdownOpen) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-dropdown="user-menu"]')) {
          setUserDropdownOpen(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isUserDropdownOpen]);

  // Mostrar loading mientras se inicializa la autenticación (con failsafe)
  if (!initialized && !forceShowContent) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-zinc-400">Cargando...</p>
        </div>
      </div>
    );
  }

  // Si está inicializado (o forzado por failsafe) pero no autenticado, mostrar redirigiendo y dejar que el useEffect maneje la redirección
  if ((initialized || forceShowContent) && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-zinc-400">Redirigiendo...</p>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await forceLogout();
      router.push("/auth/login");
    } catch (error) {
      console.error("Error logging out:", error);
      // Fallback: forzar recarga de página
      globalThis.location.href = "/auth/login";
    }
  };

  const handleChangePassword = async () => {
    router.push("/app/user-settings");
  };

  const getInitials = (email: string) => {
    const parts = email.split("@")[0].split(/[._-]/);
    return parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  };

  const productName = process.env.NEXT_PUBLIC_PRODUCTNAME;

  const navigation = [
    { name: "Inicio", href: "/app", icon: Home },
    { name: "Tutorial", href: "/app/tutorial", icon: PlayCircle },
    {
      name: "Configuración de Usuario",
      href: "/app/user-settings",
      icon: User,
    },
  ];

  const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Overlay para móvil */}
      {isSidebarOpen && (
        <button
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}
      {/* Barra superior móvil */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-gray-200/50 shadow-sm z-50 lg:hidden">
        <div className="flex items-center justify-between h-full px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg bg-white/30 backdrop-blur-sm border border-white/50 shadow-lg text-gray-700 hover:text-gray-900 hover:bg-white/40 transition-all"
            >
              <Menu className="h-6 w-6" />
            </button>
            <span className="text-lg font-semibold text-primary-600 truncate">
              {productName}
            </span>
          </div>
          <div data-dropdown="user-menu" className="relative">
            <button
              onClick={() => setUserDropdownOpen(!isUserDropdownOpen)}
              className="flex items-center space-x-2 text-sm p-1.5 rounded-lg bg-white/30 backdrop-blur-sm border border-white/50 shadow-lg text-gray-700 hover:text-gray-900 hover:bg-white/40 transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-primary-100/80 backdrop-blur-sm flex items-center justify-center">
                <span className="text-primary-700 font-medium">
                  {user ? getInitials(user.email) : "??"}
                </span>
              </div>
              <ChevronDown className="h-4 w-4" />
            </button>
            {/* Menú desplegable de usuario */}
            {isUserDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white/80 backdrop-blur-md rounded-lg shadow-lg border border-white/50">
                <div className="p-2 border-b border-gray-200/50">
                  <p className="text-xs text-gray-600">Conectado como</p>
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.email}
                  </p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      handleChangePassword();
                    }}
                    className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50/50 transition-colors"
                  >
                    <Key className="mr-3 h-4 w-4 text-gray-400" />
                    Cambiar Contraseña
                  </button>
                  <button
                    onClick={() => {
                      handleLogout();
                      setUserDropdownOpen(false);
                    }}
                    className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50/50 transition-colors"
                  >
                    <LogOut className="mr-3 h-4 w-4 text-red-400" />
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 bg-white shadow-lg transform transition-all duration-300 ease-in-out z-40",
          isCollapsed ? "w-16" : "w-64",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div
          className={cn(
            "h-16 flex items-center border-b",
            isCollapsed ? "justify-center px-2" : "justify-between px-4"
          )}
        >
          {!isCollapsed && (
            <span className="text-xl font-semibold text-primary-600 truncate">
              {productName}
            </span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:block text-gray-500 hover:text-gray-700"
          >
            {isCollapsed ? (
              <ChevronLast className="h-5 w-5" />
            ) : (
              <ChevronFirst className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={toggleSidebar}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        {/* Navigation */}
        <nav className={cn("mt-4 space-y-1", isCollapsed ? "px-1" : "px-2")}>
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center py-2 text-sm font-medium rounded-md",
                  isCollapsed ? "px-1 justify-center" : "px-2",
                  isActive
                    ? "bg-primary-50 text-primary-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon
                  className={cn(
                    "flex-shrink-0 h-5 w-5",
                    isCollapsed ? "mx-auto" : "mr-3",
                    isActive
                      ? "text-primary-500"
                      : "text-gray-400 group-hover:text-gray-500"
                  )}
                />
                {!isCollapsed && item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      {/* Contenido principal */}
      <div
        className={cn(
          "transition-all duration-300 pt-16 lg:pt-0",
          isCollapsed ? "lg:pl-16" : "lg:pl-64"
        )}
      >
        {/* Botón de usuario para desktop */}
        <div className="fixed top-4 right-4 z-50 hidden lg:block">
          <div data-dropdown="user-menu" className="relative">
            <button
              onClick={() => setUserDropdownOpen(!isUserDropdownOpen)}
              className="flex items-center space-x-2 text-sm p-1.5 rounded-lg bg-white/30 backdrop-blur-sm border border-white/50 shadow-lg text-gray-700 hover:text-gray-900 hover:bg-white/40 transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-primary-100/80 backdrop-blur-sm flex items-center justify-center">
                <span className="text-primary-700 font-medium">
                  {user ? getInitials(user.email) : "??"}
                </span>
              </div>
              <ChevronDown className="h-4 w-4" />
            </button>
            {/* Menú desplegable de usuario en desktop */}
            {isUserDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white/80 backdrop-blur-md rounded-lg shadow-lg border border-white/50">
                <div className="p-2 border-b border-gray-200/50">
                  <p className="text-xs text-gray-600">Conectado como</p>
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.email}
                  </p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      handleChangePassword();
                    }}
                    className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50/50 transition-colors"
                  >
                    <Key className="mr-3 h-4 w-4 text-gray-400" />
                    Cambiar Contraseña
                  </button>
                  <button
                    onClick={() => {
                      handleLogout();
                      setUserDropdownOpen(false);
                    }}
                    className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50/50 transition-colors"
                  >
                    <LogOut className="mr-3 h-4 w-4 text-red-400" />
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <main>{children}</main>
      </div>
    </div>
  );
}
