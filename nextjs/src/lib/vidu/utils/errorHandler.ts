export class ErrorHandler {
  static handleError(error: unknown): { message: string; details?: string } {
    if (error instanceof Error) {
      console.error("Error:", error.message);
      console.error("Stack:", error.stack);
      return {
        message: "Error interno del servidor",
        details: error.message,
      };
    }

    console.error("Unknown error:", error);
    return {
      message: "Error interno del servidor",
      details: String(error),
    };
  }

  static logError(
    context: string,
    error: unknown,
    metadata?: Record<string, unknown>
  ): void {
    console.error(`=== ${context.toUpperCase()} ERROR ===`);
    console.error("Error:", error);
    if (metadata) {
      console.error("Metadata:", metadata);
    }
    if (error instanceof Error) {
      console.error("Stack:", error.stack);
    }
  }
}
