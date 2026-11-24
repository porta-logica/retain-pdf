// Change password: used on the account page and for the forced change on first sign-in. New passwords need at
// least 8 characters; on success all sessions on other devices are signed out.
import { useState, type FormEvent } from "react";
import { useT } from "@/platform/i18n/index.js";
import { changePassword } from "@retainpdf/api/auth";
import { authErrorText, MIN_PASSWORD_LENGTH, passwordProblem } from "../domain/auth-errors.js";

export function ChangePasswordForm({
  submit = changePassword,
  onDone,
  submitLabel,
  currentLabel,
}: {
  submit?: (current: string, next: string) => Promise<unknown>;
  onDone?: () => void;
  submitLabel?: string;
  currentLabel?: string;
}) {
  const t = useT();
  const submitText = submitLabel ?? t("auth.change_password.submit");
  const currentText = currentLabel ?? t("auth.change_password.current_password");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setDone(false);
    const problem = !current ? t("auth.change_password.missing_current", { label: currentText }) : passwordProblem(next, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await submit(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
      onDone?.();
    } catch (err) {
      setError(authErrorText(err, t("auth.change_password.failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} data-auth-form="change-password">
      <label className="auth-field">
        <span>{currentText}</span>
        <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <label className="auth-field">
        <span>{t("auth.change_password.new_password", { min: MIN_PASSWORD_LENGTH })}</span>
        <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </label>
      <label className="auth-field">
        <span>{t("auth.change_password.confirm_new_password")}</span>
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </label>
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {done ? <p className="auth-ok">{t("auth.change_password.done")}</p> : null}
      <button type="submit" className="auth-primary" disabled={busy}>{busy ? t("auth.change_password.submitting") : submitText}</button>
    </form>
  );
}
