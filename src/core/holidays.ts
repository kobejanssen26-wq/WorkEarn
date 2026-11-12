/**
 * Built-in public holiday calendars. Dates are computed algorithmically so no
 * network access or bundled data files are required. Every calendar lists the
 * nationwide legal / public holidays only; regional and company specific days
 * can be added as custom holidays by the user.
 */

import { addDaysToDateString, formatDateString, weekdayOfDateString } from './time';

export type HolidayRegion = 'NONE' | 'BE' | 'NL' | 'FR' | 'DE' | 'LU';
export const HOLIDAY_REGIONS: readonly HolidayRegion[] = ['BE', 'NL', 'FR', 'DE', 'LU', 'NONE'];

export interface BuiltInHoliday {
  /** 'YYYY-MM-DD' */
  date: string;
  /** Stable identifier, translated in the UI (see i18n `holiday.*`). */
  key: string;
}

/** English names stored with built-in holidays; the UI shows translations by `key` (see i18n `holiday.*`). */
export const HOLIDAY_NAMES_EN: Record<string, string> = {
  new_year: "New Year's Day",
  easter_sunday: 'Easter Sunday',
  easter_monday: 'Easter Monday',
  good_friday: 'Good Friday',
  labour_day: 'Labour Day',
  ascension: 'Ascension Day',
  whit_sunday: 'Whit Sunday',
  whit_monday: 'Whit Monday',
  national_day_be: 'Belgian National Day',
  assumption: 'Assumption Day',
  all_saints: "All Saints' Day",
  armistice: 'Armistice Day',
  christmas: 'Christmas Day',
  second_christmas: 'Second Christmas Day',
  kings_day: "King's Day",
  liberation_day: 'Liberation Day',
  victory_1945: 'Victory in Europe Day',
  bastille_day: 'Bastille Day',
  german_unity: 'German Unity Day',
  europe_day: 'Europe Day',
  national_day_lu: 'Luxembourg National Day',
};

/** Western (Gregorian) Easter Sunday as 'YYYY-MM-DD' (Meeus/Jones/Butcher algorithm). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return formatDateString(year, month, day);
}

type Rule = { key: string } & ({ month: number; day: number } | { easter: number });

const BE: Rule[] = [
  { key: 'new_year', month: 1, day: 1 },
  { key: 'easter_monday', easter: 1 },
  { key: 'labour_day', month: 5, day: 1 },
  { key: 'ascension', easter: 39 },
  { key: 'whit_monday', easter: 50 },
  { key: 'national_day_be', month: 7, day: 21 },
  { key: 'assumption', month: 8, day: 15 },
  { key: 'all_saints', month: 11, day: 1 },
  { key: 'armistice', month: 11, day: 11 },
  { key: 'christmas', month: 12, day: 25 },
];

const FR: Rule[] = [
  { key: 'new_year', month: 1, day: 1 },
  { key: 'easter_monday', easter: 1 },
  { key: 'labour_day', month: 5, day: 1 },
  { key: 'victory_1945', month: 5, day: 8 },
  { key: 'ascension', easter: 39 },
  { key: 'whit_monday', easter: 50 },
  { key: 'bastille_day', month: 7, day: 14 },
  { key: 'assumption', month: 8, day: 15 },
  { key: 'all_saints', month: 11, day: 1 },
  { key: 'armistice', month: 11, day: 11 },
  { key: 'christmas', month: 12, day: 25 },
];

const DE: Rule[] = [
  { key: 'new_year', month: 1, day: 1 },
  { key: 'good_friday', easter: -2 },
  { key: 'easter_monday', easter: 1 },
  { key: 'labour_day', month: 5, day: 1 },
  { key: 'ascension', easter: 39 },
  { key: 'whit_monday', easter: 50 },
  { key: 'german_unity', month: 10, day: 3 },
  { key: 'christmas', month: 12, day: 25 },
  { key: 'second_christmas', month: 12, day: 26 },
];

const LU: Rule[] = [
  { key: 'new_year', month: 1, day: 1 },
  { key: 'easter_monday', easter: 1 },
  { key: 'labour_day', month: 5, day: 1 },
  { key: 'europe_day', month: 5, day: 9 },
  { key: 'ascension', easter: 39 },
  { key: 'whit_monday', easter: 50 },
  { key: 'national_day_lu', month: 6, day: 23 },
  { key: 'assumption', month: 8, day: 15 },
  { key: 'all_saints', month: 11, day: 1 },
  { key: 'christmas', month: 12, day: 25 },
  { key: 'second_christmas', month: 12, day: 26 },
];

function applyRules(rules: Rule[], year: number): BuiltInHoliday[] {
  const easter = easterSunday(year);
  return rules.map((r) => ({
    key: r.key,
    date: 'easter' in r ? addDaysToDateString(easter, r.easter) : formatDateString(year, r.month, r.day),
  }));
}

/** The Netherlands: Koningsdag moves to 26 April when 27 April is a Sunday. */
function netherlands(year: number): BuiltInHoliday[] {
  const easter = easterSunday(year);
  const apr27 = formatDateString(year, 4, 27);
  const kingsDay = weekdayOfDateString(apr27) === 6 ? formatDateString(year, 4, 26) : apr27;
  return [
    { key: 'new_year', date: formatDateString(year, 1, 1) },
    { key: 'easter_sunday', date: easter },
    { key: 'easter_monday', date: addDaysToDateString(easter, 1) },
    { key: 'kings_day', date: kingsDay },
    { key: 'liberation_day', date: formatDateString(year, 5, 5) },
    { key: 'ascension', date: addDaysToDateString(easter, 39) },
    { key: 'whit_sunday', date: addDaysToDateString(easter, 49) },
    { key: 'whit_monday', date: addDaysToDateString(easter, 50) },
    { key: 'christmas', date: formatDateString(year, 12, 25) },
    { key: 'second_christmas', date: formatDateString(year, 12, 26) },
  ];
}

/** Built-in holidays of a region for a year, sorted by date. */
export function builtInHolidays(region: HolidayRegion, year: number): BuiltInHoliday[] {
  let list: BuiltInHoliday[];
  switch (region) {
    case 'BE':
      list = applyRules(BE, year);
      break;
    case 'FR':
      list = applyRules(FR, year);
      break;
    case 'DE':
      list = applyRules(DE, year);
      break;
    case 'LU':
      list = applyRules(LU, year);
      break;
    case 'NL':
      list = netherlands(year);
      break;
    default:
      list = [];
  }
  return list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
