// src/lib/utils/logger.ts

/**
 * Deshabilita console.log y console.info en producción 
 * para reducir el tamaño del bundle y la exposición de logs.
 */
if (process.env.NODE_ENV === 'production') {
  // Sobrescribe la función log con una función vacía.
  console.log = () => {};
  
  // Opcional: También desactiva otras funciones comunes.
  console.info = () => {};
  console.warn = () => {};
  
  // Nota: Generalmente se recomienda dejar console.error para debugging en producción.
}