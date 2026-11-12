import fs from 'node:fs';
import path from 'node:path';

const doc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'PLAY_LISTING.md'), 'utf8');

/** Pull the inline-code values after a bold label such as "**App name (≤30):**". */
function inlineAfter(label: RegExp): string[] {
  return [...doc.matchAll(new RegExp(`${label.source}\\s*\`([^\`]+)\``, 'g'))].map((m) => m[1] as string);
}

describe('Google Play store listing texts', () => {
  const titles = [...inlineAfter(/\*\*App(?:-naam| name) \(≤30\):\*\*/)];
  const shorts = [...inlineAfter(/\*\*(?:Short description|Korte beschrijving) \(≤80\):\*\*/)];
  const fulls = [...doc.matchAll(/\*\*(?:Full description|Volledige beschrijving) \(≤4000\):\*\*\s*\n\s*```\n([\s\S]*?)\n```/g)].map((m) => m[1] as string);

  it('has an English and a Dutch listing', () => {
    expect(titles).toHaveLength(2);
    expect(shorts).toHaveLength(2);
    expect(fulls).toHaveLength(2);
  });

  it('respects the Play Console limits', () => {
    for (const t of titles) expect(t.length).toBeLessThanOrEqual(30);
    for (const s of shorts) expect(s.length).toBeLessThanOrEqual(80);
    for (const f of fulls) expect(f.length).toBeLessThanOrEqual(4000);
  });

  it('contains no invented URLs, email addresses or store claims', () => {
    for (const text of [...titles, ...shorts, ...fulls]) {
      expect(text).not.toMatch(/https?:\/\//i);
      expect(text).not.toMatch(/[\w.-]+@[\w.-]+\.\w+/);
      expect(text).not.toMatch(/#1|\b(best|number one|award|official|guaranteed)\b/i);
    }
  });

  it('only promises what the app does (no network, no ads, no permissions)', () => {
    const english = fulls[0] as string;
    expect(english).toMatch(/no ads/i);
    expect(english).toMatch(/offline/i);
    expect(english).toMatch(/not a payslip/i);
  });
});
