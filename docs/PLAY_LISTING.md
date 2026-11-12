# Google Play — store listing (preparation)

Texts are ready to paste into **Play Console → Grow → Store presence → Main store listing**. Character limits are Google's current limits
(title 30, short description 80, full description 4 000); they are checked by `npm test` (`tests/store-listing.test.ts`).

## English (default, en-GB)

**App name (≤30):** `WorkEarn: Shift & Pay Tracker`

**Short description (≤80):** `Live earnings, shifts, pay rules and stats. Private, offline, no account.`

**Full description (≤4000):**

```
Watch what you earn while you work.

WorkEarn is a private shift and earnings tracker. Pick your employer, start a shift and see your earnings grow second by second – calculated from exact timestamps, never from rounded ticks. Close the app or let Android stop it: your running shift is still there when you come back.

LIVE EARNINGS
• Start, pause, resume and stop with one tap
• Earnings updated every second, plus elapsed working time
• Your current hourly rate, including active weekend, holiday or night bonuses
• Today's and this week's earnings at a glance
• At the end of a shift see the live estimate next to the final rounded earnings

EMPLOYERS AND PAY RULES
• Unlimited employers, each with its own wage and currency
• Different rates per weekday
• Saturday, Sunday and public-holiday bonuses – as a percentage or an amount per hour, added to or replacing your wage
• Custom hourly bonuses, for example a night bonus from 22:00 to 06:00
• Fixed bonuses per shift
• Calculation intervals from continuous to 60 minutes with rounding down, up or to the nearest
• Past shifts keep the pay rules they were recorded with

SHIFTS YOUR WAY
• Paid and unpaid breaks, tips and extra earnings, notes
• Add, edit and delete shifts by hand
• Shifts across midnight are priced correctly across rate periods

CALENDAR, HISTORY AND STATISTICS
• Month calendar with worked days, daily earnings and number of shifts
• Complete history with employer, times, duration and earnings
• Daily, weekly, monthly and yearly earnings, total hours, average per hour and employer comparison – always calculated from your real shifts

PRIVATE BY DESIGN
• Works fully offline, no account needed
• No ads, no analytics, no tracking
• No internet access and no permissions for your contacts, location or files
• Export your shifts to CSV (Excel Europe or international format) whenever you like
• Delete all data in one tap

MADE FOR EUROPE
• Euro by default, plus other European currencies
• Public holidays for Belgium, the Netherlands, France, Germany and Luxembourg built in, plus your own custom holidays
• English and Dutch, light and dark theme

WorkEarn gives estimates for your own tracking. It is not a payslip and not payroll software.
```

**Category (recommended):** Productivity (alternative: Business). Avoid *Finance*: the app records hours and wages but offers no financial service, and that category brings additional declarations.

**Tags (suggest):** time tracking, productivity, shift work.

## Nederlands (Dutch — pick nl-NL, or nl-BE if the Console lists it)

**App-naam (≤30):** `WorkEarn: Shift & Loon Tracker`

**Korte beschrijving (≤80):** `Live verdiensten, shifts, loonregels en stats. Privé, offline, zonder account.`

**Volledige beschrijving (≤4000):**

