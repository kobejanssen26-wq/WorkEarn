# WorkEarn in de Google Play Store zetten — stappenplan voor beginners

_Stand: 12 november 2026. Je hoeft hier niets van te kennen: volg de stappen in volgorde. Als een knop of menu op je scherm net anders heet dan hier,
kies dan de optie die er het meest op lijkt — Google past zijn menu's regelmatig aan. Doe de stappen in de Play Console bij voorkeur op een computer._

## Het korte verhaal

**Al klaar (door mij):** de app, de tests, de bouw-pijplijn op GitHub, de teksten voor de Play Store, het icoon, de afbeeldingen, de
privacyverklaring (Nederlands en Engels) en de antwoorden op alle vragenlijsten van Google.

**Dit moet jij doen:**

1. Een Google Play-ontwikkelaarsaccount maken (eenmalig 25 USD) — **doe dit vandaag, want de controle door Google kan dagen duren.**
2. 12 mensen met een Android-telefoon zoeken die 14 dagen lang willen meetesten.
3. Twee gegevens in GitHub plakken (5 minuten), zodat ik een **ondertekende** app kan bouwen.
4. In de Play Console de app aanmaken en invullen (alles staat hieronder klaar om te kopiëren).
5. Wachten, en op de juiste momenten op de juiste knop klikken.

### Waarom het weken duurt

