# RoboRider site polish en motion: implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De hele RoboRider-site voelt af en verzorgd, met één gedeeld stylesheet, bijgewerkte homepage, rustige overgangen in de builder en beeld in de gidsen.

**Architecture:** Statische site zonder buildstap. Eén nieuw bestand `roborider.css` draagt de kleur-, letter- en motion-tokens en de gedeelde regels; elke pagina koppelt het vóór zijn eigen `<style>`. Elke taak voegt eerst een controle toe aan `site-check.js`, ziet die falen, en bouwt dan.

**Tech Stack:** HTML, CSS en JavaScript zonder framework; Playwright via `.claude/skills/site-check/site-check.js`; service worker `sw.js`.

**Spec:** `docs/superpowers/specs/2026-11-11-site-polish-motion-design.md`. Lees ook `.claude/skills/motion/SKILL.md`: dat zijn de regels voor elke overgang in dit plan.

## Global Constraints

- Prijzen, checkout, licentiecontrole en de namen van tellingen (`track(...)`) veranderen niet.
- Huisstijl blijft: hoekig (`border-radius:0`), klei-accent `#9a7257`, Jost in hoofdletters voor labels.
- Alleen `transform` en `opacity` animeren; uitzondering is het uitklappen van de FAQ.
- Tijden en curves alleen via tokens: `--ease-out: cubic-bezier(0.23,1,0.32,1)`, `--ease-in-out: cubic-bezier(0.77,0,0.175,1)`, `--dur-press: 160ms`, `--dur-ui: 220ms`, `--dur-exit: 150ms`, `--dur-enter: 300ms`.
- Bij `prefers-reduced-motion:reduce`: geen verplaatsing of schaal, hooguit een fade van `--dur-exit`, niets in een lus, niets blijft onzichtbaar.
- Geen beweging bij typen, in het live voorbeeld, bij slepen op het stageplot, bij taalwissel; geen nieuwe scroll-effecten.
- Homepageteksten in en, nl, de, fr en es. Nederlandse tekst zonder gedachtestreepjes.
- `rider-builder.html` blijft één bestand.
- Elke taak verhoogt `CACHE` in `sw.js` met één (nu `roborider-v90`) en eindigt met een eigen commit.
- Niet naar `main` pushen; alles op `claude/trusting-feynman-r94dki`.

## Review Focus

1. **Oude browser zonder `@starting-style` / `allow-discrete` / `::details-content`:** modals en FAQ moeten dan direct open en dicht gaan zoals nu, nooit onzichtbaar of onklikbaar blijven. Controle in taak 5 en 6.
2. **Offline na de update:** een bezoeker met de oude service worker krijgt nieuwe HTML die `roborider.css` verwacht. De pagina moet het bestand uit de nieuwe cache krijgen. Controle in taak 1.
3. **Snel open en dicht:** een modal die binnen 100ms weer gesloten wordt mag niet half zichtbaar blijven hangen of klikken tegenhouden. Controle in taak 6.
4. **Afdrukken:** de PDF is de browser-afdruk van het voorbeeld. Geen enkele overgang, lege staat of nieuw element mag in de afdruk terechtkomen. Controle in taak 7.
5. **Lange vertalingen:** Duitse en Franse labels in de nieuwe featurekaarten en de Pro-kaart mogen op 390px breed niet buiten hun kaart vallen. Controle in taak 3.

## Bestanden

| Bestand | Rol |
|---|---|
| `roborider.css` (nieuw) | tokens, indrukstand, modal- en meldingrecept, reduce-motion-blok |
| `index.html` | homepage: hero, features, prijzen, PDF-beeld, FAQ, installeer-tip |
| `rider-builder.html` | modals, Pro-bevestiging, lege staat, rij-binnenkomst |
| 22 gidsen (`*-maken*.html`, `*-voorbeeld*.html`, `hospitality-rider*.html`, `rider-sturen*.html`, `microfoon-kiezen*.html`, `monitoring-podium*.html`, `di-box*.html`, `backline*.html`), `privacy.html`, `terms.html`, `404.html` | koppelen stylesheet; gidsen krijgen een beeld |
| `img/rider-sample.png`, `img/guide-stageplot.png`, `img/guide-inputlist.png` (nieuw) | schermbeelden uit de builder |
| `.claude/skills/site-check/site-check.js` | nieuwe controles per taak, in een blok `/* ---------- polish ---------- */` vóór het health-blok |
| `.claude/skills/site-check/shots.js` (nieuw) | maakt de drie beelden opnieuw uit de voorbeeldrider |
| `sw.js` | `SHELL` en `CACHE` |