```
Zie wat je verdient terwijl je werkt.

WorkEarn is een privé tracker voor shifts en verdiensten. Kies je werkgever, start een shift en zie je verdiensten seconde per seconde groeien – berekend op basis van exacte tijdstippen, nooit met afgeronde tikken. Sluit de app of laat Android ze stoppen: je lopende shift staat er nog wanneer je terugkomt.

LIVE VERDIENSTEN
• Starten, pauzeren, hervatten en stoppen met één tik
• Verdiensten elke seconde bijgewerkt, plus verstreken werktijd
• Je huidige uurloon, inclusief actieve weekend-, feestdag- of nachtpremies
• Verdiensten van vandaag en deze week in één oogopslag
• Aan het einde van een shift zie je de live schatting naast de definitieve afgeronde verdienste

WERKGEVERS EN LOONREGELS
• Onbeperkt aantal werkgevers, elk met eigen loon en munt
• Verschillend uurloon per weekdag
• Zaterdag-, zondag- en feestdagpremies – als percentage of bedrag per uur, bij het loon of in plaats ervan
• Eigen uurpremies, bijvoorbeeld een nachtpremie van 22:00 tot 06:00
• Vaste premies per shift
• Berekeningsintervallen van continu tot 60 minuten met afronding naar beneden, naar boven of naar het dichtstbijzijnde
• Oude shifts behouden de loonregels waarmee ze opgeslagen werden

SHIFTS OP JOUW MANIER
• Betaalde en onbetaalde pauzes, fooien en extra verdiensten, notities
• Shifts zelf toevoegen, bewerken en verwijderen
• Shifts over middernacht worden correct berekend over de verschillende tariefperiodes

KALENDER, HISTORIEK EN STATISTIEKEN
• Maandkalender met gewerkte dagen, dagelijkse verdiensten en aantal shifts
• Volledige historiek met werkgever, uren, duur en verdiensten
• Dagelijkse, wekelijkse, maandelijkse en jaarlijkse verdiensten, totaal aantal uren, gemiddelde per uur en vergelijking tussen werkgevers – altijd berekend op basis van je echte shifts

PRIVÉ OP ZICH
• Werkt volledig offline, geen account nodig
• Geen advertenties, geen analytics, geen tracking
• Geen internettoegang en geen machtigingen voor je contacten, locatie of bestanden
• Exporteer je shifts naar CSV (Excel Europa of internationaal formaat) wanneer je wilt
• Verwijder alle gegevens met één tik

GEMAAKT VOOR EUROPA
• Standaard euro, plus andere Europese munten
• Feestdagen voor België, Nederland, Frankrijk, Duitsland en Luxemburg ingebouwd, plus je eigen feestdagen
• Engels en Nederlands, licht en donker thema

WorkEarn geeft schattingen voor je eigen bijhouden. Het is geen loonbrief en geen loonsoftware.
```

## Graphics

| Asset | File | Size | Notes |
| --- | --- | --- | --- |
| App icon | `store/icon-512.png` | 512 × 512 PNG | Same artwork as the app icon |
| Feature graphic | `store/feature-graphic-1024x500.png` | 1024 × 500 PNG | Generated from the design system |
| Phone screenshots | `store/screenshots/*.png` | 1080 × 1920 PNG | See `store/README.md` for how they were produced |

## What only the developer can provide

The click-by-click version of all of this, in Dutch, is [`PLAY_STORE_STAPPENPLAN_NL.md`](PLAY_STORE_STAPPENPLAN_NL.md).

- Developer account details: developer name, contact **email** (public), and for organisations a verified address / D-U-N-S, as the Play Console asks.
- **Privacy policy URL** — the policy (English + Dutch, no placeholders) is hosted from this public repository:
  `https://github.com/kobejanssen26-wq/WorkEarn/blob/HEAD/docs/PRIVACY_POLICY.md`. Keep the repository public and the file path unchanged, or the link breaks.
- The Play Console declarations: Data safety (`docs/PLAY_DATA_SAFETY.md`), content rating (`docs/PLAY_CONTENT_RATING.md`), target audience, ads (none), financial features (none), app access (no login).
- Countries / regions and price (free; a free app can never become paid).
- The upload key (see `docs/ANDROID_RELEASE.md`) and enrolment in Play App Signing.
- The testing requirement for new **personal** developer accounts (created after 13 Nov 2023): a closed test with at least 12 testers opted in for 14 continuous days before you can
  apply for production access ([Google's rule](https://support.google.com/googleplay/android-developer/answer/14151465)).
- Real-device screenshots if you prefer them over the generated ones.
