// IP ranges oficiales de Mercado Pago (ejemplos - verificar documentación oficial)
const MP_IP_RANGES = [
  "179.32.192.0/19",
  "190.217.252.0/24",
  "190.217.253.0/24",
  "190.217.254.0/24",
];

export class IPValidator {
  static isValidMercadoPagoIP(ip: string): boolean {
    // En desarrollo, permitir todas las IPs
    if (process.env.NODE_ENV === "development") {
      return true;
    }

    // En producción, validar contra rangos oficiales
    const isValid = this.checkIPInRanges(ip, MP_IP_RANGES);

    if (!isValid) {
      console.warn(`🚨 Suspicious IP address: ${ip}`);
    }

    return isValid;
  }

  private static checkIPInRanges(ip: string, ranges: string[]): boolean {
    // Implementación básica - en producción usar librería como 'ip-range-check'
    console.log(`🔒 IP validation for: ${ip}`);

    // Por ahora retornar true pero loggear para monitoreo
    // Implementar lógica real de validación de IP ranges en producción
    return true;
  }
}
