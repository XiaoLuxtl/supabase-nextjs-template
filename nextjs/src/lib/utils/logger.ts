// src/lib/utils/logger.ts

/**
 * Deshabilita TODOS los console methods en producción
 * para máxima seguridad y privacidad - no se muestra NADA en producción.
 */
if (process.env.NODE_ENV === "production") {
  // Deshabilita completamente todos los métodos de console en producción
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  // console.error = () => {};
  console.debug = () => {};
  console.trace = () => {};
  console.table = () => {};
}
