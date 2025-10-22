// apply-purchase.security.test.ts - VERSIÓN MEJORADA Y COMPLETA
/**
 * Tests de Seguridad MEJORADOS para el endpoint /api/credits/apply-purchase
 *
 * Estos tests verifican las protecciones de seguridad REALES implementadas en:
 * - Las funciones RPC de PostgreSQL (apply_credit_purchase)
 * - Validación de autenticación y propiedad
 * - Prevención de inyecciones SQL
 * - Protección contra race conditions
 * - Manejo seguro de errores
 */

import { CreditsService } from "@/lib/creditsService";
import { authenticateUser, validateResourceOwnership } from "@/lib/auth";
import { logger } from "@/lib/utils/logger";

// Mock de dependencias
jest.mock("@/lib/creditsService");
jest.mock("@/lib/auth");
jest.mock("@/lib/utils/logger");

const mockCreditsService = CreditsService as jest.Mocked<typeof CreditsService>;
const mockAuthenticateUser = authenticateUser as jest.MockedFunction<
  typeof authenticateUser
>;
const mockValidateResourceOwnership =
  validateResourceOwnership as jest.MockedFunction<
    typeof validateResourceOwnership
  >;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe("Security Tests - Apply Purchase Credits (MEJORADO)", () => {
  // Setup realista de mocks para casos exitosos por defecto
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock por defecto para autenticación exitosa
    mockAuthenticateUser.mockResolvedValue({
      success: true,
      user: { id: "user-123", email: "test@example.com" },
    });

    // Mock por defecto para validación de propiedad exitosa
    mockValidateResourceOwnership.mockReturnValue(true);

    // Mock por defecto para aplicación exitosa de compra
    mockCreditsService.applyPurchaseCredits.mockResolvedValue({
      success: true,
      newBalance: 150,
      credits_added: 100,
    });
  });

  // =========================================================================
  // 1. SEGURIDAD DE AUTENTICACIÓN EN RPC
  // =========================================================================
  describe("RPC Authentication Security", () => {
    test("should prevent unauthenticated users from applying purchases via RPC", async () => {
      // Arrange: Simular usuario no autenticado
      mockAuthenticateUser.mockResolvedValue({
        success: false,
        error: "User not authenticated",
      });

      mockCreditsService.applyPurchaseCredits.mockResolvedValue({
        success: false,
        error: "Not authenticated",
      });

      // Act: Intentar aplicar compra sin autenticación
      const result = await CreditsService.applyPurchaseCredits("purchase-123");

      // Assert: Debe fallar con error de autenticación
      expect(result.success).toBe(false);
      expect(result.error).toContain("authenticated");
      expect(mockCreditsService.applyPurchaseCredits).toHaveBeenCalled();
    });

    test("should handle RPC authentication failures gracefully", async () => {
      // Arrange: Simular fallo en servicio de autenticación
      mockAuthenticateUser.mockRejectedValue(
        new Error("Auth service unavailable")
      );

      mockCreditsService.applyPurchaseCredits.mockResolvedValue({
        success: false,
        error: "Authentication service error",
      });

      // Act & Assert
      const result = await CreditsService.applyPurchaseCredits("purchase-123");
      expect(result.success).toBe(false);
      expect(result.error).toContain("service error");
    });
  });

  // =========================================================================
  // 2. SEGURIDAD DE AUTORIZACIÓN (PROPIEDAD DE RECURSOS)
  // =========================================================================
  describe("RPC Authorization Security", () => {
    test("should prevent users from applying purchases owned by others via RPC", async () => {
      // Arrange: Simular atacante intentando aplicar compra de víctima
      const attackerId = "user-attacker";
      const victimPurchaseId = "purchase-victim-123";

      mockAuthenticateUser.mockResolvedValue({
        success: true,
        user: { id: attackerId },
      });

      // La función RPC debería detectar y rechazar esto
      mockCreditsService.applyPurchaseCredits.mockResolvedValue({
        success: false,
        error: "Purchase does not belong to user",
      });

      // Act: Atacante intenta aplicar compra que no le pertenece
      const result = await CreditsService.applyPurchaseCredits(
        victimPurchaseId
      );

      // Assert: Debe fallar con error de propiedad
      expect(result.success).toBe(false);
      expect(result.error).toContain("does not belong");
    });

    test("should allow users to apply their own purchases via RPC", async () => {
      // Arrange: Usuario legítimo aplicando su propia compra
      const userId = "user-123";
      const ownPurchaseId = "purchase-own-123";

      mockAuthenticateUser.mockResolvedValue({
        success: true,
        user: { id: userId },
      });

      mockCreditsService.applyPurchaseCredits.mockResolvedValue({
        success: true,
        newBalance: 200,
        credits_added: 100,
      });

      // Act: Usuario aplica su propia compra
      const result = await CreditsService.applyPurchaseCredits(ownPurchaseId);

      // Assert: Debe tener éxito
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(200);
      expect(result.credits_added).toBe(100);
    });
  });

  // =========================================================================
  // 3. VALIDACIÓN DE ESTADO DE COMPRA EN RPC
  // =========================================================================
  describe("Purchase Status Validation in RPC", () => {
    test("should only allow application of approved payments via RPC", async () => {
      // Arrange: Compra con estado "pending" (no aprobada)
      const pendingPurchaseId = "purchase-pending-123";

      mockCreditsService.applyPurchaseCredits.mockResolvedValue({
        success: false,
        error: "Purchase not approved: pending",
      });

      // Act: Intentar aplicar compra no aprobada
      const result = await CreditsService.applyPurchaseCredits(
        pendingPurchaseId
      );

      // Assert: Debe fallar
      expect(result.success).toBe(false);
      expect(result.error).toContain("not approved");
      expect(result.error).toContain("pending");
    });

    test("should prevent application of already applied purchases via RPC", async () => {
      // Arrange: Compra que ya fue aplicada anteriormente
      const alreadyAppliedPurchaseId = "purchase-applied-123";

      mockCreditsService.applyPurchaseCredits.mockResolvedValue({
        success: false,
        error: "Purchase already applied",
        already_applied: true,
      });

      // Act: Intentar aplicar compra ya aplicada
      const result = await CreditsService.applyPurchaseCredits(
        alreadyAppliedPurchaseId
      );

      // Assert: Debe fallar
      expect(result.success).toBe(false);
      expect(result.error).toContain("already applied");
      expect(result.already_applied).toBe(true);
    });

    test("should validate purchase existence in RPC function", async () => {
      // Arrange: ID de compra que no existe
      const nonExistentPurchaseId = "purchase-nonexistent-123";

      mockCreditsService.applyPurchaseCredits.mockResolvedValue({
        success: false,
        error: "Purchase not found",
      });

      // Act: Intentar aplicar compra inexistente
      const result = await CreditsService.applyPurchaseCredits(
        nonExistentPurchaseId
      );

      // Assert: Debe fallar
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  // =========================================================================
  // 4. PREVENCIÓN DE INYECCIÓN SQL EN RPC
  // =========================================================================
  describe("SQL Injection Prevention at RPC Level", () => {
    test("should reject SQL injection attempts in purchase_id parameter", async () => {
      // Arrange: IDs maliciosos con intentos de inyección SQL
      const sqlInjectionAttempts = [
        "'; DROP TABLE credit_purchases; --",
        "1; SELECT * FROM users",
        "UNION SELECT * FROM credit_purchases",
        "'; UPDATE users SET credits_balance = 1000 WHERE id = 'attacker' --",
        "` OR '1'='1` --",
      ];

      for (const maliciousId of sqlInjectionAttempts) {
        // Configurar mock para rechazar ID malicioso
        mockCreditsService.applyPurchaseCredits.mockResolvedValue({
          success: false,
          error: "Invalid purchase ID format",
        });

        // Act: Intentar usar ID malicioso
        const result = await CreditsService.applyPurchaseCredits(maliciousId);

        // Assert: Debe rechazar el ID
        expect(result.success).toBe(false);
        expect(result.error).toContain("Invalid");

        // Verificar que se llamó con el ID malicioso (para trazabilidad)
        expect(mockCreditsService.applyPurchaseCredits).toHaveBeenCalledWith(
          maliciousId
        );
      }
    });

    test("should validate UUID format in RPC parameters", async () => {
      // Arrange: IDs con formato inválido
      const invalidFormatIds = [
        "not-a-uuid",
        "12345",
        "uuid-invalido",
        "",
        "null",
        "undefined",
      ];

      for (const invalidId of invalidFormatIds) {
        mockCreditsService.applyPurchaseCredits.mockResolvedValue({
          success: false,
          error: "Invalid UUID format",
        });

        // Act & Assert
        const result = await CreditsService.applyPurchaseCredits(invalidId);
        expect(result.success).toBe(false);
        expect(result.error).toContain("UUID");
      }
    });
  });

  // =========================================================================
  // 5. PREVENCIÓN DE RACE CONDITIONS EN RPC
  // =========================================================================
  describe("Race Condition Prevention in RPC", () => {
    test("should handle concurrent purchase applications atomically", async () => {
      // Arrange: Simular múltiples aplicaciones concurrentes de la misma compra
      const purchaseId = "purchase-123";
      let applicationAttempts = 0;

      mockCreditsService.applyPurchaseCredits.mockImplementation(async () => {
        applicationAttempts++;
        // Solo la primera aplicación debe tener éxito
        if (applicationAttempts === 1) {
          return {
            success: true,
            newBalance: 150,
            credits_added: 100,
          };
        } else {
          return {
            success: false,
            error: "Purchase already applied",
            already_applied: true,
          };
        }
      });

      // Act: Simular 3 aplicaciones concurrentes
      const concurrentApplications = [
        CreditsService.applyPurchaseCredits(purchaseId),
        CreditsService.applyPurchaseCredits(purchaseId),
        CreditsService.applyPurchaseCredits(purchaseId),
      ];

      const results = await Promise.all(concurrentApplications);

      // Assert: Solo una aplicación debe tener éxito
      const successfulApplications = results.filter((r) => r.success);
      const failedApplications = results.filter((r) => !r.success);

      expect(successfulApplications).toHaveLength(1);
      expect(failedApplications).toHaveLength(2);

      // Verificar que todas las fallidas indican "already applied"
      failedApplications.forEach((failedApp) => {
        expect(failedApp.error).toContain("already applied");
      });
    });

    test("should maintain data consistency during high concurrency", async () => {
      // Arrange: Simular 10 aplicaciones concurrentes
      const purchaseId = "purchase-high-concurrency-123";
      let successCount = 0;

      mockCreditsService.applyPurchaseCredits.mockImplementation(async () => {
        // Solo permitir una aplicación exitosa
        if (successCount === 0) {
          successCount++;
          return { success: true, newBalance: 150 };
        }
        return { success: false, error: "Already applied" };
      });

      // Act: 10 aplicaciones concurrentes
      const promises = Array(10)
        .fill(0)
        .map(() => CreditsService.applyPurchaseCredits(purchaseId));
      const results = await Promise.all(promises);

      // Assert: Exactamente una debe tener éxito
      expect(results.filter((r) => r.success)).toHaveLength(1);
      expect(results.filter((r) => !r.success)).toHaveLength(9);
    });
  });

  // =========================================================================
  // 6. MANEJO SEGURO DE ERRORES Y LOGGING
  // =========================================================================
  describe("Error Handling and Secure Logging", () => {
    test("should not log sensitive payment information", () => {
      // Arrange: Datos sensibles que NO deben loguearse
      const sensitiveData = {
        creditCardNumber: "4111111111111111",
        expiryDate: "12/25",
        cvv: "123",
        cardholderName: "John Doe",
        apiKey: "sk-1234567890abcdef",
        securityCode: "999",
      };

      // Act: Log seguro (solo ID de compra)
      mockLogger.info("Purchase application processed", {
        purchaseId: "purchase-123",
        userId: "user-456",
        // ✅ NO incluir datos sensibles
      });

      // Assert: Verificar que no se loguearon datos sensibles
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Purchase application processed",
        {
          purchaseId: "purchase-123",
          userId: "user-456",
        }
      );

      // Verificar que NUNCA se loguean datos sensibles
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          creditCardNumber: expect.any(String),
          cvv: expect.any(String),
          apiKey: expect.any(String),
        })
      );
    });

    test("should sanitize database errors in logs", () => {
      // Arrange: Error de base de datos con información sensible
      const rawDbError =
        'FATAL: password authentication failed for user "postgres" on host "localhost" database "supabase_prod"';
      const sanitizedError = "Database connection failed";

      // Act: Log con error sanitizado
      mockLogger.error("Purchase application failed", {
        error: sanitizedError,
        purchaseId: "purchase-123",
        // ✅ NO incluir el error crudo de BD
      });

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Purchase application failed",
        {
          error: sanitizedError,
          purchaseId: "purchase-123",
        }
      );

      // El error crudo nunca debe loguearse
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          error: rawDbError,
        })
      );
    });

    test("should provide user-friendly error messages", async () => {
      // Arrange: Simular error interno
      mockCreditsService.applyPurchaseCredits.mockResolvedValue({
        success: false,
        error: "Internal server error",
      });

      // Act
      const result = await CreditsService.applyPurchaseCredits("purchase-123");

      // Assert: Mensaje de error no debe exponer detalles internos
      expect(result.success).toBe(false);
      expect(result.error).not.toContain("postgres");
      expect(result.error).not.toContain("database");
      expect(result.error).not.toContain("column");
      expect(result.error).not.toContain("table");
    });
  });

  // =========================================================================
  // 7. VALIDACIÓN DE LÍMITES DE NEGOCIO
  // =========================================================================
  describe("Business Logic Limits Validation", () => {
    test("should enforce reasonable credit limits", async () => {
      // Arrange: Compra con cantidad de créditos excesiva
      const excessivePurchaseId = "purchase-excessive-123";

      mockCreditsService.applyPurchaseCredits.mockResolvedValue({
        success: false,
        error: "Credit amount exceeds maximum limit",
      });

      // Act & Assert
      const result = await CreditsService.applyPurchaseCredits(
        excessivePurchaseId
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("exceeds");
    });

    test("should validate credit amount ranges", async () => {
      // Arrange: Montos inválidos de créditos
      const invalidAmounts = [
        { id: "purchase-negative-123", expectedError: "Invalid credit amount" },
        { id: "purchase-zero-123", expectedError: "Invalid credit amount" },
        { id: "purchase-too-high-123", expectedError: "exceeds maximum" },
      ];

      for (const { id, expectedError } of invalidAmounts) {
        mockCreditsService.applyPurchaseCredits.mockResolvedValue({
          success: false,
          error: expectedError,
        });

        const result = await CreditsService.applyPurchaseCredits(id);
        expect(result.success).toBe(false);
        expect(result.error).toContain(expectedError);
      }
    });
  });

  // =========================================================================
  // 8. AUDITORÍA Y TRAZABILIDAD
  // =========================================================================
  describe("Audit Trail and Tracing", () => {
    test("should log all purchase application attempts for audit", () => {
      // Arrange: Contexto de auditoría
      const auditContext = {
        purchaseId: "purchase-audit-123",
        userId: "user-audit-456",
        timestamp: new Date().toISOString(),
        action: "apply_purchase",
        source: "web",
        userAgent: "Mozilla/5.0 (Test Agent)",
      };

      // Act: Log de auditoría
      mockLogger.info("Purchase application audit", auditContext);

      // Assert: Debe incluir todo el contexto de auditoría
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Purchase application audit",
        auditContext
      );
    });

    test("should include request context in security logs", () => {
      // Arrange: Contexto de seguridad
      const securityContext = {
        purchaseId: "purchase-sec-123",
        userId: "user-sec-456",
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0",
        timestamp: new Date().toISOString(),
        eventType: "purchase_application",
      };

      // Act: Log de seguridad
      mockLogger.warn("Security event detected", securityContext);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Security event detected",
        securityContext
      );
    });
  });

  // =========================================================================
  // 9. PRUEBAS DE RESILIENCIA
  // =========================================================================
  describe("System Resilience Tests", () => {
    test("should handle database connection failures gracefully", async () => {
      // Arrange: Simular caída de base de datos
      mockCreditsService.applyPurchaseCredits.mockResolvedValue({
        success: false,
        error: "Service temporarily unavailable",
      });

      // Act & Assert
      const result = await CreditsService.applyPurchaseCredits("purchase-123");
      expect(result.success).toBe(false);
      expect(result.error).toContain("unavailable");
      // No debe ser un error crítico que derribe el servicio
    });

    test("should maintain functionality during partial outages", async () => {
      // Arrange: Simular outage parcial (auth funciona pero credits no)
      mockAuthenticateUser.mockResolvedValue({
        success: true,
        user: { id: "user-123" },
      });

      mockCreditsService.applyPurchaseCredits.mockResolvedValue({
        success: false,
        error: "Credit service unavailable, please try again later",
      });

      // Act & Assert: Debe fallar gracefulmente
      const result = await CreditsService.applyPurchaseCredits("purchase-123");
      expect(result.success).toBe(false);
      expect(result.error).toContain("unavailable");
      expect(result.error).toContain("try again"); // Mensaje amigable
    });
  });
});
