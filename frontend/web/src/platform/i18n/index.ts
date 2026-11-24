// UI text translation for the web app (design: docs/ops/planning/i18n/).
//
// - Messages live in <repo>/locales/<language>/*.json; scripts/generate-i18n-catalogs.mjs compiles
//   them into ../generated/i18n-catalogs.ts (run `npm run generate:i18n` after editing a catalog).
// - Keys are global and flat ("auth.login.submit"); the JSON file a key lives in is only for
//   organisation, so there is a single i18next namespace and "." / ":" are not separators.
// - Messages use ICU MessageFormat: "{name}" placeholders, "{n, plural, one {…} other {…}}".
// - Missing translations fall back to the source language (en), then to the key itself.
//
// Initialisation is synchronous on import (catalogs are bundled), so plain modules can call t()
// at any time; React components use useT() so they re-render when the language changes.
import i18next from "i18next";
import ICU from "i18next-icu";
import { initReactI18next, useTranslation } from "react-i18next";
import {
  LANGUAGES,
  PSEUDO_LANGUAGE,
  RESOURCES,
  SOURCE_LANGUAGE,
  type I18nKey,
} from "../generated/i18n-catalogs.js";

export { LANGUAGES, SOURCE_LANGUAGE, type I18nKey, type LanguageCode } from "../generated/i18n-catalogs.js";

export type MessageParams = Record<string, string | number>;

const STORAGE_KEY = "retainpdf.language";
const QUERY_PARAM = "lang";

const known: readonly string[] = [...LANGUAGES.map((l) => l.code), ...(PSEUDO_LANGUAGE ? [PSEUDO_LANGUAGE] : [])];

/** Map a BCP 47 tag ("de-AT", "zh-Hans-CN", "en_US") onto a supported language, or null. */
export function matchLanguage(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const normalized = `${tag}`.trim().replace(/_/g, "-");
  if (!normalized) return null;
  for (const code of known) {
    if (code.toLowerCase() === normalized.toLowerCase()) return code;
  }
  const base = normalized.split("-")[0].toLowerCase();
  if (base === "zh") return "zh-CN";
  for (const code of known) {
    if (code.split("-")[0].toLowerCase() === base) return code;
  }
  return null;
}

function readStored(): string | null {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function readQuery(): string | null {
  try {
    const search = globalThis.location?.search;
    return search ? new URLSearchParams(search).get(QUERY_PARAM) : null;
  } catch {
    return null;
  }
}

/** ?lang= in the address bar, then the saved choice, then the browser languages, then en. */
export function resolveInitialLanguage(): string {
  const fromQuery = matchLanguage(readQuery());
  if (fromQuery) return fromQuery;
  const fromStorage = matchLanguage(readStored());
  if (fromStorage) return fromStorage;
  const nav = globalThis.navigator as Navigator | undefined;
  for (const tag of nav?.languages ?? (nav?.language ? [nav.language] : [])) {
    const match = matchLanguage(tag);
    if (match) return match;
  }
  return SOURCE_LANGUAGE;
}

function applyDocumentLanguage(lng: string) {
  const root = globalThis.document?.documentElement;
  if (root) root.lang = lng === PSEUDO_LANGUAGE ? SOURCE_LANGUAGE : lng;
}

export const i18n = i18next.createInstance();

void i18n
  .use(ICU)
  .use(initReactI18next)
  .init({
    initAsync: false,
    resources: Object.fromEntries(
      Object.entries(RESOURCES).map(([lng, messages]) => [lng, { translation: messages }]),
    ),
    lng: resolveInitialLanguage(),
    fallbackLng: SOURCE_LANGUAGE,
    supportedLngs: [...known],
    keySeparator: false,
    nsSeparator: false,
    returnNull: false,
    interpolation: { escapeValue: false }, // React escapes; plain-text callers never build HTML.
    react: { useSuspense: false },
    showSupportNotice: false,
  } as Parameters<typeof i18n.init>[0]);

applyDocumentLanguage(i18n.language);

export function getLanguage(): string {
  return i18n.language;
}

/** Switch the UI language and remember the choice in this browser. */
export async function setLanguage(tag: string): Promise<string> {
  const lng = matchLanguage(tag) ?? SOURCE_LANGUAGE;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, lng);
  } catch {
    // Private mode etc.: the choice just isn't remembered.
  }
  await i18n.changeLanguage(lng);
  applyDocumentLanguage(lng);
  return lng;
}

/** Translate outside React (domain modules, error mappers). */
export function t(key: I18nKey, params?: MessageParams): string {
  return i18n.t(key, params as Record<string, unknown>) as string;
}

/** Locale for Intl formatters (the pseudo-locale formats like the source language). */
export function intlLocale(): string {
  const lng = i18n.language || SOURCE_LANGUAGE;
  return lng === PSEUDO_LANGUAGE ? SOURCE_LANGUAGE : lng;
}

/** React hook: typed t() that re-renders the component when the language changes. */
export function useT(): (key: I18nKey, params?: MessageParams) => string {
  const { t: translate } = useTranslation(undefined, { i18n });
  return (key, params) => translate(key, params as Record<string, unknown>) as string;
}
