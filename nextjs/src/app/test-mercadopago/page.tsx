"use client";

import { useState } from "react";

export default function TestMercadoPagoPage() {
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const testMercadoPago = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/payments/test-mercadopago");
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: "Failed to test Mercado Pago", details: error });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">
          Test Mercado Pago Configuration
        </h1>

        <div className="bg-white rounded-lg shadow p-6">
          <button
            onClick={testMercadoPago}
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "Testing..." : "Test Mercado Pago Configuration"}
          </button>

          {result && (
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-4">Result:</h2>
              <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
