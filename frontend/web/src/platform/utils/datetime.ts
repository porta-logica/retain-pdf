// The one place that turns dates into text. Formats follow the current UI language (see @/platform/i18n);
// do not create Intl.DateTimeFormat / call toLocale*String with a hardcoded locale elsewhere.
import { intlLocale } from "@/platform/i18n/index.js";

const DATE: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" };
const DATE_COMPACT: Intl.DateTimeFormatOptions = { year: "numeric", month: "numeric", day: "numeric" };
const DATE_TIME: Intl.DateTimeFormatOptions = { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" };

// Formatters are created per call because they depend on the current language (which can change at runtime).
function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(intlLocale(), options);
}

/** 2026-11-24 style date: zh-CN 2026/11/24, en 11/24/2026, de 24.11.2026. */
export function formatDate(value: Date | number): string {
  return formatter(DATE).format(value);
}

/** Date without zero padding: zh-CN 2026/1/5, en 1/5/2026, de 5.1.2026. */
export function formatDateCompact(value: Date | number): string {
  return formatter(DATE_COMPACT).format(value);
}

/** Month, day and time: zh-CN 11/24 14:05, en 11/24, 02:05 PM, de 24.11., 14:05. */
export function formatDateTime(value: Date | number): string {
  return formatter(DATE_TIME).format(value);
}
