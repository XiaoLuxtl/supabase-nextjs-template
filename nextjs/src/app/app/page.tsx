"use client";
import React from "react";
import { useGlobal } from "@/lib/context/GlobalContext";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { CalendarDays, Settings, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function DashboardContent() {
  const { loading, user } = useGlobal();

  const getDaysSinceRegistration = () => {
    if (!user?.registered_at) return 0;
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - user.registered_at.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const daysSinceRegistration = getDaysSinceRegistration();

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Bienvenido, {user?.email?.split("@")[0]}! 👋</CardTitle>
          <CardDescription className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Miembro desde hace {daysSinceRegistration} días
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>Funciones utilizadas con frecuencia</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Link
              href="/app/user-settings"
              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="p-2 bg-primary-50 rounded-full">
                <Settings className="h-4 w-4 text-primary-600" />
              </div>
              <div>
                <h3 className="font-medium">Configuración de Usuario</h3>
                <p className="text-sm text-gray-500">
                  Gestiona tus preferencias de cuenta
                </p>
              </div>
            </Link>

            <Link
              href="/app/table"
              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="p-2 bg-primary-50 rounded-full">
                <ExternalLink className="h-4 w-4 text-primary-600" />
              </div>
              <div>
                <h3 className="font-medium">Página de Ejemplo</h3>
                <p className="text-sm text-gray-500">
                  Consulta las funciones de ejemplo
                </p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
