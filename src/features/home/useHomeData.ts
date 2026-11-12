import { addDaysToDateString, startOfWeekDateString } from '@/core/time';
import { listEmployers } from '@/db/employers';
import type { EmployerWithRule } from '@/db/employers';
import { getEnabledHolidayDates } from '@/db/holidays';
import { loadPayRule } from '@/db/payRules';
import { getActiveShift, listShifts } from '@/db/shifts';
import type { ShiftRecord } from '@/db/shifts';
import { useApp } from '@/state/AppProvider';
import { useQuery } from '@/state/hooks';

import type { ActiveView } from './LiveHero';

export interface HomeData {
  employers: EmployerWithRule[];
  active: ActiveView | null;
  holidays: ReadonlySet<string>;
  /** Finished shifts of the current week (used for the Today / This week cards). */
  weekShifts: ShiftRecord[];
  weekStart: string;
  weekEnd: string;
}

/** Everything the Home screen needs, reloaded after every data change and at midnight. */
export function useHomeData(dayKey: string) {
  const { settings } = useApp();
  return useQuery<HomeData>(
    async (db) => {
      const employers = await listEmployers(db);
      const activeShift = await getActiveShift(db);
      let active: ActiveView | null = null;
      if (activeShift) {
        const rule = await loadPayRule(db, activeShift.payRuleId);
        const all = employers.some((e) => e.id === activeShift.employerId) ? employers : await listEmployers(db, { includeArchived: true });
        if (rule) active = { shift: activeShift, rule, employer: all.find((e) => e.id === activeShift.employerId) ?? null };
      }
      const holidays = await getEnabledHolidayDates(db);
      const weekStart = startOfWeekDateString(dayKey, settings.weekStart);
      const weekEnd = addDaysToDateString(weekStart, 6);
      const weekShifts = await listShifts(db, { fromDate: weekStart, toDate: weekEnd });
      return { employers, active, holidays, weekShifts, weekStart, weekEnd };
    },
    [dayKey, settings.weekStart],
  );
}
