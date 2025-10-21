// src/app/paquetes/failure/page.tsx
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import PaymentFailureClient from "./PaymentFailureClient";

export default function PaymentFailurePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-900 px-4">
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-red-500 animate-spin mx-auto mb-4" />
            <p className="text-white text-lg">Cargando...</p>
          </div>
        </div>
      }
    >
      <PaymentFailureClient />
    </Suspense>
  );
}
