/**
 * Map a thrown auth API error to an `auth.json` i18n key (without namespace
 * prefix — callers use `useTranslation("auth")`).
 *
 * The backend (`backend/app/routers/auth.py`) returns failures as
 * `{ detail: string }` HTTPExceptions; `api/client.ts` re-throws them as
 * `new Error(error.detail)`. Known details map to specific keys; anything
 * else falls back to a generic message so unknown backend strings never
 * leak to the user as raw English.
 */
const AUTH_ERROR_DETAIL_MAP: Record<string, string> = {
  "Invalid credentials": "errors.invalidCredentials",
  "Email already registered": "errors.emailAlreadyRegistered",
  "Username already taken": "errors.usernameAlreadyTaken",
};

export function resolveAuthError(error: unknown): string {
  const detail = error instanceof Error ? error.message : "";
  return AUTH_ERROR_DETAIL_MAP[detail] ?? "errors.unexpected";
}
