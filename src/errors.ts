const KEY_REDACT = [/(?:sk|key|token)[-_a-z0-9]{8,}/gi, /Bearer\s+[A-Za-z0-9._-]+/gi];

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "configuration_error"
      | "provider_error"
      | "fetch_error"
      | "validation_error"
      | "security_error",
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function redactSecrets(text: string): string {
  let out = text;
  for (const re of KEY_REDACT) {
    out = out.replace(re, "[REDACTED]");
  }
  return out;
}

export function asUserSafeError(error: unknown): string {
  if (error instanceof AppError) {
    return redactSecrets(error.message);
  }
  if (error instanceof Error) {
    return redactSecrets(error.message);
  }
  return "Unknown error";
}
