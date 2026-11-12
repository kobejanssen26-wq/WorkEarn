import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { currencySymbol } from '@/core/money';
import { SUPPORTED_CURRENCIES } from '@/core/payRule';
import { INTERVAL_OPTIONS, ROUNDING_MODES } from '@/core/types';
import type { FixedBonusCondition, WeekdayIndex } from '@/core/types';
import { countEmployerShifts, createEmployer, deleteEmployer, getEmployer, listEmployers, setEmployerArchived, updateEmployer } from '@/db/employers';
import type { EmployerWithRule } from '@/db/employers';
import { useApp } from '@/state/AppProvider';
import { useActions, useI18n, useQuery, useTheme } from '@/state/hooks';
import type { TKey } from '@/i18n';
import { EMPLOYER_COLORS, radius, spacing } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { TimeOfDayField } from '@/ui/DateTimeField';
import { Segmented, SwitchRow, TextField } from '@/ui/Fields';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import { Card, Chip, Divider, SectionTitle } from '@/ui/Surface';
import { Text } from '@/ui/Text';

import { emptyCustomBonus, emptyFixedBonus, formFromEmployer, formToPayRule } from './formModel';
import type { CustomBonusForm, EmployerForm, FixedBonusForm, FormErrors, PremiumForm } from './formModel';

const FIXED_CONDITIONS: FixedBonusCondition[] = ['always', 'weekday', 'saturday', 'sunday', 'holiday'];

export default function EmployerFormScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const employerId = params.id === 'new' ? null : Number(params.id);
  const loaded = useQuery(
    async (db) => ({
      employer: employerId === null ? null : await getEmployer(db, employerId),
      total: (await listEmployers(db, { includeArchived: true })).length,
    }),
    [employerId],
  );
  if (!loaded.data) {
    return (
      <Screen variant="stack" title={t('common.loading')}>
        {null}
      </Screen>
    );
  }
  // The body initialises its form state once from the loaded data; later reloads never overwrite edits.
  return <EmployerFormBody key={employerId ?? 'new'} employerId={employerId} employer={loaded.data.employer} total={loaded.data.total} />;
}

