import { currencySymbol, formatMoney, formatRate } from '@/core/money';
import { parseDateString } from '@/core/time';

export type TimeFormatSetting = 'auto' | '24h' | '12h';

/** Locale aware formatting helpers bound to a locale and the user's time format preference. */
export function createFormatter(locale: string, timeFormat: TimeFormatSetting) {
  const hourCycle = timeFormat === '24h' ? 'h23' : timeFormat === '12h' ? 'h12' : undefined;
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle });
  const dateLong = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const dateMedium = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const dateShort = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  const dateFull = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const monthYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const monthShort = new Intl.DateTimeFormat(locale, { month: 'short' });
  const weekdayShort = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const weekdayNarrow = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });

  /** Local noon avoids any DST edge when formatting a civil date. */
  const civil = (date: string) => {
    const { y, m, d } = parseDateString(date);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  };
  /** 2024-01-01 was a Monday, so index 0 = Monday. */
  const weekdayDate = (index: number) => new Date(2024, 0, 1 + index, 12);
  const decimalSep = (() => {
    try {
      return new Intl.NumberFormat(locale).formatToParts(1.1).find((p) => p.type === 'decimal')?.value ?? '.';
    } catch {
      return '.';
    }
  })();
  const cap = (s: string) => (s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  return {
    locale,
    time: (ms: number) => timeFmt.format(ms),
    /** e.g. "Tuesday 10 March" */
    dateLong: (ms: number) => cap(dateLong.format(ms)),
    dateLongCivil: (date: string) => cap(dateLong.format(civil(date))),
    /** e.g. "Tue 10 Mar" */
    dateMedium: (ms: number) => dateMedium.format(ms),
    dateMediumCivil: (date: string) => dateMedium.format(civil(date)),
    dateShortCivil: (date: string) => dateShort.format(civil(date)),
    dateFullCivil: (date: string) => dateFull.format(civil(date)),
    monthYearCivil: (date: string) => cap(monthYear.format(civil(date))),
    monthShortCivil: (date: string) => cap(monthShort.format(civil(date))),
    weekdayShort: (index: number) => cap(weekdayShort.format(weekdayDate(index))),
    weekdayNarrow: (index: number) => weekdayNarrow.format(weekdayDate(index)).toUpperCase(),
    money: (cents: number, currency: string, options?: { hideCents?: boolean; signDisplay?: 'auto' | 'always' | 'exceptZero' }) =>
      formatMoney(cents, currency, locale, options),
    rate: (units: number, currency: string) => formatRate(units, currency, locale),
    /** Short money for chart axes and calendar cells: "€45", "€1.2k". */
    compactMoney: (cents: number, currency: string) => {
      const amount = Math.abs(cents) / 100;
      const trim = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
      const body = amount >= 1000 ? `${trim(Math.round(amount / 100) / 10)}k` : amount >= 10 ? String(Math.round(amount)) : trim(Math.round(amount * 10) / 10);
      return `${cents < 0 ? '-' : ''}${currencySymbol(currency, locale)}${body.replace('.', decimalSep)}`;
    },
    /** Decimal separator of the locale, used to pre-fill number inputs. */
    decimalSeparator: decimalSep,
  };
}

export type Formatter = ReturnType<typeof createFormatter>;