Google eist voor **nieuwe persoonlijke ontwikkelaarsaccounts** (aangemaakt na 13 november 2023) een *gesloten test*: minstens **12 testers** die
**14 dagen aan één stuk** meedoen, vóór je de app voor iedereen mag publiceren. Dat kan ik niet versnellen of omzeilen.
Bron: Google Play Console Help, "App testing requirements for new personal developer accounts"
(<https://support.google.com/googleplay/android-developer/answer/14151465>). Een organisatie-account (met bedrijf en D-U-N-S-nummer) heeft die eis niet,
maar dat is voor een hobbyproject niet nodig.

| Fase | Wie | Duur (richtwaarden) |
| --- | --- | --- |
| 1. Account maken en identiteit laten controleren | jij | 30 min werk, daarna wachten (uren tot enkele dagen; Google geeft geen vaste tijd) |
| 2. 12 testers vinden | jij | zo snel mogelijk beginnen |
| 3. Ondertekende app (AAB) | ik, plus 5 min voor jou | ± 25 min bouwtijd |
| 4. App aanmaken en invullen | jij | 1–2 uur |
| 5. Eerste versie in de gesloten test zetten | jij; Google controleert | controle: enkele uren tot ± 7 dagen |
| 6. Gesloten test loopt | testers | minstens 14 dagen |
| 7. "Productie aanvragen" | jij; Google beoordeelt | meestal binnen 7 dagen |
| 8. Publiceren voor iedereen | jij; Google controleert | enkele dagen |

Reken op **ongeveer 4 tot 6 weken**, bijna alles daarvan is wachten.

## Je voortgang (vink af)

- [ ] 0. Gecontroleerd dat het app-ID vrij is
- [ ] 1. Ontwikkelaarsaccount aangemaakt en goedgekeurd
- [ ] 2. 12 (liefst 15–20) testers gevonden, hun Gmail-adressen verzameld
- [ ] 3. Twee geheimen in GitHub gezet; ondertekende app (AAB) gedownload
- [ ] 4. App aangemaakt in de Play Console
- [ ] 5. Winkelvermelding ingevuld
- [ ] 6. App-inhoud (vragenlijsten) ingevuld
- [ ] 7. Eerste versie in de gesloten test gepubliceerd
- [ ] 8. Testers uitgenodigd; 14 dagen aan één stuk ≥ 12 testers
- [ ] 9. Productie aangevraagd en goedgekeurd
- [ ] 10. Gepubliceerd

---

## Stap 0 — Controleer of het app-ID vrij is (1 minuut)

Elke Android-app heeft een uniek ID. Dat van WorkEarn is `com.workearn.app`. Gebruikt iemand anders het al, dan kun je niet uploaden.

Open in je browser: <https://play.google.com/store/apps/details?id=com.workearn.app>

- Zie je *"We're sorry, the requested URL was not found on this server"* → het ID is vrij. ✅
- Opent er een app → het ID is bezet. **Zeg het me**: ik verander het ID. Dat moet vóór de eerste upload; daarna kan het nooit meer.

_(Ik kon dit zelf niet nakijken, mijn omgeving kan de Play Store niet openen. Een zoekopdracht vond geen app met dit ID.)_

## Stap 1 — Ontwikkelaarsaccount maken (doe dit vandaag)

**Wat je nodig hebt:** een Google-account, je identiteitskaart of paspoort, een bankkaart voor 25 USD (≈ 22–24 euro, eenmalig, geen jaarlijkse kost),
je gsm-nummer en je woonadres. Tip: gebruik een Google-account dat je enkel hiervoor gebruikt en zet **tweestapsverificatie** aan.

1. Ga naar <https://play.google.com/console/signup> en log in.
2. Kies het type account **Persoonlijk** ("Yourself" / "Personal"), **niet** "Organisatie".
3. Vul je gegevens in. Je echte naam en adres gebruikt Google om je identiteit te controleren.
4. Betaal de registratiekost (25 USD, eenmalig).
5. Doorloop de **identiteitscontrole**: Google vraagt een foto van je identiteitskaart of paspoort (soms ook een selfie) en controleert je telefoonnummer en e-mailadres.
   Een duidelijke foto zonder reflecties en een adres dat overeenkomt met je documenten voorkomen afkeuring. De registratiekost wordt niet terugbetaald als je
   gegevens ongeldig blijken.
6. **Ontwikkelaarsnaam**: dit is de naam die in de Play Store bij je app staat. Kies iets wat je publiek wilt tonen (je eigen naam of een merknaam).
7. **Contact-e-mail voor de winkelpagina**: dit adres is voor iedereen zichtbaar. Maak liefst een apart e-mailadres voor je app (bijvoorbeeld een nieuw Gmail-adres).
8. **"Handelaar" (trader)**: in de EU vraagt Google of je als handelaar optreedt (EU-regelgeving voor digitale diensten). Voor een gratis hobby-app zonder inkomsten
   kies je meestal "geen handelaar". Beslis zelf wat voor jou klopt (twijfel? lees de uitleg in de Console). Kies je "handelaar", dan toont Google je adres,
   telefoonnummer en e-mailadres publiek aan gebruikers in de EU.
9. Wacht op de bevestiging per e-mail. Pas daarna kun je verder met stap 4.

_Een derde partij schrijft dat de controle meestal binnen een dag klaar is; Google zelf noemt geen duur. Je kunt intussen stap 2 en 3 doen._

## Stap 2 — Zoek 12 testers (begin meteen)

Google telt alleen testers die **een Android-telefoon hebben** en een **Google-account (Gmail)** gebruiken. Een iPhone telt niet mee. Ze moeten tijdens de hele test
"aangemeld" blijven. Zoek er **15 tot 20**, want als er onderweg onder de 12 zakken, loopt de teller niet door.

Stuur hun dit bericht (pas het aan):

> Hoi! Ik zet mijn eerste app in de Play Store: WorkEarn, een app die live toont hoeveel je verdient terwijl je werkt (privé, zonder account, zonder internet).
> Google eist dat 12 mensen 2 weken meetesten. Wil je helpen? Dat kost 2 minuten:
> 1. Stuur me het **Gmail-adres** dat je op je **Android-telefoon** in de Play Store gebruikt.
> 2. Ik stuur je een link. Open die op je telefoon, tik op "Tester worden" en installeer de app.
> 3. Laat de app **minstens 14 dagen** op je telefoon staan. Meer hoef je niet te doen (even openen of een opmerking sturen mag, maar is niet verplicht).
> Alvast bedankt!

Bewaar de Gmail-adressen in een lijstje. Heb je niet genoeg mensen? Vraag familie, vrienden, collega's of klasgenoten, of zoek online een groep voor ontwikkelaars die elkaars
apps testen. Betaalde "tester-diensten" zijn risicovol: Google kijkt ook of testers de app echt gebruiken.

## Stap 3 — De ondertekende app (AAB) krijgen

Google accepteert enkel een app die met een **upload-sleutel** is ondertekend. Die sleutel is als een slot dat bij jou hoort. Ik heb hem al voor je gemaakt en
getest. Je krijgt van mij in dit gesprek drie bestanden:

- `LEES-MIJ-upload-sleutel.txt` — uitleg en de vingerafdruk van de sleutel (geen geheim);
- `1-ANDROID_UPLOAD_KEYSTORE_BASE64.txt` — **geheim**, een lange tekst;
- `2-ANDROID_UPLOAD_STORE_PASSWORD.txt` — **geheim**, het wachtwoord.

**Wat jij doet (5 minuten):**

1. Ga naar <https://github.com/kobejanssen26-wq/WorkEarn/settings/secrets/actions> (je moet ingelogd zijn op GitHub).
2. Klik **New repository secret**. Bij *Name* typ je exact `ANDROID_UPLOAD_KEYSTORE_BASE64`. Bij *Secret* plak je de **hele** inhoud van bestand 1
   (open het bestand, selecteer alles, kopieer, plak). Klik **Add secret**.
3. Klik opnieuw **New repository secret**. *Name*: `ANDROID_UPLOAD_STORE_PASSWORD`. *Secret*: de inhoud van bestand 2. Klik **Add secret**.
4. Zeg me: "secrets staan erin". Dan start ik de bouw (± 25 minuten) en geef ik je de downloadlink.
5. Download de bestanden uit de bouw: klik op de link, scrol naar **Artifacts**, klik op `workearn-release-aab`. Je krijgt een zip. Pak die uit: daarin zit
   `WorkEarn-1.0.0-release.aab`. Dat bestand upload je straks in de Play Console.

**Belangrijk — bewaar de sleutelbestanden veilig** (wachtwoordmanager of een privé-map in je cloud) en deel ze met niemand. Verlies je ze, dan kun je geen nieuwe versies meer
uploaden met dezelfde sleutel. Google kan dan wel de upload-sleutel resetten ("upload key reset" in de Play Console), maar dat kost tijd.
De echte app-sleutel waarmee gebruikers de app ontvangen, beheert Google zelf ("Play App Signing", verplicht voor nieuwe apps).

## Stap 4 — De app aanmaken in de Play Console

1. Ga naar <https://play.google.com/console> → **Alle apps** → **App maken** ("Create app").
2. Vul in:

   | Veld | Waarde |
   | --- | --- |
   | App name | `WorkEarn: Shift & Pay Tracker` |
   | Default language | English (United Kingdom) – en-GB |
   | App or game | App |
   | Free or paid | **Free** (let op: een gratis app kan later nooit betalend worden; dan zou je een nieuwe app met een nieuw app-ID nodig hebben) |
   | Declarations | Beide vakjes aanvinken (Developer Program Policies en US export laws) |

3. Klik **Create app**. Je komt op het dashboard met een lijst taken ("Set up your app"). Werk die af met stap 5 en 6.

## Stap 5 — Winkelvermelding invullen

**Handig:** download de hele map met teksten en afbeeldingen als zip via <https://github.com/kobejanssen26-wq/WorkEarn/archive/HEAD.zip> en pak hem uit.
De afbeeldingen staan in de map `store`. De teksten staan in `docs/PLAY_LISTING.md`
(online: <https://github.com/kobejanssen26-wq/WorkEarn/blob/HEAD/docs/PLAY_LISTING.md>) — kopieer ze uit de grijze blokken.

Ga naar **Grow → Store presence → Main store listing** (of "Hoofdvermelding in de store") en vul in:

| Veld | Wat je invult |
| --- | --- |
| App name | `WorkEarn: Shift & Pay Tracker` |
| Short description | `Live earnings, shifts, pay rules and stats. Private, offline, no account.` |
| Full description | de Engelse tekst uit `docs/PLAY_LISTING.md` |
| App icon | `store/icon-512.png` |
| Feature graphic | `store/feature-graphic-1024x500.png` |
| Phone screenshots | de 8 bestanden in `store/screenshots/` (minstens 2 zijn verplicht) |

**Nederlandse vertaling toevoegen:** kies bovenaan **Manage translations → Add your own translations**, selecteer **Dutch** (kies nl-NL, of nl-BE als dat wordt aangeboden),
en plak de Nederlandse naam, korte en lange beschrijving uit `docs/PLAY_LISTING.md`. Dezelfde afbeeldingen mogen blijven; bestand `08-nl-live-earnings.png` is het Nederlandse scherm.

**App category and contact details** (te vinden onder *Store settings* of in de takenlijst):

| Veld | Waarde |
| --- | --- |
| App category | **Productivity** (niet "Finance": die categorie brengt extra verklaringen mee) |
| Email address | je openbare contact-e-mail (zie stap 1, punt 7) |
| Website / telefoon | mogen leeg blijven |

> **Opmerking over de screenshots:** ze zijn gemaakt met de echte schermen van de app en voorbeeldgegevens (zie `store/README.md`). Dat is toegestaan zolang ze de app eerlijk tonen.
> Je mag ze later vervangen door schermafbeeldingen van je eigen telefoon.

## Stap 6 — App-inhoud (de vragenlijsten van Google)

Dit staat in het dashboard onder **Set up your app** of in het menu onder **Policy and programs → App content**. Hieronder staat per onderdeel wat je antwoordt. De achtergrond
(waarom deze antwoorden kloppen) staat in `docs/PLAY_DATA_SAFETY.md` en `docs/PLAY_CONTENT_RATING.md`.

| Onderdeel | Antwoord |
| --- | --- |
| **Privacy policy** | `https://github.com/kobejanssen26-wq/WorkEarn/blob/HEAD/docs/PRIVACY_POLICY.md` — houd de repository **openbaar** en verplaats of hernoem dit bestand niet |
| **Ads** | No, my app does not contain ads |
| **App access** | All functionality is available without special access (geen login nodig) |
| **Content rating** | Start de vragenlijst. Je e-mail: je contact-e-mail. Categorie: *Utility, Productivity, Communication, or Other*. Antwoord op **alle** vragen "No". Verwacht resultaat: de laagste leeftijdsklasse (3+). |
| **Target audience and content** | Doelgroep: alleen **18 and over**. De app is niet voor kinderen bedoeld. |
| **Data safety** | "Does your app collect or share any of the required user data types?" → **No**. De rest verdwijnt dan vanzelf. Controleer en verstuur. |
| **Government apps** | No |
| **Financial features** | My app doesn't provide any financial features (ze houdt enkel uren en loon bij die je zelf invult; geen betalingen, leningen of bankdiensten) |
| **Health apps / Health features** | Geen (not a health app) |
| **Advertising ID** | No (de app gebruikt geen advertentie-ID) |
| **News app** | No (als het gevraagd wordt) |

## Stap 7 — Eerste versie in de gesloten test zetten

Google moet de **eerste** versie van een nieuwe app altijd beoordelen. Daarom begin je meteen met de gesloten test (de interne test heeft voor jou geen voordeel).

1. Menu links: **Test and release → Testing → Closed testing** → **Create track** (geef hem een naam, bv. "Testers").
2. Tabblad **Testers** → **Create email list** → geef de lijst een naam en plak de Gmail-adressen van je testers (jezelf mag erbij). Sla op en vink de lijst aan.
3. Tabblad **Countries/regions**: kies de landen waar je testers wonen (of kies alle landen).
4. Tabblad **Releases** → **Create new release**:
   - **App signing**: laat **Google-generated key** staan (Play App Signing) en ga verder.
   - **Upload** het bestand `WorkEarn-1.0.0-release.aab` (uit stap 3).
   - *Release name*: wordt vanzelf ingevuld. *Release notes*: plak dit:

     ```
     <en-GB>
     First release: live earnings tracking, employers and pay rules, shifts, calendar, history and statistics. Private and offline.
     </en-GB>
     <nl-NL>
     Eerste versie: live verdiensten, werkgevers en loonregels, shifts, kalender, historiek en statistieken. Privé en offline.
     </nl-NL>
     ```

     (De Console vult de taalcodes meestal zelf in; gebruik die codes. Heb je in stap 5 `nl-BE` gekozen, schrijf dan `<nl-BE>` in plaats van `<nl-NL>`.)

   - Klik **Next**, controleer, en klik **Save** en daarna **Send changes for review** / **Publish to closed testing**.
5. Wacht op de goedkeuring van Google (uren tot ± 7 dagen). Je krijgt een e-mail.

**Foutmeldingen bij het uploaden:**

- *"Package name already exists / already used"* → het app-ID is bezet. Zeg het me.
- *"Your bundle is not signed"* of *"debug certificate"* → je hebt de verkeerde zip (`workearn-UNSIGNED-aab`) gebruikt. Gebruik `workearn-release-aab`.
- *"Version code 1 has already been used"* → zeg het me, ik verhoog het versienummer en bouw opnieuw.

## Stap 8 — Testers uitnodigen en 14 dagen wachten

1. Als de test **gepubliceerd** is, staat bij het tabblad **Testers** een link ("Copy link" onder *How testers join your test*). Die link verschijnt pas na de goedkeuring en soms
   pas na enkele uren.
2. Stuur die link naar je testers. Zij openen hem **op hun Android-telefoon**, met het Google-account dat je in de lijst zette, tikken op **Become a tester** en installeren de app via de Play Store.
3. **Controleer zelf de app op je eigen telefoon**: doorloop de lijst in `docs/SMOKE_TEST.md` (15 minuten). Zie je een fout? Meld het me, ik herstel ze en je uploadt een nieuwe versie in
   dezelfde test.
4. Wacht. De 14 dagen tellen pas als **minstens 12 testers** zijn aangemeld. Zorg dat ze allemaal tegelijk aangemeld zijn en blijven. Vraag ze de app niet te verwijderen en zich niet af te melden.

## Stap 9 — Productie aanvragen

Na 14 dagen met minstens 12 testers verschijnt in het dashboard de knop **Apply for production** (productietoegang aanvragen). Je beantwoordt een korte vragenlijst over de test, de app en
de klaarheid voor productie. Google beoordeelt dat meestal binnen 7 dagen en kan vragen om langer te testen als er te weinig testers waren of ze de app nauwelijks gebruikten.

**Beantwoord eerlijk, met wat er echt gebeurd is.** Voorbeelden die je mag aanpassen (vul de [haakjes] in met de waarheid):

- *Hoe heb je testers gevonden?* "I asked [friends, family and colleagues] I know personally. [N] people with Android phones joined through the opt-in link."
- *Welke feedback kreeg je en wat heb je gedaan?* "[Describe the real feedback, e.g. 'one tester asked for X'] — [what you changed, or 'no changes were needed']."
- *Wat doet de app?* "WorkEarn is a private shift and earnings tracker for people who are paid by the hour. It works offline, needs no account and stores everything on the device."
- *Waarom is de app klaar voor productie?* "[N] testers used it for 14 days without crashes; the release passed Google's review and [describe what you verified]."

## Stap 10 — Publiceren

1. Als productie is goedgekeurd: **Test and release → Production → Create new release**. Het makkelijkst is: ga naar je gesloten test en kies bij de release **Promote release → Production**
   (zo hoef je niets opnieuw te uploaden).
2. Controleer de landen (**Countries/regions**; kies bv. alle landen) en klik **Next → Save → Send for review**.
3. Google controleert de app nog eens (enkele dagen). Daarna staat WorkEarn in de Play Store. 🎉

## Na de publicatie

- **Nieuwe versie uitbrengen:** zeg me wat je wilt veranderen. Ik verhoog `versionCode` (moet bij elke upload hoger zijn), bouw een nieuwe ondertekende AAB en jij uploadt die in **Production → Create new release**.
- **Houd deze dingen online:** de privacyverklaring op de GitHub-link (repository openbaar, bestand niet verplaatsen) en je contact-e-mail. Verdwijnt de link, dan kan Google de app offline halen.
- **Bewaar de upload-sleutel** (zie stap 3).

## Als er iets misgaat

| Probleem | Wat te doen |
| --- | --- |
| Identiteitscontrole duurt lang of wordt afgekeurd | Wacht enkele dagen; bij afkeuring: leesbaardere foto, naam en adres exact zoals op je document, opnieuw proberen. |
| Te weinig testers | Meer mensen vragen; kijk in de Console hoeveel testers zijn aangemeld. |
| App afgekeurd | Lees de reden in de e-mail of in **Policy status** en stuur ze door aan mij; ik pas de tekst of de app aan. |
| Je wilt dit allemaal niet | De app kan ook zonder Play Store worden gedeeld; vraag me om een apart installatiebestand (APK) te maken. |

## Wat is gecontroleerd en wat niet

**Gecontroleerd tegen officiële Google-bronnen (12 nov 2026):**

- Verplichte gesloten test voor nieuwe persoonlijke accounts: 12 testers, 14 aaneengesloten dagen, daarna productietoegang aanvragen (Play Console Help, artikel 14151465).
- Een eerste release moet door Google worden beoordeeld, van enkele uren tot ± 7 dagen; de test-link verschijnt pas na publicatie (Play Console Help).
- Een app die ooit gratis was, kan niet meer betalend worden (Play Console Help).
- Play App Signing is verplicht voor nieuwe apps; een verloren upload-sleutel kan gereset worden; de sleutel moet geldig zijn tot na 22 oktober 2033 (developer.android.com, "Sign your app").
- Target API 36 vanaf 31 augustus 2026 (developer.android.com).
- Android developer verification (2026): voor wie enkel via Google Play publiceert is "geen nieuwe actie vereist", het app-ID wordt automatisch gekoppeld (developer.android.com/developer-verification).

**Niet rechtstreeks gecontroleerd** (mijn omgeving kan `support.google.com` niet openen; dit komt uit zoekresultaten of mijn eigen kennis): de exacte namen van knoppen en menu's, de duur van de
identiteitscontrole, de details van de handelaar-verklaring (trader) en de exacte vragen van de productie-aanvraag. Volg bij verschil de aanwijzingen op je scherm of vraag het mij.
