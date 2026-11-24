// Multi-user sign-in screen: sign in, or self-register with an invite code from an administrator (no password
// recovery: an administrator resets forgotten passwords). With ?invite=… in the address the registration form
// opens pre-filled. Accounts signing in for the first time or after a reset must change their password next.
import { useState, type FormEvent } from "react";
import { changePassword, login, logout, register as registerApi } from "@retainpdf/api/auth";
import { authErrorText, MIN_PASSWORD_LENGTH } from "../domain/auth-errors.js";
import { MAX_PASSWORD_LENGTH, readInviteParam, registerProblem } from "../domain/register.js";
import { useT } from "@/platform/i18n/index.js";
import { ChangePasswordForm } from "./ChangePasswordForm.jsx";

const reload = () => globalThis.location?.reload();
// After registering the user is already signed in: go home, dropping the invite code from the address.
const goHome = () => globalThis.location?.replace("./index.html");

export function LoginScreen({
  submit = login,
  onSuccess = reload,
  register = registerApi,
  onRegistered = goHome,
  initialInvite = readInviteParam(),
}: {
  submit?: (username: string, password: string) => Promise<unknown>;
  onSuccess?: () => void;
  register?: (inviteCode: string, username: string, password: string) => Promise<unknown>;
  onRegistered?: () => void;
  initialInvite?: string;
}) {
  const [mode, setMode] = useState<"login" | "register">(initialInvite ? "register" : "login");
  return mode === "register" ? (
    <RegisterCard initialInvite={initialInvite} register={register} onRegistered={onRegistered} onLogin={() => setMode("login")} />
  ) : (
    <LoginCard submit={submit} onSuccess={onSuccess} onRegister={() => setMode("register")} />
  );
}

function LoginCard({
  submit,
  onSuccess,
  onRegister,
}: {
  submit: (username: string, password: string) => Promise<unknown>;
  onSuccess: () => void;
  onRegister: () => void;
}) {
  const t = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError(t("auth.login.missing_fields"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await submit(username.trim(), password);
      onSuccess();
    } catch (err) {
      setError(authErrorText(err, t("auth.login.failed")));
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen" data-auth-screen="login">
      <section className="auth-card" aria-label={t("auth.login.aria")}>
        <h1>RetainPDF</h1>
        <p className="auth-sub">{t("auth.login.subtitle")}</p>
        <form className="auth-form" onSubmit={onSubmit} data-auth-form="login">
          <label className="auth-field">
            <span>{t("auth.field.username")}</span>
            <input autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="auth-field">
            <span>{t("auth.field.password")}</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          <button type="submit" className="auth-primary" disabled={busy}>{busy ? t("auth.login.submitting") : t("auth.login.submit")}</button>
        </form>
        <p className="auth-foot">
          {t("auth.login.have_invite")}<button type="button" className="auth-link auth-inline-link" data-auth-action="to-register" onClick={onRegister}>{t("auth.login.to_register")}</button>
        </p>
        <p className="auth-foot">{t("auth.login.forgot_password")}</p>
      </section>
    </main>
  );
}

function RegisterCard({
  initialInvite,
  register,
  onRegistered,
  onLogin,
}: {
  initialInvite: string;
  register: (inviteCode: string, username: string, password: string) => Promise<unknown>;
  onRegistered: () => void;
  onLogin: () => void;
}) {
  const t = useT();
  const [inviteCode, setInviteCode] = useState(initialInvite);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = registerProblem({ inviteCode, username, password, confirm });
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await register(inviteCode.trim(), username.trim(), password);
      onRegistered();
    } catch (err) {
      // The backend explains why (invite code wrong / revoked / expired / used up, username taken, …);
      // a failed registration does not use up the invite code.
      setError(authErrorText(err, t("auth.register.failed")));
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen" data-auth-screen="register">
      <section className="auth-card" aria-label={t("auth.register.title")}>
        <h1>{t("auth.register.title")}</h1>
        <p className="auth-sub">{t("auth.register.subtitle")}</p>
        <form className="auth-form" onSubmit={onSubmit} data-auth-form="register">
          <label className="auth-field">
            <span>{t("auth.field.invite_code")}</span>
            <input
              autoComplete="off"
              spellCheck={false}
              autoFocus={!initialInvite}
              placeholder="ABCD-EFGH-JKMN"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
          </label>
          <label className="auth-field">
            <span>{t("auth.field.username")}</span>
            <input autoComplete="username" autoFocus={Boolean(initialInvite)} value={username} onChange={(e) => setUsername(e.target.value)} />
            <small>{t("auth.field.username_hint")}</small>
          </label>
          <label className="auth-field">
            <span>{t("auth.field.password")}</span>
            <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <small>{t("auth.field.password_hint", { min: MIN_PASSWORD_LENGTH, max: MAX_PASSWORD_LENGTH })}</small>
          </label>
          <label className="auth-field">
            <span>{t("auth.field.confirm_password")}</span>
            <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          <button type="submit" className="auth-primary" disabled={busy}>{busy ? t("auth.register.submitting") : t("auth.register.submit")}</button>
        </form>
        <p className="auth-foot">
          {t("auth.register.have_account")}<button type="button" className="auth-link auth-inline-link" data-auth-action="to-login" onClick={onLogin}>{t("auth.register.to_login")}</button>
        </p>
      </section>
    </main>
  );
}

export function ForcedPasswordScreen({
  username = "",
  submit = changePassword,
  onDone = reload,
  onLogout = () => { void logout().finally(reload); },
}: {
  username?: string;
  submit?: (current: string, next: string) => Promise<unknown>;
  onDone?: () => void;
  onLogout?: () => void;
}) {
  const t = useT();
  return (
    <main className="auth-screen" data-auth-screen="change-password">
      <section className="auth-card" aria-label={t("auth.forced_password.title")}>
        <h1>{t("auth.forced_password.title")}</h1>
        <p className="auth-sub">{username ? t("auth.forced_password.subtitle_named", { username }) : t("auth.forced_password.subtitle")}</p>
        <ChangePasswordForm submit={submit} onDone={onDone} submitLabel={t("auth.forced_password.submit")} currentLabel={t("auth.forced_password.initial_password")} />
        <button type="button" className="auth-link" onClick={onLogout}>{t("auth.forced_password.switch_account")}</button>
      </section>
    </main>
  );
}

export function AuthErrorScreen({ message }: { message: string }) {
  const t = useT();
  return (
    <main className="auth-screen" data-auth-screen="error">
      <section className="auth-card" aria-label={t("auth.error_screen.aria")}>
        <h1>RetainPDF</h1>
        <p className="auth-error" role="alert">{message}</p>
        <button type="button" className="auth-primary" onClick={reload}>{t("auth.error_screen.retry")}</button>
      </section>
    </main>
  );
}
