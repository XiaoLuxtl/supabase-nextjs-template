import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/types";

// 🔑 Definición del tipo de cliente Supabase unificado (Server/Browser/Admin)
// Especifica la base de datos y el esquema 'public' por defecto.
export type GenericSupabaseClient = SupabaseClient<Database, 'public'>;

export enum ClientType {
    SPA = "SPA",
    SERVER = "SERVER",
    ADMIN = "ADMIN",
}

/**
 * Clase Wrapper para el cliente Supabase.
 * Centraliza las operaciones de base de datos y autenticación,
 * usando el tipo explícito GenericSupabaseClient.
 */
export class SassClient {
  private client: GenericSupabaseClient;
  private type: ClientType;

  constructor(client: GenericSupabaseClient, type: ClientType) {
    this.client = client;
    this.type = type;
  }

  /**
   * Método público para acceder al cliente Supabase subyacente.
   */
  public getSupabaseClient(): GenericSupabaseClient {
    return this.client;
  }

  // ----------------------
  // FUNCIONES DE AUTENTICACIÓN (MOVIDAS DESDE client.ts PARA UNIFICACIÓN)
  // ----------------------

  /**
   * Wrapper para iniciar sesión con email y contraseña.
   */
  public async loginEmail(email: string, password: string): Promise<{ error: Error | null }> {
      const { error } = await this.client.auth.signInWithPassword({
          email,
          password,
      });
      return { error: error ? new Error(error.message) : null };
  }

  /**
   * Wrapper para registrar un nuevo usuario con email y contraseña.
   */
  public async registerEmail(email: string, password: string): Promise<{ error: Error | null }> {
      const { error } = await this.client.auth.signUp({
          email,
          password,
      });
      return { error: error ? new Error(error.message) : null };
  }

  /**
   * Wrapper para reenviar el email de verificación.
   */
  public async resendVerificationEmail(email: string): Promise<{ error: Error | null }> {
      const { error } = await this.client.auth.resend({
          email,
          type: 'signup', // Se asume que es para verificar el registro inicial
      });
      return { error: error ? new Error(error.message) : null };
  }
  
  /**
   * Wrapper para solicitar el restablecimiento de contraseña (Forgot Password).
   */
  public async resetPasswordForEmail(email: string): Promise<{ error: Error | null }> {
      const { error } = await this.client.auth.resetPasswordForEmail(email);
      return { error: error ? new Error(error.message) : null };
  }

  /**
   * Wrapper para actualizar la contraseña.
   */
  public async updatePassword(newPassword: string): Promise<{ error: Error | null }> {
      const { error } = await this.client.auth.updateUser({
          password: newPassword,
      });
      return { error: error ? new Error(error.message) : null };
  }

  /**
   * Wrapper para el inicio de sesión con Magic Link.
   */
  public async signInWithMagicLink(email: string): Promise<{ error: Error | null }> {
      const { error } = await this.client.auth.signInWithOtp({ 
          email, 
          options: {
              emailRedirectTo: '/app', // Redirigir al usuario al dashboard después de hacer clic en el enlace
          }
      });
      return { error: error ? new Error(error.message) : null };
  }

  /**
   * Wrapper para cerrar sesión.
   */
  public async logout(): Promise<{ error: Error | null }> {
      const { error } = await this.client.auth.signOut();
      return { error: error ? new Error(error.message) : null };
  }
}
