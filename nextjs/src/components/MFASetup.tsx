// src/components/MFASetup.tsx

import React, { useState, useEffect } from "react";
import { createSPASassClient } from "@/lib/supabase/client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Key, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Factor } from "@supabase/auth-js";

interface MFASetupProps {
  onStatusChange?: () => void;
}

type MFAEnrollTOTPParams = {
  factorType: "totp";
  friendlyName?: string;
};

export function MFASetup({ onStatusChange }: MFASetupProps) {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [step, setStep] = useState<"list" | "name" | "enroll">("list");
  const [factorId, setFactorId] = useState("");
  const [qr, setQR] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [friendlyName, setFriendlyName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false);

  const fetchFactors = async () => {
    try {
      const supabase = await createSPASassClient();
      const { data, error } = await supabase
        .getSupabaseClient()
        .auth.mfa.listFactors();

      if (error) throw error;

      setFactors(data?.all ? data.all : []);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching MFA factors:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch MFA status"
      );
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFactors();
  }, []);

  const startEnrollment = async () => {
    if (!friendlyName.trim()) {
      setError("Please provide a name for this authentication method");
      return;
    }

    setError("");
    setActionInProgress(true);

    try {
      const supabase = await createSPASassClient();
      const enrollParams: MFAEnrollTOTPParams = {
        factorType: "totp",
        friendlyName: friendlyName.trim(),
      };

      const { data, error } = await supabase
        .getSupabaseClient()
        .auth.mfa.enroll(enrollParams);

      if (error) throw error;

      setFactorId(data.id);
      setQR(data.totp.qr_code);
      setStep("enroll");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start MFA enrollment"
      );
      setStep("name");
    } finally {
      setActionInProgress(false);
    }
  };

  const verifyFactor = async () => {
    setError("");
    setActionInProgress(true);

    try {
      const supabase = await createSPASassClient();
      const client = supabase.getSupabaseClient();

      const challenge = await client.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const verify = await client.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: verifyCode,
      });
      if (verify.error) throw verify.error;

      await fetchFactors();
      resetEnrollment();
      onStatusChange?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to verify MFA code"
      );
    } finally {
      setActionInProgress(false);
    }
  };

  const unenrollFactor = async (factorId: string) => {
    setError("");
    setActionInProgress(true);

    try {
      const supabase = await createSPASassClient();
      const { error } = await supabase
        .getSupabaseClient()
        .auth.mfa.unenroll({ factorId });

      if (error) throw error;

      await fetchFactors();
      onStatusChange?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to unenroll MFA factor"
      );
    } finally {
      setActionInProgress(false);
    }
  };

  const resetEnrollment = () => {
    setStep("list");
    setFactorId("");
    setQR("");
    setVerifyCode("");
    setFriendlyName("");
    setError("");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Two-Factor Authentication (2FA)
        </CardTitle>
        <CardDescription>
          Añade una capa adicional de seguridad a tu cuenta
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {factors.length > 0 && step === "list" && (
          <div className="space-y-4">
            {factors.map((factor) => (
              <div
                key={factor.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {factor.status === "verified" ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <div>
                    <p className="font-medium">
                      {factor.friendly_name || "Authenticator App"}
                    </p>
                    <p className="text-sm text-gray-500">
                      Añadido el{" "}
                      {new Date(factor.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => unenrollFactor(factor.id)}
                  disabled={actionInProgress}
                  className="px-3 py-1 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}

        {step === "name" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="friendly-name"
                className="block text-sm font-medium text-gray-700"
              >
                Nombre del Dispositivo
              </label>
              <input
                id="friendly-name"
                type="text"
                value={friendlyName}
                onChange={(e) => setFriendlyName(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                placeholder="e.g., Work Phone, Personal iPhone"
                autoFocus
              />
              <p className="text-sm text-gray-500">
                Dale a este método de autenticación un nombre para ayudarte a
                identificarlo más tarde
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={resetEnrollment}
                disabled={actionInProgress}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={startEnrollment}
                disabled={actionInProgress || !friendlyName.trim()}
                className="flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {actionInProgress ? "Processing..." : "Continue"}
              </button>
            </div>
          </div>
        )}

        {step === "enroll" && (
          <div className="space-y-4">
            <div className="flex justify-center">
              {qr && (
                <img
                  src={qr}
                  alt="QR Code"
                  className="w-48 h-48 border rounded-lg p-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="verify-code"
                className="block text-sm font-medium text-gray-700"
              >
                Código de Verificación
              </label>
              <input
                id="verify-code"
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.trim())}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                placeholder="Enter code from your authenticator app"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={resetEnrollment}
                disabled={actionInProgress}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={verifyFactor}
                disabled={actionInProgress || verifyCode.length === 0}
                className="flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {actionInProgress ? "Verifying..." : "Verify"}
              </button>
            </div>
          </div>
        )}

        {step === "list" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {factors.length === 0
                ? "Protege tu cuenta con la autenticación de dos factores. Cuando esté habilitada, deberás ingresar un código de tu aplicación de autenticación además de tu contraseña al iniciar sesión."
                : "Puedes añadir métodos de autenticación adicionales o eliminar los existentes."}
            </p>
            <button
              onClick={() => setStep("name")}
              disabled={actionInProgress}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {actionInProgress
                ? "Procesando..."
                : "Añadir Nuevo Método de Autenticación"}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
