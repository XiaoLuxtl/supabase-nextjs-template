"use client";

import { useState, useEffect } from "react";
// Asegúrate que esta ruta a tu cliente sea correcta
import { createSPASassClient } from "@/lib/supabase/client";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useRouter } from "next/navigation";
import { CheckCircle, Key } from "lucide-react";
import Link from "next/link"; // Asegúrate de tener Link importado si lo usas

export default function ResetPasswordPage() {
  const { sessionHealth, refreshUserProfile } = useGlobal();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isSessionValid, setIsSessionValid] = useState(false); // Estado para controlar si puede escribir la nueva contraseña
  const router = useRouter();

  // Función helper para hacer requests con retry
  const fetchWithRetry = async <T,>(
    operation: () => Promise<T>,
    maxRetries = 2
  ): Promise<T> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt < maxRetries) {
          console.log(
            `Password reset operation failed, retrying (${
              attempt + 1
            }/${maxRetries})`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * (attempt + 1))
          );
          continue;
        }
        throw error;
      }
    }
    // This should never be reached, but TypeScript needs it
    throw new Error("Max retries exceeded");
  };

  // 1. VERIFICACIÓN DE SESIÓN DE RECUPERACIÓN
  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabaseWrapper = createSPASassClient();
        const supabase = supabaseWrapper.getSupabaseClient();

        // 🚨 CORRECCIÓN CLAVE: Usamos getSession() para detectar la sesión temporal
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) throw error;

        // Si no hay sesión, o si la sesión no es la que se espera para un reset,
        // no permitimos el cambio de contraseña.
        if (session === null) {
          setError(
            "Enlace inválido o expirado. Por favor, solicita un nuevo restablecimiento de contraseña."
          );
          setIsSessionValid(false);
        } else {
          // El usuario está "logueado" con una sesión temporal de recovery.
          setIsSessionValid(true);
        }
      } catch (err) {
        let errorMessage = "Fallo al verificar la sesión de restablecimiento.";
        if (err instanceof Error) {
          errorMessage = err.message;
        }
        setError(errorMessage);
        setIsSessionValid(false);
      }
    };

    checkSession();
  }, []);

  // 2. ENVÍO DE FORMULARIO PARA ACTUALIZAR CONTRASEÑA
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      // Validar health de la sesión antes de proceder
      if (sessionHealth !== "healthy") {
        console.warn(
          "Session health check failed, attempting refresh before password update"
        );
        await refreshUserProfile();
      }

      await fetchWithRetry(async () => {
        const supabaseWrapper = createSPASassClient();
        const supabase = supabaseWrapper.getSupabaseClient();

        // La sesión de recuperación debe estar activa para que esto funcione
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (error) {
          // Manejo específico del error de Supabase
          throw new Error(
            error.message ||
              "Error al actualizar la contraseña. La sesión pudo haber expirado."
          );
        }
      });

      setSuccess(true);
      // Redirigir al login después de un breve tiempo
      setTimeout(() => {
        router.push("/auth/login");
      }, 3000);
    } catch (err) {
      let errorMessage = "Ocurrió un error desconocido. Intenta de nuevo.";
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 3. VISTAS DEL COMPONENTE

  if (success) {
    return (
      <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <div className="mx-auto max-w-sm text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            ¡Contraseña actualizada!
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Tu contraseña ha sido cambiada exitosamente. Serás redirigido para
            iniciar sesión.
          </p>
        </div>
      </div>
    );
  }

  // Muestra un mensaje de error si la sesión no es válida ANTES del formulario
  if (!isSessionValid && error) {
    return (
      <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <div className="mx-auto max-w-sm text-center">
          <Key className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Error de Restablecimiento
          </h2>
          <p className="mt-2 text-sm font-medium text-red-600">{error}</p>
          <div className="mt-6">
            <Link
              href="/auth/forgot-password"
              className="text-sm font-medium text-primary-600 hover:text-primary-500"
            >
              Solicitar un nuevo enlace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Key className="mx-auto h-12 w-auto text-primary-600" />
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
          Establecer Nueva Contraseña
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3" role="alert">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* ... (Tu código actual para la contraseña) ... */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Nueva Contraseña
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium text-gray-700"
              >
                Confirmar Nueva Contraseña
              </label>
              <div className="mt-1">
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                La contraseña debe tener al menos 6 caracteres
              </p>
            </div>
            {/* ... (Fin de tu código actual para la contraseña) ... */}

            <div>
              <button
                type="submit"
                disabled={loading || !isSessionValid}
                className="flex w-full justify-center rounded-md border border-transparent bg-primary-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? "Actualizando..." : "Cambiar Contraseña"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
