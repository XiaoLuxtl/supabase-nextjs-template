"use client";

import { toast } from "sonner";

export type NotificationType = "success" | "error" | "warning" | "info";

export interface NotificationOptions {
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

class NotificationManager {
  private static instance: NotificationManager;

  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  // Notificaciones de éxito
  success(message: string, options?: NotificationOptions) {
    return toast.success(message, {
      description: options?.description,
      duration: options?.duration ?? 4000,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
    });
  }

  // Notificaciones de error
  error(message: string, options?: NotificationOptions) {
    return toast.error(message, {
      description: options?.description,
      duration: options?.duration ?? 6000,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
    });
  }

  // Notificaciones de advertencia
  warning(message: string, options?: NotificationOptions) {
    return toast.warning(message, {
      description: options?.description,
      duration: options?.duration ?? 5000,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
    });
  }

  // Notificaciones informativas
  info(message: string, options?: NotificationOptions) {
    return toast.info(message, {
      description: options?.description,
      duration: options?.duration ?? 4000,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
    });
  }

  // Notificación genérica
  notify(
    type: NotificationType,
    message: string,
    options?: NotificationOptions
  ) {
    switch (type) {
      case "success":
        return this.success(message, options);
      case "error":
        return this.error(message, options);
      case "warning":
        return this.warning(message, options);
      case "info":
        return this.info(message, options);
      default:
        return this.info(message, options);
    }
  }

  // Limpiar todas las notificaciones
  clear() {
    toast.dismiss();
  }

  // Notificaciones específicas para la aplicación
  videoGenerationSuccess(videoId: string) {
    this.success("¡Video generado exitosamente!", {
      description: `Tu video ${videoId} está listo para descargar`,
      action: {
        label: "Ver video",
        onClick: () => {
          // TODO: Implementar navegación al video
          console.log("Navigate to video:", videoId);
        },
      },
    });
  }

  videoGenerationError(error: string) {
    this.error("Error al generar video", {
      description: error,
      duration: 8000,
    });
  }

  nsfwContentDetected() {
    this.error("Contenido inapropiado detectado", {
      description:
        "La imagen contiene contenido no permitido. Por favor, usa una imagen diferente. Tus créditos han sido reembolsados automáticamente.",
      duration: 10000,
    });
  }

  creditsPurchased(amount: number) {
    this.success(`¡${amount} créditos comprados!`, {
      description: "Los créditos han sido agregados a tu cuenta",
    });
  }

  creditsConsumed(amount: number) {
    this.info(
      `${amount} crédito${amount > 1 ? "s" : ""} utilizado${
        amount > 1 ? "s" : ""
      }`,
      {
        description: "Se ha consumido crédito por la generación del video",
      }
    );
  }

  creditsRefunded(amount: number) {
    this.success(
      `¡${amount} crédito${amount > 1 ? "s" : ""} reembolsado${
        amount > 1 ? "s" : ""
      }!`,
      {
        description: "Los créditos han sido devueltos a tu cuenta",
      }
    );
  }

  loginSuccess() {
    this.success("¡Bienvenido!", {
      description: "Has iniciado sesión correctamente",
    });
  }

  loginError() {
    this.error("Error de autenticación", {
      description: "Verifica tus credenciales e intenta nuevamente",
    });
  }

  networkError() {
    this.error("Error de conexión", {
      description: "Verifica tu conexión a internet e intenta nuevamente",
    });
  }

  serverError() {
    this.error("Error del servidor", {
      description:
        "Estamos teniendo problemas técnicos. Intenta nuevamente en unos minutos",
      duration: 10000,
    });
  }
}

// Instancia global
export const notifications = NotificationManager.getInstance();

// Hook para usar notificaciones en componentes
export function useNotifications() {
  return notifications;
}

// Exportar tipos
export type { NotificationManager };
