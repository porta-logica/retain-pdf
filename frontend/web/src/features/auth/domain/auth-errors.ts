// Turns login / password / account-management errors into readable text (backend codes: AuthRequestError.code).
import { t } from "@/platform/i18n/index.js";

export const MIN_PASSWORD_LENGTH = 8;
export const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,32}$/;

const HAS_CJK = /[\u4e00-\u9fff]/;

export function authErrorText(error: unknown, fallback = t("auth.error.generic")): string {
  const e = (error || {}) as { status?: number; code?: string; message?: string; details?: Record<string, unknown> };
  const code = `${e.code || ""}`.toUpperCase();
  if (code === "INVALID_CREDENTIALS") return t("auth.error.invalid_credentials");
  if (code === "ACCOUNT_DISABLED") return t("auth.error.account_disabled");
  if (code === "TOO_MANY_ATTEMPTS") {
    const secs = Number(e.details?.retry_after_secs) || 0;
    return secs > 0
      ? t("auth.error.too_many_attempts_minutes", { minutes: Math.max(1, Math.ceil(secs / 60)) })
      : t("auth.error.too_many_attempts");
  }
  // Transitional (i18n decisions, Stage A): the backend explains account errors only as Chinese text
  // (cannot disable yourself / the last administrator, invite code used up, …) and sends no message key yet.
  // Its specific reason beats a generic message, so it is shown as-is until the backend sends
  // message_key + params; then this branch is replaced by t(message_key, params) and removed in Stage B.
  const backendText = e.message && HAS_CJK.test(e.message) ? e.message : "";
  if (backendText) return backendText;
  if (code === "USERNAME_TAKEN") return t("auth.error.username_taken");
  if (code === "WRONG_PASSWORD") return t("auth.error.wrong_password");
  if (code === "SAME_PASSWORD") return t("auth.error.same_password");
  if (code === "WEAK_PASSWORD") return t("auth.error.weak_password", { min: Number(e.details?.min_length) || MIN_PASSWORD_LENGTH });
  if (code === "INVALID_USERNAME") return t("auth.error.invalid_username");
  if (e.status === 403) return t("auth.error.forbidden");
  if (e instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(`${e.message || ""}`)) {
    return t("auth.error.network");
  }
  return fallback;
}

export function passwordProblem(next: string, confirm: string): string {
  if (next.length < MIN_PASSWORD_LENGTH) return t("auth.validation.new_password_too_short", { min: MIN_PASSWORD_LENGTH });
  if (next !== confirm) return t("auth.validation.new_password_mismatch");
  return "";
}
