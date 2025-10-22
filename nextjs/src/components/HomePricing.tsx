"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Minus, Loader2 } from "lucide-react";
import { usePackages } from "@/hooks/usePackages";
import { useCredits } from "@/hooks/useCredits";
import type { Database, Json } from "@/types/database.types";

// Usar el tipo exacto de Supabase
type CreditPackage = Database["public"]["Tables"]["credit_packages"]["Row"];

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

type User = {
  email: string;
  id: string;
  registered_at: Date;
  credits_balance: number;
};

interface DynamicCreditCardProps {
  package: CreditPackage;
  onPurchase: (pkg: CreditPackage, credits: number) => void;
  currentUser: User | null;
  isGlobalLoading: boolean;
  isAuthenticated: boolean; // ✅ Nuevo prop
}

function getFeaturesArray(features: Json): string[] {
  if (!features) return [];
  if (
    Array.isArray(features) &&
    features.every((item) => typeof item === "string")
  ) {
    return features;
  }
  return [];
}

const DynamicCreditCard = ({
  package: pkg,
  onPurchase,
  isGlobalLoading,
  isAuthenticated, // ✅ Recibir estado de autenticación
}: DynamicCreditCardProps) => {
  const [credits, setCredits] = useState(() => pkg.min_credits || 20);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const totalPrice = credits * (pkg.price_per_credit || 30);
  const router = useRouter();

  const handleCreditsChange = (amount: number) => {
    setCredits((prevCredits) =>
      Math.max(pkg.min_credits || 15, prevCredits + amount)
    );
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();

    if (isGlobalLoading) return;

    // ✅ Usar isAuthenticated en lugar de currentUser para verificación inmediata
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    // Si está autenticado, procede con la compra
    setIsPurchasing(true);
    onPurchase(pkg, credits);
  };

  // Determinar texto del botón basado en estados
  const getButtonText = () => {
    if (isGlobalLoading) {
      return {
        text: "Cargando...",
        icon: <Loader2 className="w-5 h-5 animate-spin" />,
      };
    }
    if (!isAuthenticated) {
      return { text: "Iniciar Sesión y Comprar", icon: null };
    }
    if (isPurchasing) {
      return {
        text: "Procesando...",
        icon: <Loader2 className="w-5 h-5 animate-spin" />,
      };
    }
    return { text: `Comprar ${credits} Créditos`, icon: null };
  };

  const buttonContent = getButtonText();

  return (
    <Card className="relative flex flex-col border-2 border-dashed border-gray-400 bg-gray-50">
      <CardHeader>
        <CardTitle className="text-xl">{pkg.name}</CardTitle>
        <CardDescription>{pkg.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex-grow flex flex-col justify-between">
        {/* Selector de Créditos */}
        <div className="mb-6 flex flex-col items-center">
          <div className="text-sm font-semibold text-gray-600 mb-2">
            Selecciona la cantidad: (Mínimo {pkg.min_credits})
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => handleCreditsChange(-5)}
              disabled={credits <= (pkg.min_credits || 15)}
              className="p-2 border rounded-full bg-white hover:bg-gray-100 disabled:opacity-50 transition"
            >
              <Minus className="h-5 w-5" />
            </button>
            <span className="text-5xl font-extrabold text-primary-600">
              {credits}
            </span>
            <button
              onClick={() => handleCreditsChange(5)}
              className="p-2 border rounded-full bg-white hover:bg-gray-100 transition"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Precio Total */}
        <div className="mb-6 text-center">
          <button onClick={handleButtonClick}>
            <span className="text-2xl font-bold">
              ${totalPrice.toFixed(2)} MXN
            </span>
            <span className="text-gray-600 ml-2">/ Total</span>
            <div className="text-sm text-gray-500 mt-1">
              ${pkg.price_per_credit} MXN por crédito
            </div>
          </button>
        </div>

        <ul className="space-y-3 mb-8">
          {getFeaturesArray(pkg.features).map((feature, i) => (
            <li key={i} className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              <span className="text-gray-600">{feature}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={handleButtonClick}
          disabled={isPurchasing || isGlobalLoading}
          className="w-full text-center px-6 py-3 rounded-lg font-medium transition-colors bg-gray-50 hover:bg-gray-100 text-gray-900 flex items-center justify-center gap-2"
        >
          {buttonContent.icon}
          {buttonContent.text}
        </button>
      </CardContent>
    </Card>
  );
};

// ====================================================================
// Componente HomePricing (Actualizado)
// ====================================================================

const HomePricing = () => {
  const { fixedPackages, customPackage, loading, error } = usePackages();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  // ✅ Obtener estado de autenticación y créditos del hook unificado
  const { user, isAuthenticated, initialized } = useCredits();
  const router = useRouter();

  async function handlePurchase(pkg: CreditPackage, customCredits?: number) {
    setPurchasing(pkg.id);

    // ✅ Verificación redundante por seguridad
    if (!isAuthenticated || !user) {
      setPurchasing(null);
      router.push("/auth/login");
      return;
    }

    try {
      const response = await fetch("/api/payments/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          package_id: pkg.id,
          credits_amount: customCredits,
          user_id: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al crear preferencia");
      }

      // Usar la lógica anterior que funcionaba: determinar en cliente basado en NEXT_PUBLIC_MERCADOPAGO_ENV
      const isDevEnv = process.env.NEXT_PUBLIC_MERCADOPAGO_ENV === "DEV";
      const checkoutUrl = isDevEnv
        ? data.sandbox_init_point // Usar Sandbox en DEV
        : data.init_point; // Usar Producción en PROD

      if (!checkoutUrl) {
        throw new Error("URL de pago no generada correctamente.");
      }

      router.push(checkoutUrl);
    } catch (error) {
      console.error("Error:", error);
      alert("Error al procesar el pago. Intenta nuevamente.");
      setPurchasing(null);
    }
  }

  // Función auxiliar para determinar texto del botón
  const getButtonText = (pkgId: string) => {
    if (!isAuthenticated) {
      return { text: "Iniciar Sesión y Comprar", icon: null };
    }
    if (purchasing === pkgId) {
      return {
        text: "Procesando...",
        icon: <Loader2 className="w-5 h-5 animate-spin" />,
      };
    }
    return { text: "Comprar Paquete", icon: null };
  };

  const [commonFeatures, setCommonFeatures] = useState<string[]>([]);

  useEffect(() => {
    setCommonFeatures(
      process.env.NEXT_PUBLIC_COMMON_FEATURES?.split(",").map((f) =>
        f.trim()
      ) || []
    );
  }, []);

  // ✅ 1. SOLUCIÓN AL ERROR DE HYDRATION - Mostrar loading solo mientras no esté inicializado
  if (!initialized) {
    return (
      <section id="pricing" className="py-24 bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-12 w-12 animate-spin text-gray-400" />
            <p className="ml-4 text-gray-500">Cargando sesión...</p>
          </div>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section id="pricing" className="py-24 bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-12 w-12 animate-spin text-gray-400" />
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section id="pricing" className="py-24 bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-red-600">
            Error al cargar paquetes. Por favor recarga la página.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="pricing" className="py-24 bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl text-gray-900 font-bold mb-4">
            Precios simples y claros
          </h2>
          <p className="text-gray-600 text-lg">
            Selecciona el plan que es adecuado para ti.
          </p>
          <p className="text-gray-600 text-lg">
            Los créditos nunca expiran, ¡crea siempre que quieras!
          </p>
          <p className="text-gray-600 text-lg">
            1 crédito es igual a 1 video personalizado.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {/* Paquetes Fijos */}
          {fixedPackages.map((pkg) => {
            const buttonContent = getButtonText(pkg.id);

            return (
              <Card
                key={pkg.id}
                className={`relative flex flex-col ${
                  pkg.is_popular ? "border-primary-500 shadow-lg border-2" : ""
                }`}
              >
                {pkg.is_popular && (
                  <div className="absolute top-0 right-0 -translate-y-1/2 px-3 py-1 bg-primary-500 text-white text-sm rounded-full">
                    Más popular
                  </div>
                )}

                <button
                  onClick={() => {
                    // ✅ Usar isAuthenticated para verificación inmediata
                    if (!isAuthenticated) {
                      router.push("/auth/login");
                    } else {
                      handlePurchase(pkg);
                    }
                  }}
                  disabled={purchasing === pkg.id}
                  className={`flex flex-col flex-grow focus:outline-none ${
                    pkg.is_popular
                      ? "hover:bg-primary-50/50 focus:bg-primary-50/50"
                      : "hover:bg-gray-50 focus:bg-gray-50"
                  } transition-colors rounded-lg`}
                  aria-label={`Comprar paquete ${pkg.name}`}
                >
                  <CardHeader>
                    <CardTitle>{pkg.name}</CardTitle>
                    <CardDescription>{pkg.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="flex flex-col flex-grow">
                    <div className="mb-6">
                      <span className="text-4xl font-bold">
                        ${pkg.price_mxn?.toFixed(2)}
                      </span>
                      <span className="text-gray-600 ml-2">MXN</span>
                      <div className="text-sm text-gray-500 mt-1">
                        {pkg.credits_amount}{" "}
                        {pkg.credits_amount === 1 ? "crédito" : "créditos"}
                      </div>
                    </div>

                    <ul className="space-y-3 mb-8 flex-grow">
                      {getFeaturesArray(pkg.features).map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <Check className="h-5 w-5 text-green-500" />
                          <span className="text-gray-600">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div
                      className={`w-full text-center px-6 py-3 font-medium flex items-center justify-center gap-2 ${
                        pkg.is_popular
                          ? "bg-primary-600 text-white"
                          : "bg-gray-50 text-gray-900"
                      } rounded-b-lg`}
                    >
                      {buttonContent.icon}
                      {buttonContent.text}
                    </div>
                  </CardContent>
                </button>
              </Card>
            );
          })}

          {/* Paquete Custom */}
          {customPackage && (
            <DynamicCreditCard
              package={customPackage}
              onPurchase={handlePurchase}
              currentUser={user}
              isGlobalLoading={false}
              isAuthenticated={isAuthenticated}
            />
          )}
        </div>

        {commonFeatures.length > 0 && (
          <div className="text-center">
            <p className="text-gray-600">
              Todos los planes incluyen: {commonFeatures.join(", ")}
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default HomePricing;
