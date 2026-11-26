// UI text translation (docs/ops/planning/i18n/): catalogs are valid ICU, the generated module is current,
// language matching / fallback / pseudo-locale behave as designed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { IntlMessageFormat } from "intl-messageformat";
import { loadCatalogs, renderModule } from "../../scripts/generate-i18n-catalogs.mjs";

const generatedFile = fileURLToPath(new URL("../../src/platform/generated/i18n-catalogs.ts", import.meta.url));

test("generated i18n module matches locales/ (run npm run generate:i18n)", () => {
  assert.equal(fs.readFileSync(generatedFile, "utf8"), renderModule(loadCatalogs()));
});

test("every message in every language is valid ICU MessageFormat", () => {
  const { catalogs } = loadCatalogs();
  const broken = [];
  for (const [lng, messages] of Object.entries(catalogs)) {
    for (const [key, text] of Object.entries(messages)) {
      try {
        new IntlMessageFormat(text, lng);
      } catch (error) {
        broken.push(`${lng} ${key}: ${error.message}`);
      }
    }
  }
  assert.deepEqual(broken, []);
});

test("t(): source language by default in tests, fallback to en, then the key", async () => {
  const i18n = await import("../../src/platform/i18n/index.ts");
  await i18n.setLanguage("en");
  assert.equal(i18n.t("auth.field.password_hint", { min: 8, max: 128 }), "8–128 characters");
  assert.equal(i18n.t("auth.error.too_many_attempts_minutes", { minutes: 1 }), "Too many attempts. Please try again in 1 minute.");
  await i18n.setLanguage("de-AT");
  assert.equal(i18n.getLanguage(), "de");
  assert.equal(i18n.t("auth.error.too_many_attempts_minutes", { minutes: 2 }), "Zu viele Versuche. Bitte in 2 Minuten erneut versuchen.");
  await i18n.setLanguage("zh-Hans");
  assert.equal(i18n.getLanguage(), "zh-CN");
  assert.equal(i18n.t("auth.field.password_hint", { min: 8, max: 128 }), "8～128 位");
  await i18n.setLanguage("xx");
  assert.equal(i18n.t("auth.login.submit"), "[!! Sign in !!]");
  assert.equal(i18n.intlLocale(), "en", "pseudo-locale formats dates like the source language");
  await i18n.setLanguage("fr");
  assert.equal(i18n.getLanguage(), "en", "unsupported languages fall back to en");
  assert.equal(i18n.t("test.missing.key"), "test.missing.key");
});

test("matchLanguage(): BCP 47 tags map onto supported languages", async () => {
  const { matchLanguage } = await import("../../src/platform/i18n/index.ts");
  assert.equal(matchLanguage("en-US"), "en");
  assert.equal(matchLanguage("de_CH"), "de");
  assert.equal(matchLanguage("zh-TW"), "zh-CN");
  assert.equal(matchLanguage("ja"), null);
  assert.equal(matchLanguage(""), null);
});
