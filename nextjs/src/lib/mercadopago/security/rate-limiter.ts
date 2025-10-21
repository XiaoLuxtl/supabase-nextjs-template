import { SecurityConfig } from "../types";

const SECURITY_CONFIG: SecurityConfig = {
  maxRequestsPerMinute: 60,
  maxWebhookSize: 1024 * 10, // 10KB
  requestTimeout: 10000,
  mpApiTimeout: 8000,
  dbTimeout: 5000,
} as const;

// Simple in-memory rate limiter (en producción usar Redis)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export class RateLimiter {
  static isRateLimited(ip: string): boolean {
    const now = Date.now();
    const windowMs = 60000; // 1 minute

    const clientData = requestCounts.get(ip) || {
      count: 0,
      resetTime: now + windowMs,
    };

    // Reset counter if window passed
    if (now > clientData.resetTime) {
      clientData.count = 0;
      clientData.resetTime = now + 60000;
    }

    clientData.count++;
    requestCounts.set(ip, clientData);

    const isLimited = clientData.count > SECURITY_CONFIG.maxRequestsPerMinute;

    if (isLimited) {
      console.warn(`🚨 Rate limit exceeded for IP: ${ip}`);
    }

    return isLimited;
  }

  static getConfig(): SecurityConfig {
    return SECURITY_CONFIG;
  }
}