Controles draaien zo, en zo wordt het in elke taak bedoeld met "draai site-check":

```bash
python3 -m http.server 8765 &
node .claude/skills/site-check/site-check.js http://localhost:8765 <out-dir> | grep -E "FAIL|PROBLEMS"
```

De helper `ok(tag, wat, geslaagd, notitie)` en `open(ctxOpt, pro, tag)` bestaan al in `site-check.js`.

---

### Task 1: Gedeeld stylesheet en tokens (fase 1)

**Files:**
- Create: `roborider.css`
- Modify: alle 27 HTML-pagina's uit de tabel (kop van `<head>` en het `:root`-blok), `sw.js`
- Test: `.claude/skills/site-check/site-check.js`

**Interfaces:**
- Produces: `roborider.css` met `:root`-tokens `--ink --soft --muted --line --hair --bg --card --clay --font --display --ease-out --ease-in-out --dur-press --dur-ui --dur-exit --dur-enter`; regel `.btn:active{transform:scale(.97)}`; één blok `@media (prefers-reduced-motion:reduce)` waar latere taken selectors aan toevoegen.

- [ ] **Step 1: Controle toevoegen.** In het polish-blok, voor elke pagina uit `sitemap.xml` plus `/404.html`, `/privacy.html`, `/terms.html`:
  - `'shared stylesheet is linked: ' + pg`: er is een `link[href="roborider.css"]` en `getComputedStyle(document.documentElement).getPropertyValue('--dur-ui').trim() === '220ms'`.
  - `'page does not redefine shared colours: ' + pg`: geen `<style>` in de pagina bevat `--ink:`.
  - Op `/index.html`: `'buttons have a press state'`: `getComputedStyle(document.querySelector('.btn')).transitionProperty` bevat `transform`.
- [ ] **Step 2: Draai site-check.** Verwacht: FAIL op alle drie de soorten.
- [ ] **Step 3: Schrijf `roborider.css`.** Kleur- en letterwaarden exact uit `index.html`. Bestaande verschillen die verdwijnen: vier pagina's hebben `--muted:#a39d92` (wordt `#6b665d`, donkerder en beter leesbaar) en één pagina mist `--line` en `--card`. Indrukstand: `.btn{transition:transform var(--dur-press) var(--ease-out),background var(--dur-press) var(--ease-out),color var(--dur-press) var(--ease-out)}`. Verplaats het bestaande reduce-motion voor `.hero-mark` en `.reveal` uit `index.html` naar het gedeelde blok.
- [ ] **Step 4: Koppel op elke pagina.** `<link rel="stylesheet" href="roborider.css">` direct vóór de eerste `<style>`. Verwijder uit het `:root` van elke pagina de tien gedeelde tokens; de builder houdt zijn eigen extra's (`--accent --paper2 --brand --brand-d --clay-text --pop --radius --shadow`). Verwijder de numerieke `transition` op `.btn` in `index.html` (regel 54) en in `rider-builder.html` (regel 57). `landing.html` en de logo- en conceptpagina's blijven ongemoeid.
- [ ] **Step 5: `sw.js`.** Voeg `'roborider.css'` toe aan `SHELL`, `CACHE` naar `roborider-v91`.
- [ ] **Step 6: Draai site-check.** Verwacht: `PROBLEMS: 0`. Vergelijk `laptop-1-home-top.png` en `iphone-free-3-preview.png` met de beelden van vóór de taak: gelijk.
- [ ] **Step 7: Offline-controle (Review Focus 2).** Voeg toe: laad `/index.html`, wacht tot `navigator.serviceWorker.ready`, zet de context offline, herlaad; `'homepage works offline with the shared stylesheet'`: `--dur-ui` is nog `220ms`. Verwacht: OK.
- [ ] **Step 8: Commit** `Shared stylesheet with colour and motion tokens, SW v91`.

