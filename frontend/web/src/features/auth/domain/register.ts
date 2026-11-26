// Invite-code registration: the code from the address bar, checks before submitting, building invite links.
import { t } from "@/platform/i18n/index.js";
import { MIN_PASSWORD_LENGTH, USERNAME_PATTERN } from "./auth-errors.js";

export const MAX_PASSWORD_LENGTH = 128;

/** Administrators send links like index.html?invite=ABCD-EFGH-JKMN; returns "" when absent. */
export function readInviteParam(search?: string): string {
  const query = search ?? (typeof globalThis.location !== "undefined" ? globalThis.location.search : "");
  try {
    return `${new URLSearchParams(query).get("invite") || ""}`.trim();
  } catch {
    return "";
  }
}

/** Invite link: the home page plus ?invite= (signed out, home is the sign-in screen, which then opens registration). */
export function buildInviteLink(code: string, origin?: string, pathname?: string): string {
  const base = origin ?? (typeof globalThis.location !== "undefined" ? globalThis.location.origin : "");
  const path = pathname ?? (typeof globalThis.location !== "undefined" ? globalThis.location.pathname : "/");
  const home = path.replace(/[^/]*$/, "index.html");
  return `${base}${home}?invite=${encodeURIComponent(code)}`;
}

/** Checks before submitting; "" when fine. The invite code is sent as typed: the backend ignores case, spaces and hyphens. */
export function registerProblem({
  inviteCode,
  username,
  password,
  confirm,
}: {
  inviteCode: string;
  username: string;
  password: string;
  confirm: string;
}): string {
  if (!inviteCode.trim()) return t("auth.validation.invite_required");
  if (!USERNAME_PATTERN.test(username.trim())) return t("auth.error.invalid_username");
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return t("auth.validation.password_length", { min: MIN_PASSWORD_LENGTH, max: MAX_PASSWORD_LENGTH });
  }
  if (password !== confirm) return t("auth.validation.password_mismatch");
  return "";
}
