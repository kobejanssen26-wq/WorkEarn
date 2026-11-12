import { useState } from 'react';
import { Chip, ChipRow } from '@/ui/Surface';

/** Picks which currency to show when data contains several (amounts in different currencies are never added together). */
export function useCurrencyChoice(currencies: readonly string[], preferred: string) {
  const [chosen, setChosen] = useState<string | null>(null);
  const currency = chosen && currencies.includes(chosen) ? chosen : currencies.includes(preferred) ? preferred : (currencies[0] ?? preferred);
  return { currency, setCurrency: setChosen, multiple: currencies.length > 1 };
}

export function CurrencyChips({ currencies, value, onChange }: { currencies: readonly string[]; value: string; onChange: (c: string) => void }) {
  if (currencies.length < 2) return null;
  return (
    <ChipRow>
      {currencies.map((c) => (
        <Chip key={c} label={c} selected={c === value} onPress={() => onChange(c)} />
      ))}
    </ChipRow>
  );
}
