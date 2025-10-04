"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Check, Plus, Minus, Loader2 } from "lucide-react";
import { usePackages } from "@/hooks/usePackages";
import { createSPAClient } from "@/lib/supabase/client";
import type { CreditPackage } from "@/types/database.types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

// Componente para el card dinámico de créditos
const DynamicCreditCard = ({
  package: pkg,
  onPurchase,
}: {
  package: CreditPackage;
  onPurchase: (pkg: CreditPackage, credits: number) => void;
}) => {
  const [credits, setCredits] = useState(pkg.min_credits || 15);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const totalPrice = credits * (pkg.price_per_credit || 30);

  const handleCreditsChange = (amount: number) => {
    setCredits((prevCredits) =>
      Math.max(pkg.min_credits || 15, prevCredits + amount)
    );
  };

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
          <span className="text-2xl font-bold">
            ${totalPrice.toFixed(2)} MXN
          </span>
          <span className="text-gray-600 ml-2">/ Total</span>
          <div className="text-sm text-gray-500 mt-1">
            ${pkg.price_per_credit} MXN por crédito
          </div>
        </div>

        <ul className="space-y-3 mb-8">
          {pkg.features &&
            Array.isArray(pkg.features) &&
            pkg.features.map((feature, i) => (
              <li key={i} className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                <span className="text-gray-600">{feature}</span>
              </li>
            ))}
        </ul>

        <Link
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setIsPurchasing(true);
            onPurchase(pkg, credits);
          }}
          className="w-full text-center px-6 py-3 rounded-lg font-medium transition-colors bg-gray-50 hover:bg-gray-100 text-gray-900 flex items-center justify-center gap-2"
        >
          {isPurchasing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Procesando...
            </>
          ) : (
            `Comprar ${credits} Créditos`
          )}
        </Link>
      </CardContent>
    </Card>
  );
};

const HomePricing = () => {
  const { fixedPackages, customPackage, loading, error } = usePackages();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const supabase = createSPAClient();

  async function handlePurchase(pkg: CreditPackage, customCredits?: number) {
    setPurchasing(pkg.id);

    try {
      // Verificar autenticación
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Debes iniciar sesión para comprar");
        window.location.href = "/auth/login";
        return;
      }

      // Crear preferencia de pago
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

      // Redirigir a Mercado Pago (sandbox en TEST)
      const checkoutUrl = data.sandbox_init_point || data.init_point;
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error("Error:", error);
      alert("Error al procesar el pago. Intenta nuevamente.");
      setPurchasing(null);
    }
  }

  // Features comunes (los únicos que quedan en env por ahora)
  const commonFeatures =
    process.env.NEXT_PUBLIC_COMMON_FEATURES?.split(",").map((f) => f.trim()) ||
    [];

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
          {fixedPackages.map((pkg) => (
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

              <CardHeader>
                <CardTitle>{pkg.name}</CardTitle>
                <CardDescription>{pkg.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-grow flex flex-col">
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
                  {pkg.features &&
                    Array.isArray(pkg.features) &&
                    pkg.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="h-5 w-5 text-green-500" />
                        <span className="text-gray-600">{feature}</span>
                      </li>
                    ))}
                </ul>

                <button
                  onClick={() => handlePurchase(pkg)}
                  disabled={purchasing === pkg.id}
                  className={`w-full text-center px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                    pkg.is_popular
                      ? "bg-primary-600 text-white hover:bg-primary-700"
                      : "bg-gray-50 text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  {purchasing === pkg.id ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    "Comprar"
                  )}
                </button>
              </CardContent>
            </Card>
          ))}

          {/* Paquete Custom */}
          {customPackage && (
            <DynamicCreditCard
              package={customPackage}
              onPurchase={handlePurchase}
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