### Task 2: Homepage past op de telefoon (C2)

**Files:**
- Modify: `index.html` (nav rond regel 218, `.hero-mark` regel 65, installeer-tip regels 773-830)
- Test: `site-check.js`

**Interfaces:**
- Produces: `<select id="lgSel" class="lang-sel">` met opties en, nl, de, fr, es die `setLang(value)` aanroept; `setLang` zet ook `lgSel.value`.

- [ ] **Step 1: Controle toevoegen**, format `iphone` (staand), `/index.html`, scroll 0:
  - `'phone: headline and both buttons are above the fold'`: `getBoundingClientRect().bottom <= innerHeight` voor `.hero h1` en beide `.hero .cta a`.
  - `'phone: navigation is one row'`: hoogte van `nav` ≤ 80.
  - `'phone: install tip waits for the first scroll'`: `#rrInstallPill` is `hidden` bij scroll 0. Zet hiervoor in de test `localStorage` leeg en gebruik de iPhone-useragent (de iOS-tak toont de tip zonder `beforeinstallprompt`).
- [ ] **Step 2: Draai site-check.** Verwacht: FAIL op alle drie.
- [ ] **Step 3: Bouw.** Onder 620px breed: de vijf taalknoppen verborgen en `#lgSel` zichtbaar (minimaal 40px hoog, zelfde rand en letter als de knoppen); `.hero-mark` 96px breed met 14px ondermarge; hero-bovenmarge zo dat de eerste controle slaagt op 390x664. De installeer-tip wordt pas getoond na de eerste `scroll`-gebeurtenis (`{once:true}`).
- [ ] **Step 4: Draai site-check.** Verwacht: `PROBLEMS: 0`. Bekijk `iphone-1-home-top.png` en `iphone-sideways-1-home-top.png`.
- [ ] **Step 5: Commit** `Homepage: headline and buttons above the fold on phones, SW v92`.

### Task 3: Nieuwe features op de homepage (C1)

**Files:**
- Modify: `index.html` (features regel 294-306, Pro-kaart regel 328-333, de vijf taalobjecten vanaf regel 400)
- Test: `site-check.js`

**Interfaces:**
- Produces: i18n-sleutels `f7_h f7_p f8_h f8_p p2_5` in alle vijf talen.

Tekst (en / nl); de, fr en es vertaalt de uitvoerder in dezelfde toon en lengte:

| Sleutel | en | nl |
|---|---|---|
| `f7_h` | Your stage in 3D | Je podium in 3D |
| `f7_p` | Flip the stage plot to 3D and look around the stage the way the crew will see it. | Zet je stageplot om naar 3D en kijk rond op het podium zoals de crew het straks ziet. |
| `f8_h` | Instrument library | Instrumentbibliotheek |
| `f8_p` | Pick the gear you actually play: grand or upright, the size of the drum kit, the mic, seated or standing. | Kies wat je echt speelt: vleugel of piano, de maat van het drumstel, de microfoon, zittend of staand. |
| `p2_5` | Move your gear in 3D | Verplaats je spullen in 3D |

- [ ] **Step 1: Controle toevoegen**, `/index.html`, voor elke taal via `setLang(l)`:
  - `'new features are on the homepage: ' + l`: `[data-i="f7_h"]`, `[data-i="f8_h"]` en `[data-i="p2_5"]` bestaan en hebben tekst.
  - Op `iphone`, talen `de` en `fr` (Review Focus 5): `'feature cards do not overflow: ' + l`: voor elke `#features .card` geldt `scrollWidth <= clientWidth + 1`; idem voor de Pro-kaart.
- [ ] **Step 2: Draai site-check.** Verwacht: FAIL.
- [ ] **Step 3: Bouw.** Twee kaarten erbij in `#features .grid`, één regel erbij in de Pro-lijst. `#features .grid`: vier kolommen vanaf 1000px, twee tussen 620 en 1000px, één daaronder, zodat acht kaarten geen losse rest geven. Kaarticonen in dezelfde stijl als de zes bestaande.
- [ ] **Step 4: Draai site-check.** Verwacht: `PROBLEMS: 0`.
- [ ] **Step 5: Commit** `Homepage: 3D stage and instrument library in features and Pro, SW v93`.