function EmployerFormBody({ employerId, employer, total }: { employerId: number | null; employer: EmployerWithRule | null; total: number }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, tp, fmt, locale } = useI18n();
  const { settings } = useApp();
  const { run } = useActions();
  const isNew = employerId === null;

  const [form, setForm] = useState<EmployerForm>(() => formFromEmployer(employer, { currency: settings.currency, colorIndex: total }, fmt.decimalSeparator));
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  const symbol = useMemo(() => currencySymbol(form.currency, locale), [form.currency, locale]);
  const err = (key: string) => (errors[key] ? t(`error.${errors[key]}` as TKey) : null);
  const update = (patch: Partial<EmployerForm>) => setForm((f) => ({ ...f, ...patch }));
  const editing = employer;

  const onSave = async () => {
    const result = formToPayRule(form);
    setErrors(result.errors);
    if (!result.rule) return;
    setSaving(true);
    const input = { name: form.name, color: form.color, notes: form.notes };
    const rule = result.rule;
    const res = await run(async (db) => {
      if (employerId === null) await createEmployer(db, input, rule, Date.now());
      else await updateEmployer(db, employerId, input, rule, Date.now());
    });
    setSaving(false);
    if (res.ok) router.back();
  };

  const onDelete = async () => {
    if (employerId === null) return;
    const count = await run((db) => countEmployerShifts(db, employerId));
    const n = count.ok ? count.value : 0;
    Alert.alert(t('employer.delete.title', { name: form.name }), tp('employer.delete.body', n), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const res = await run((db) => deleteEmployer(db, employerId));
          if (res.ok) router.back();
        },
      },
    ]);
  };

  const onArchive = async () => {
    if (employerId === null || !editing) return;
    const res = await run((db) => setEmployerArchived(db, employerId, !editing.isArchived, Date.now()));
    if (res.ok) router.back();
  };

  const premiumEditor = (key: 'saturday' | 'sunday' | 'holiday', title: string) => (
    <PremiumEditor
      title={title}
      form={form[key]}
      onChange={(p) => update({ [key]: p } as Partial<EmployerForm>)}
      symbol={symbol}
      errorKey={`${key}.value`}
      error={err(`${key}.value`)}
    />
  );

  return (
    <Screen
      variant="stack"
      keyboard
      title={isNew ? t('employer.titleNew') : t('employer.titleEdit')}
      footer={<Button label={t('common.save')} icon="check" onPress={onSave} loading={saving} fullWidth />}>
      <Card>
        <View style={styles.stack}>
          <TextField label={t('employer.name')} value={form.name} onChangeText={(name) => update({ name })} placeholder={t('employer.namePlaceholder')} error={err('name')} maxLength={60} autoFocus={isNew} />
          <View style={styles.stackSmall}>
            <Text variant="label" color="textSecondary">
              {t('employer.color')}
            </Text>
            <View style={styles.swatches}>
              {EMPLOYER_COLORS.map((c) => (
                <Pressable key={c} accessibilityRole="button" accessibilityLabel={`${t('employer.color')} ${c}`} accessibilityState={{ selected: form.color === c }} onPress={() => update({ color: c })} style={[styles.swatch, { backgroundColor: c, borderColor: form.color === c ? colors.text : 'transparent' }]}>
                  {form.color === c ? <Icon name="check" size={16} color="#FFFFFF" /> : null}
                </Pressable>
              ))}
            </View>
          </View>
          <TextField label={t('employer.notes')} value={form.notes} onChangeText={(notes) => update({ notes })} multiline />
        </View>
      </Card>

      <SectionTitle>{t('employer.hourlyWage')}</SectionTitle>
      <Card>
        <View style={styles.stack}>
          <View style={styles.stackSmall}>
            <Text variant="label" color="textSecondary">
              {t('employer.currency')}
            </Text>
            <View style={styles.wrapRow}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <Chip key={c} label={c} selected={form.currency === c} onPress={() => update({ currency: c })} />
              ))}
            </View>
          </View>
          <TextField label={t('employer.hourlyWage')} value={form.hourlyWage} onChangeText={(hourlyWage) => update({ hourlyWage })} keyboardType="decimal-pad" prefix={symbol} suffix={t('common.perHour')} placeholder="0.00" hint={t('employer.wageHelp')} error={err('hourlyWage')} />
          <SwitchRow title={t('employer.weekdayRates.title')} subtitle={t('employer.weekdayRates.help')} value={form.weekdayRatesEnabled} onValueChange={(weekdayRatesEnabled) => update({ weekdayRatesEnabled })} last />
          {form.weekdayRatesEnabled
            ? form.weekdayRates.map((value, day) => (
                <TextField
                  key={day}
                  label={t(`employer.weekday.${day as WeekdayIndex}` as TKey)}
                  value={value}
                  onChangeText={(text) => update({ weekdayRates: form.weekdayRates.map((v, i) => (i === day ? text : v)) })}
                  keyboardType="decimal-pad"
                  prefix={symbol}
                  suffix={t('common.perHour')}
                  placeholder={form.hourlyWage}
                  error={err(`weekdayRates.${day}`)}
                />
              ))
            : null}
        </View>
      </Card>

      <SectionTitle>{t('employer.premium.title')}</SectionTitle>
      <Card>
        <View style={styles.stack}>
          <Text variant="label" color="textSecondary">
            {t('employer.premium.help')}
          </Text>
          {premiumEditor('saturday', t('employer.premium.saturday'))}
          <Divider />
          {premiumEditor('sunday', t('employer.premium.sunday'))}
          <Divider />
          {premiumEditor('holiday', t('employer.premium.holiday'))}
          <Text variant="caption" color="textSecondary">
            {t('employer.premium.priority')}
          </Text>
        </View>
      </Card>

      <SectionTitle>{t('employer.custom.title')}</SectionTitle>
      <Card>
        <View style={styles.stack}>
          <Text variant="label" color="textSecondary">
            {t('employer.custom.help')}
          </Text>
          {form.customBonuses.length === 0 ? (
            <Text variant="body" color="textTertiary">
              {t('employer.custom.empty')}
            </Text>
          ) : null}
          {form.customBonuses.map((b, i) => (
            <CustomBonusEditor
              key={b.key}
              form={b}
              symbol={symbol}
              errors={{ name: err(`customBonuses.${i}.name`), value: err(`customBonuses.${i}.value`), days: err(`customBonuses.${i}.days`) }}
              onChange={(next) => update({ customBonuses: form.customBonuses.map((x) => (x.key === b.key ? next : x)) })}
              onRemove={() => update({ customBonuses: form.customBonuses.filter((x) => x.key !== b.key) })}
            />
          ))}
          <Button label={t('employer.custom.add')} icon="plus" variant="secondary" onPress={() => update({ customBonuses: [...form.customBonuses, emptyCustomBonus()] })} />
        </View>
      </Card>

      <SectionTitle>{t('employer.fixed.title')}</SectionTitle>
      <Card>
        <View style={styles.stack}>
          <Text variant="label" color="textSecondary">
            {t('employer.fixed.help')}
          </Text>
          {form.fixedBonuses.length === 0 ? (
            <Text variant="body" color="textTertiary">
              {t('employer.fixed.empty')}
            </Text>
          ) : null}
          {form.fixedBonuses.map((b, i) => (
            <FixedBonusEditor
              key={b.key}
              form={b}
              symbol={symbol}
              errors={{ name: err(`fixedBonuses.${i}.name`), amount: err(`fixedBonuses.${i}.amount`) }}
              onChange={(next) => update({ fixedBonuses: form.fixedBonuses.map((x) => (x.key === b.key ? next : x)) })}
              onRemove={() => update({ fixedBonuses: form.fixedBonuses.filter((x) => x.key !== b.key) })}
            />
          ))}
          <Button label={t('employer.fixed.add')} icon="plus" variant="secondary" onPress={() => update({ fixedBonuses: [...form.fixedBonuses, emptyFixedBonus()] })} />
        </View>
      </Card>

      <SectionTitle>{t('employer.rounding.title')}</SectionTitle>
      <Card>
        <View style={styles.stack}>
          <Text variant="label" color="textSecondary">
            {t('employer.rounding.help')}
          </Text>
          <View style={styles.wrapRow}>
            {INTERVAL_OPTIONS.map((m) => (
              <Chip key={m} label={t(`interval.${m}` as TKey)} selected={form.intervalMinutes === m} onPress={() => update({ intervalMinutes: m })} />
            ))}
          </View>
          {form.intervalMinutes !== 0 ? (
            <>
              <Segmented label={t('employer.rounding.mode')} value={form.roundingMode} onChange={(roundingMode) => update({ roundingMode })} options={ROUNDING_MODES.map((m) => ({ value: m, label: t(`employer.rounding.${m}` as TKey) }))} />
              <Text variant="caption" color="textSecondary">
                {t(`employer.rounding.${form.roundingMode}Help` as TKey)}
              </Text>
            </>
          ) : null}
        </View>
      </Card>

      {editing ? (
        <>
          <Text variant="caption" color="textSecondary">
            {t('employer.versionNote')}
          </Text>
          <SectionTitle>{t('employers.archived')}</SectionTitle>
          <Card>
            <View style={styles.stack}>
              <Text variant="label" color="textSecondary">
                {t('employer.archiveHelp')}
              </Text>
              <Button label={editing.isArchived ? t('employer.unarchive') : t('employer.archive')} icon="archive" variant="secondary" onPress={onArchive} />
              <Button label={t('employer.delete')} icon="trash-2" variant="danger" onPress={onDelete} />
            </View>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function PremiumEditor({ title, form, onChange, symbol, error }: { title: string; form: PremiumForm; onChange: (p: PremiumForm) => void; symbol: string; errorKey: string; error: string | null }) {
  const { t } = useI18n();
  return (
    <View style={styles.stackSmall}>
      <SwitchRow title={title} value={form.enabled} onValueChange={(enabled) => onChange({ ...form, enabled })} last />
      {form.enabled ? (
        <View style={styles.stack}>
          <Segmented
            value={form.valueType}
            onChange={(valueType) => onChange({ ...form, valueType })}
            options={[
              { value: 'percent', label: t('employer.premium.percent') },
              { value: 'amount', label: t('employer.premium.amount') },
            ]}
          />
          <TextField
            label={form.valueType === 'percent' ? t('employer.premium.percentLabel') : t('employer.premium.amountLabel')}
            value={form.value}
            onChangeText={(value) => onChange({ ...form, value })}
            keyboardType="decimal-pad"
            prefix={form.valueType === 'amount' ? symbol : undefined}
            suffix={form.valueType === 'percent' ? '%' : t('common.perHour')}
            placeholder={form.valueType === 'percent' ? '50' : '2.00'}
            error={error}
          />
          <Segmented
            value={form.mode}
            onChange={(mode) => onChange({ ...form, mode })}
            options={[
              { value: 'add', label: t('employer.premium.add') },
              { value: 'replace', label: t('employer.premium.replace') },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

function CustomBonusEditor({ form, onChange, onRemove, symbol, errors }: { form: CustomBonusForm; onChange: (b: CustomBonusForm) => void; onRemove: () => void; symbol: string; errors: { name: string | null; value: string | null; days: string | null } }) {
  const { colors } = useTheme();
  const { t, fmt } = useI18n();
  return (
    <View style={[styles.nested, { borderColor: colors.border, backgroundColor: colors.bg }]}>
      <View style={styles.nestedHeader}>
        <Text variant="bodyStrong">{form.name.trim() || t('employer.custom.name')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.remove')} onPress={onRemove} hitSlop={10}>
          <Icon name="trash-2" size={18} color={colors.negative} />
        </Pressable>
      </View>
      <TextField label={t('employer.custom.name')} value={form.name} onChangeText={(name) => onChange({ ...form, name })} placeholder={t('employer.custom.namePlaceholder')} error={errors.name} />
      <Segmented
        value={form.valueType}
        onChange={(valueType) => onChange({ ...form, valueType })}
        options={[
          { value: 'percent', label: t('employer.premium.percent') },
          { value: 'amount', label: t('employer.premium.amount') },
        ]}
      />
      <TextField
        label={form.valueType === 'percent' ? t('employer.premium.percentLabel') : t('employer.premium.amountLabel')}
        value={form.value}
        onChangeText={(value) => onChange({ ...form, value })}
        keyboardType="decimal-pad"
        prefix={form.valueType === 'amount' ? symbol : undefined}
        suffix={form.valueType === 'percent' ? '%' : t('common.perHour')}
        error={errors.value}
      />
      <Segmented
        value={form.mode}
        onChange={(mode) => onChange({ ...form, mode })}
        options={[
          { value: 'add', label: t('employer.premium.add') },
          { value: 'replace', label: t('employer.premium.replace') },
        ]}
      />
      <View style={styles.stackSmall}>
        <Text variant="label" color="textSecondary">
          {t('employer.custom.days')}
        </Text>
        <View style={styles.wrapRow}>
          {Array.from({ length: 7 }, (_, d) => (
            <Chip key={d} label={fmt.weekdayShort(d)} selected={((form.weekdayMask >> d) & 1) === 1} onPress={() => onChange({ ...form, weekdayMask: form.weekdayMask ^ (1 << d) })} />
          ))}
        </View>
        {errors.days ? (
          <Text variant="caption" color="negative">
            {errors.days}
          </Text>
        ) : null}
      </View>
      <View style={styles.timeRow}>
        <TimeOfDayField label={t('common.from')} minute={form.startMinute} onChange={(startMinute) => onChange({ ...form, startMinute })} />
        <TimeOfDayField label={t('common.to')} minute={form.endMinute} onChange={(endMinute) => onChange({ ...form, endMinute })} />
      </View>
      <Text variant="caption" color="textSecondary">
        {t('employer.custom.windowHelp')}
      </Text>
    </View>
  );
}

function FixedBonusEditor({ form, onChange, onRemove, symbol, errors }: { form: FixedBonusForm; onChange: (b: FixedBonusForm) => void; onRemove: () => void; symbol: string; errors: { name: string | null; amount: string | null } }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View style={[styles.nested, { borderColor: colors.border, backgroundColor: colors.bg }]}>
      <View style={styles.nestedHeader}>
        <Text variant="bodyStrong">{form.name.trim() || t('employer.custom.name')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.remove')} onPress={onRemove} hitSlop={10}>
          <Icon name="trash-2" size={18} color={colors.negative} />
        </Pressable>
      </View>
      <TextField label={t('employer.custom.name')} value={form.name} onChangeText={(name) => onChange({ ...form, name })} error={errors.name} />
      <TextField label={t('common.amount')} value={form.amount} onChangeText={(amount) => onChange({ ...form, amount })} keyboardType="decimal-pad" prefix={symbol} placeholder="0.00" error={errors.amount} />
      <View style={styles.stackSmall}>
        <Text variant="label" color="textSecondary">
          {t('employer.fixed.condition')}
        </Text>
        <View style={styles.wrapRow}>
          {FIXED_CONDITIONS.map((c) => (
            <Chip key={c} label={t(`employer.fixed.${c}` as TKey)} selected={form.condition === c} onPress={() => onChange({ ...form, condition: c })} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  stackSmall: { gap: spacing.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  nested: { borderWidth: 1, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  nestedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeRow: { flexDirection: 'row', gap: spacing.md },
});
