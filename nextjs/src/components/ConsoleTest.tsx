"use client";

import React, { useEffect } from "react";
import { logger } from "@/lib/utils/logger";

export default function ConsoleTest() {
  useEffect(() => {
    console.log("🧪 TEST: console.log desde componente React");
    console.info("🧪 TEST: console.info desde componente React");
    console.warn("🧪 TEST: console.warn desde componente React");
    console.error("🧪 TEST: console.error desde componente React");

    // También probar el logger personalizado
    logger.info("✅ Logger personalizado funcionando", { test: true });
    logger.warn("✅ Logger warn funcionando", { test: true });
    logger.error("✅ Logger error funcionando", { test: true });
  }, []);

  return (
    <div className="p-4 bg-yellow-100 border border-yellow-300 rounded">
      <h3 className="font-bold text-yellow-800">Console Test Component</h3>
      <p className="text-sm text-yellow-700">
        Revisa la consola del navegador. En producción NO deberías ver los
        mensajes de console.*, pero SÍ deberías ver los del logger
        personalizado.
      </p>
    </div>
  );
}