### Task 4: Het eindresultaat tonen en leesbaarheid (C3, C4)

**Files:**
- Create: `.claude/skills/site-check/shots.js`, `img/rider-sample.png`
- Modify: `index.html` (sectie `.showcase` regel 263-278 en de rasterstijlen)
- Test: `site-check.js`

**Interfaces:**
- Produces: `node .claude/skills/site-check/shots.js <base-url> <out-dir>` schrijft `rider-sample.png` (eerste pagina van het voorbeeld van `/rider-builder.html?demo=1`, Pro aan zodat er geen watermerk op staat, 1200px breed), `guide-stageplot.png` (het stageplot in het voorbeeld) en `guide-inputlist.png` (de inputlijst in het voorbeeld). Taak 9 gebruikt de laatste twee.

- [ ] **Step 1: Controle toevoegen**, `/index.html`:
  - `'homepage shows a real rider page'`: `.showcase img` heeft `naturalWidth > 0`, een `alt` van minstens 20 tekens, `width`- en `height`-attributen en `loading="lazy"`.
  - `'homepage body text is at least 15px'`: de kleinste `font-size` van `.send-item p`, `#features .card p` en de alinea's in de stappen is ≥ 15.
- [ ] **Step 2: Draai site-check.** Verwacht: FAIL op beide.
- [ ] **Step 3: Schrijf `shots.js` en maak de beelden.** Zet `rider-sample.png` in `img/`.
- [ ] **Step 4: Bouw.** In `.showcase`: het beeld links, de acht onderdelen rechts in twee kolommen; onder 820px het beeld bovenaan. Het beeld krijgt een rand van 1px `var(--hair)` en de bestaande schaduw van de hero-stage. `data-i`-sleutel `show_alt` voor de alt-tekst in vijf talen (en: "First page of a rider made with RoboRider: band name, contacts and stage plot"). Bodytekst in de drie rasters naar 15px.
- [ ] **Step 5: Draai site-check.** Verwacht: `PROBLEMS: 0`. Bekijk een schermvullend beeld van de homepage op laptop en iPhone.
- [ ] **Step 6: Commit** `Homepage: show a real rider page, larger body text, SW v94`.

### Task 5: FAQ en installeer-tip bewegen rustig

**Files:**
- Modify: `roborider.css`, `index.html` (`.faq` regel 180-187, `#rrInstallPill` regel 779-788)
- Test: `site-check.js`

- [ ] **Step 1: Controle toevoegen**, `/index.html`:
  - `'FAQ opens with the shared timing'`: na een klik op de eerste `summary` en 400ms wachten is het antwoord zichtbaar (hoogte > 0), en `getComputedStyle(details, '::details-content').transitionDuration` bevat `0.22s`. Ondersteunt de browser `::details-content` niet, dan telt alleen "zichtbaar".
  - `'FAQ still opens without the new CSS'` (Review Focus 1): verwijder met `page.addStyleTag` alle overgangen (`*{transition:none!important}`), klik, antwoord is direct zichtbaar.
  - `'install tip slides in from the bottom'`: na tonen is `transform` van `#rrInstallPill` de eindstand en `opacity` 1; de `transitionDuration` bevat `0.3s`.
- [ ] **Step 2: Draai site-check.** Verwacht: FAIL op de eerste en derde.
- [ ] **Step 3: Bouw.** FAQ: `:root{interpolate-size:allow-keywords}` en een overgang op `block-size` en `opacity` van `.faq details::details-content` in `--dur-ui`; het plusteken wordt één `+` dat 45 graden draait in `--dur-ui` in plaats van een tekenwissel. Installeer-tip: het meldingrecept uit de motion-skill, tonen via klasse `show` in plaats van alleen `hidden` weghalen; sluiten wacht `--dur-exit` en zet dan `hidden`. Beide selectors in het reduce-motion-blok.
- [ ] **Step 4: Draai site-check.** Verwacht: `PROBLEMS: 0`, ook de regels `less-motion`.
- [ ] **Step 5: Commit** `Homepage: FAQ and install tip use the shared motion, SW v95`.

### Task 6: Modals in de builder (fase 3)

