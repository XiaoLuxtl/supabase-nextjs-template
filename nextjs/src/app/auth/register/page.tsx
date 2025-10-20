"use client";

import { createSPASassClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";

import { useRouter } from "next/navigation";
import Link from "next/link";
import SSOButtons from "@/components/SSOButtons";

export default function RegisterPage() {
  // (ya declarado arriba)
  // Redirigir si ya está logeado
  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createSPASassClient();
        const {
          data: { user },
        } = await supabase.getSupabaseClient().auth.getUser();
        if (user) {
          router.replace("/app");
        }
      } catch (e) {
        console.error("Error checking session:", e);
        // Ignorar error, dejar en página de registro
      }
    };
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
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
            `Register operation failed, retrying (${attempt + 1}/${maxRetries})`
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!acceptedTerms) {
      setError("You must accept the Terms of Service and Privacy Policy");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);

    try {
      await fetchWithRetry(async () => {
        const supabase = createSPASassClient();
        const { error } = await supabase.registerEmail(email, password);

        if (error) throw error;
      });

      router.push("/auth/verify-email");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
      {error && (
        <div className="mb-4 p-4 text-sm text-red-700 bg-red-100 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700"
          >
            Correo Electrónico
          </label>
          <div className="mt-1">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700"
          >
            Contraseña
          </label>
          <div className="mt-1">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-gray-700"
          >
            Confirmar Contraseña
          </label>
          <div className="mt-1">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-start">
            <div className="flex h-5 items-center">
              <input
                id="terms"
                name="terms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="terms" className="text-gray-600">
                Acepto los{" "}
                <Link
                  href="/legal/terms"
                  className="font-medium text-primary-600 hover:text-primary-500"
                  target="_blank"
                >
                  Términos de Servicio
                </Link>{" "}
                y{" "}
                <Link
                  href="/legal/privacy"
                  className="font-medium text-primary-600 hover:text-primary-500"
                  target="_blank"
                >
                  Política de Privacidad
                </Link>
              </label>
            </div>
          </div>
        </div>
        <div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full justify-center rounded-md border border-transparent bg-primary-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? "Creando cuenta..." : "Crear Cuenta"}
          </button>
        </div>
      </form>

      <SSOButtons onError={setError} />

      <div className="mt-6 text-center text-sm">
        <span className="text-gray-600">¿Ya tienes una cuenta?</span>{" "}
        <Link
          href="/auth/login"
          className="font-medium text-primary-600 hover:text-primary-500"
        >
          Iniciar sesión
        </Link>
      </div>
    </div>
  );
}
