// src/app/paquetes/success/page.tsx
import { Suspense } from "react";
import SuccessClient from "@/components/SuccessClient";
import { Loader2 } from "lucide-react";

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-900 flex items-center justify-center px-4">
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-pink-500 animate-spin mx-auto mb-4" />
            <p className="text-white text-lg">Cargando...</p>
          </div>
        </div>
      }
    >
      <SuccessClient />
    </Suspense>
  );
}