**Files:**
- Modify: `roborider.css`, `rider-builder.html` (regel 293-294)
- Test: `site-check.js`

De vijf modals zijn `#plotModal #proModal #pdfUpsell #fbModal #acctModal`; ze schakelen de klasse `open` op `.modal-bg` tussen `display:none` en `flex`.

- [ ] **Step 1: Controle toevoegen**, `/rider-builder.html?demo=1`, laptop en iphone:
  - `'Pro window fades and scales in'`: na `proModal.classList.add('open')` en 400ms: `opacity` van `#proModal` is 1, `transform` van `#proModal .modal` is `none`, en `transitionDuration` van `#proModal` bevat `0.22s`.
  - `'stage plot editor fades without scaling'`: direct na `openPlotModal()` (binnen 50ms) is `transform` van `#plotModal .modal` `none`.
  - `'a window that is closed right away is gone'` (Review Focus 3): `open` toevoegen, 80ms later verwijderen, 400ms wachten: `display` is `none` en `document.elementFromPoint(innerWidth/2, innerHeight/2)` ligt niet in `#proModal`.
  - `'windows still open without the new CSS'` (Review Focus 1): met `*{transition:none!important}` is `#proModal` na `open` direct zichtbaar.
- [ ] **Step 2: Draai site-check.** Verwacht: FAIL op de eerste.
- [ ] **Step 3: Bouw.** Het modalrecept uit de motion-skill in `roborider.css`; uitzondering `#plotModal .modal{transform:none;transition:none}`. Selectors in het reduce-motion-blok. De regel `@media print{.modal-bg{display:none!important}}` (regel 464) blijft.
- [ ] **Step 4: Draai site-check.** Verwacht: `PROBLEMS: 0`. Alle bestaande 3D-controles in de editor moeten nog slagen: dat bewijst dat het podium zich goed meet.
- [ ] **Step 5: Commit** `Builder: windows fade in and out with the shared motion, SW v96`.

### Task 7: Pro-bevestiging en lege staat (fase 3, C7)

**Files:**
- Modify: `roborider.css`, `rider-builder.html` (Pro-activatie rond regel 975, `renderPreview()` regel 2107, i18n-blokken)
- Test: `site-check.js`

**Interfaces:**
- Produces: `isBlankRider(): boolean` in `rider-builder.html`: waar als `JSON.stringify(S) === JSON.stringify(blank())`. i18n-sleutel `empty_hint` in vijf talen (en: "Your rider appears here. Start with Quick start, or load the example."; nl: "Hier verschijnt je rider. Begin met Snelstart, of laad het voorbeeld.").

- [ ] **Step 1: Controle toevoegen:**
  - `/rider-builder.html` (zonder `demo`): `'empty preview invites to start'`: `.preview-empty` is zichtbaar en heeft tekst; na `S.band='Test';renderPreview()` is het weg.
  - `'empty hint is not printed'` (Review Focus 4): met `page.emulateMedia({media:'print'})` is `.preview-empty` niet zichtbaar.
  - `'Pro confirmation shows once'`: roep de nieuwe functie `showProDone()` aan: `#proDone` is zichtbaar, het vinkje heeft een `transitionDuration` of animatieduur van hooguit `0.4s`, en na 2500ms is `#proDone` weg.
- [ ] **Step 2: Draai site-check.** Verwacht: FAIL.
- [ ] **Step 3: Bouw.** Lege staat: als `isBlankRider()`, toont `renderPreview()` boven het lege vel een blok `.preview-empty` met `L("empty_hint")`; `@media print{.preview-empty{display:none}}`. Pro-bevestiging: `showProDone()` wordt aangeroepen direct na `track("pro_activated")`; het toont in het Pro-venster een vinkje (SVG-lijn die zich tekent via `stroke-dashoffset`, 400ms, `--ease-out`) met de bestaande succestekst, en verdwijnt na 2 seconden. Bij reduce-motion staat het vinkje er direct.
- [ ] **Step 4: Draai site-check.** Verwacht: `PROBLEMS: 0`.
- [ ] **Step 5: Commit** `Builder: empty preview hint and Pro confirmation, SW v97`.

### Task 8: Een nieuwe rij komt rustig binnen

