// src/hooks/usePackages.ts
import { useEffect, useState, useCallback } from "react";
import { createSPAClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

// Usar el tipo exacto de Supabase
type CreditPackage = Database["public"]["Tables"]["credit_packages"]["Row"];

/**
 * Función auxiliar para leer desde localStorage.
 * Retorna un array vacío en caso de que no exista o haya error de parseo.
 */
function getCachedPackages(): CreditPackage[] {
  if (typeof window !== "undefined") {
    const cached = localStorage.getItem("credit_packages");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return [];
      }
    }
  }
  return [];
}

export function usePackages() {
  const initialPackages = getCachedPackages();
  const [packages, setPackages] = useState<CreditPackage[]>(initialPackages);

  // Inicializa loading a true SOLO si no hay caché. Si hay caché, se muestra
  // inmediatamente mientras se obtienen los datos de Supabase.
  const [loading, setLoading] = useState(() => initialPackages.length === 0);
  const [error, setError] = useState<string | null>(null);

  // --- 1. FUNCIÓN DE CARGA (SOURCE OF TRUTH: SUPABASE) ---
  const loadPackages = useCallback(async () => {
    try {
      // Establecer loading a true. Si ya era false por el caché, se activa
      // ahora para el periodo de la llamada a la API.
      setLoading(true);

      const supabase = createSPAClient();

      const { data, error: fetchError } = await supabase
        .from("credit_packages")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (fetchError) throw fetchError;

      // Aplicar Type Assertion
      const packagesData = (data || []) as unknown as CreditPackage[];

      // Actualiza el estado con los datos de Supabase (la verdad)
      setPackages(packagesData);

      if (typeof window !== "undefined") {
        // Actualiza el caché con los datos más recientes
        localStorage.setItem("credit_packages", JSON.stringify(packagesData));
      }
      setError(null);
    } catch (err) {
      console.error("Error loading packages:", err);
      setError("Error al cargar paquetes");
      // Nota: Si falla, el estado de 'packages' mantendrá el valor del caché inicial.
    } finally {
      setLoading(false);
    }
  }, []);

  // --- 2. SINCRONIZACIÓN LOCAL (CACHÉ ENTRE PESTAÑAS) ---
  const syncFromLocalStorage = useCallback(() => {
    const newPackages = getCachedPackages();
    // Usa JSON.stringify para una comparación de igualdad profunda entre arrays
    const currentCached = JSON.stringify(packages);
    const newCached = JSON.stringify(newPackages);

    if (currentCached !== newCached) {
      // Si el caché fue modificado por otra pestaña, actualiza nuestro estado.
      setPackages(newPackages);
    }
  }, [packages]);

  // --- 3. EFECTO PRINCIPAL (MONTAJE) ---
  useEffect(() => {
    // 🔥 La clave: Llama SIEMPRE a loadPackages para obtener la verdad de Supabase
    loadPackages();

    // Listener para el evento 'storage' (sincronización entre pestañas)
    if (typeof window !== "undefined") {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.key === "credit_packages") {
          syncFromLocalStorage();
        }
      };

      window.addEventListener("storage", handleStorageChange);

      return () => {
        window.removeEventListener("storage", handleStorageChange);
      };
    }
    // loadPackages es estable gracias a useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPackages]);

  // --- Helpers ---
  const fixedPackages = packages.filter((p) => p.package_type === "fixed");
  const customPackage = packages.find((p) => p.package_type === "custom");
  const popularPackage = packages.find((p) => p.is_popular);

  return {
    packages,
    fixedPackages,
    customPackage,
    popularPackage,
    loading,
    error,
    refresh: loadPackages, // Función para forzar la recarga manual
  };
}