**Files:**
- Modify: `roborider.css`, `rider-builder.html` (`addRow` regel 2007, `renderForm` regel 1728)
- Test: `site-check.js`

`addRow(p,item)` tekent het hele formulier opnieuw. De rij mag alleen een binnenkomst krijgen als dat lukt met: een `data-row="<pad>:<index>"` op het rij-element, en na `renderForm()` één klasse `row-new` op de laatste rij van dat pad. Vraagt het meer verbouwing van `renderForm()` dan dat, stop dan, meld het, en sla deze taak over.

- [ ] **Step 1: Controle toevoegen**, `/rider-builder.html?demo=1`: `'a new row is marked and the form stays usable'`: na `addRow('contacts',{role:'',name:'',email:'',phone:''})` heeft precies één element de klasse `row-new`, en typen in het eerste veld van die rij binnen 100ms komt in `S.contacts` terecht.
- [ ] **Step 2: Draai site-check.** Verwacht: FAIL.
- [ ] **Step 3: Bouw.** `.row-new` komt binnen van `opacity:0; translateY(-4px)` in `--dur-press` met `--ease-out`, via `@starting-style`. In het reduce-motion-blok.
- [ ] **Step 4: Draai site-check.** Verwacht: `PROBLEMS: 0`.
- [ ] **Step 5: Commit** `Builder: a new row eases in, SW v98`.

### Task 9: Beeld in de gidsen (fase 4, C5)

**Files:**
- Create: `img/guide-stageplot.png`, `img/guide-inputlist.png`
- Modify: de 22 gidsen
- Test: `site-check.js`

**Interfaces:**
- Consumes: `shots.js` uit taak 4.

Welk beeld bij welke gids (NL en `-en` krijgen hetzelfde beeld):

| Beeld | Gidsen |
|---|---|
| `guide-stageplot.png` | `stage-plot-maken`, `stage-plot-voorbeeld`, `monitoring-podium`, `backline` |
| `guide-inputlist.png` | `inputlijst-maken`, `microfoon-kiezen`, `di-box` |
| `rider-sample.png` | `rider-maken`, `rider-voorbeeld`, `rider-sturen`, `hospitality-rider` |

- [ ] **Step 1: Controle toevoegen**, voor elke gids: `'guide has one picture: ' + pg`: precies één `figure.guide-fig img` met `naturalWidth > 0`, `alt` van minstens 20 tekens in de taal van de pagina, `width`, `height` en `loading="lazy"`; en de pagina scrolt niet zijwaarts op iphone.
- [ ] **Step 2: Draai site-check.** Verwacht: FAIL op 22 pagina's.
- [ ] **Step 3: Bouw.** `<figure class="guide-fig">` met `<figcaption>` direct na de inleidende alinea. De stijl voor `.guide-fig` (rand 1px `var(--hair)`, volle kolombreedte, bijschrift in `var(--muted)` 13px) staat in `roborider.css`.
- [ ] **Step 4: Draai site-check.** Verwacht: `PROBLEMS: 0`.
- [ ] **Step 5: Commit** `Guides: one picture from the builder per guide, SW v99`.

### Task 10: Afronden

- [ ] **Step 1:** Draai de volledige site-check op de werkkopie. Verwacht: `PROBLEMS: 0`.
- [ ] **Step 2:** Bekijk alle schermbeelden zelf op afgesneden tekst, overlap en lege vlakken, op laptop, iPhone staand en liggend.
- [ ] **Step 3:** Werk `.claude/skills/site-check/SKILL.md` bij met de nieuwe controles en `shots.js`, en `.claude/skills/motion/SKILL.md` als een recept in de praktijk is bijgesteld.
- [ ] **Step 4: Commit** `site-check and motion skills: describe the new checks`.

## Afwijkingen van de eerste versie van de spec

Bij het lezen van de code bleek, en de spec is hierop aangepast:

- De builder heeft geen losse meldingen. "Opgeslagen" is een statustekst in de balk; die blijft zoals hij is. Het meldingrecept geldt alleen voor de installeer-tip op de homepage.
- PDF-export is de afdrukfunctie van de browser. De pagina kan niet weten of er echt is opgeslagen, dus er komt geen vinkje na export; wel bij Pro-activatie.
