# RoboRider professioneler: gedeeld fundament, critique-verbeteringen en ingetogen motion

Status: ontwerp, wacht op akkoord. Er is nog niets aan de site gewijzigd.

## Doel

De hele site voelt af en verzorgd. Beweging is ingetogen en functioneel: ze legt uit wat er gebeurt en valt
verder niet op. Er is geen cijferdoel; de bestaande tellingen in `docs/measuring.md` blijven werken zodat een
effect op de trechter wel zichtbaar is.

## Wat niet verandert

- Prijzen, checkout en licentiecontrole.
- De huisstijl: hoekig, klei-accent, Jost in hoofdletters voor labels.
- Namen en momenten van de tellingen.
- De opbouw van `rider-builder.html` als één bestand.

## Bevindingen waar dit ontwerp op rust

Uit de design-critique (laptop 1440x900 en iPhone 14, 11 november 2026):

| # | Bevinding | Ernst |
|---|---|---|
| C1 | 3D-podium, instrumentbibliotheek en poses ontbreken in de featurelijst en in de Pro-kaart | hoog |
| C2 | Telefoon: logo, taalrij en installeer-tip duwen kop en knoppen onder de vouw; de tip ligt over de kop | hoog |
| C3 | Nergens een beeld van het eindresultaat (de PDF) | midden |
| C4 | Secties na de hero lijken op elkaar: zelfde rasters, kleine tekst, weinig contrast | midden |
| C5 | Gidsartikelen hebben geen beeld, ook de stageplot-gidsen niet | midden |
| C6 | Elke pagina heeft een eigen `<style>` met eigen `:root`; geen gedeelde tokens | midden |
| C7 | Builder start met een leeg voorbeeld vol watermerken | laag |

Uit de animatie-inventarisatie: de site heeft geen gedeelde duur of easing. De homepage heeft één
scroll-reveal en een slider; de builder heeft drie overgangen en 43 plekken die hard aan of uit schakelen.

## Fase 1: gedeeld fundament

Nieuw bestand `roborider.css` in de root, gekoppeld vanaf alle HTML-pagina's die bezoekers zien (homepage,
builder, 22 gidsen, privacy, terms, 404).

Inhoud:

- De kleur- en lettertokens die nu per pagina in `:root` staan: `--ink`, `--soft`, `--muted`, `--line`,
  `--hair`, `--bg`, `--card`, `--clay`, `--font`, `--display`. Waar pagina's nu van elkaar afwijken, wint de
  waarde van `index.html`; elke afwijking wordt in het plan benoemd voordat ze verdwijnt.
- Motion-tokens:

  | Token | Waarde | Voor |
  |---|---|---|
  | `--ease-out` | `cubic-bezier(0.23,1,0.32,1)` | alles wat binnenkomt of reageert |
  | `--ease-in-out` | `cubic-bezier(0.77,0,0.175,1)` | iets dat op het scherm van plek wisselt |
  | `--dur-press` | `160ms` | indrukstand |
  | `--dur-ui` | `220ms` | modals, uitklappen, kleine panelen |
  | `--dur-exit` | `150ms` | sluiten en verdwijnen |
  | `--dur-enter` | `300ms` | meldingen die inschuiven |

- Gedeelde regels: indrukstand voor knoppen (`:active{transform:scale(.97)}`) en één
  `prefers-reduced-motion`-blok. Bij "minder beweging" vervalt elke verplaatsing en schaal; wat overblijft is
  een fade van hooguit 150ms. Niets loopt in een lus.

Per pagina verdwijnt alleen het dubbele `:root`-blok. Pagina-eigen stijlen blijven staan.

`roborider.css` komt in de `SHELL`-lijst van `sw.js`; de cacheversie gaat omhoog.

Klaar als: `site-check` slaagt, en de schermbeelden van voor en na gelijk zijn op de indrukstand na.

## Fase 2: homepage

- **Telefoon-hero (C2):** logo in de hero kleiner, taalkeuze naast de knop in de navigatiebalk, installeer-tip
  pas na de eerste scroll. Klaar als op een iPhone 14 staand de kop en beide knoppen zonder scrollen zichtbaar
  zijn.
- **Features bijwerken (C1):** 3D-podium, instrumentbibliotheek en poses in de featurelijst; 3D in de
  Pro-kaart. Teksten in en, nl, de, fr en es. Nederlandse tekst zonder gedachtestreepjes.
- **Eindresultaat tonen (C3):** één echte rider-pagina als beeld bij "This is what you'll send", gemaakt uit
  de voorbeeldrider van de builder, met alt-tekst.
- **Leesbaarheid (C4):** bodytekst in de rasters naar minimaal 15px, en per sectie één duidelijk zwaartepunt.
  Geen secties erbij.
- **Motion:** FAQ klapt open met hoogte en opacity in `--dur-ui`; de plus draait naar een min. De
  installeer-tip schuift in en uit langs dezelfde rand in `--dur-enter` en `--dur-exit`.

## Fase 3: builder

- **Modals:** achtergrond fadet, venster komt van `opacity:0; scale(.97)` in `--dur-ui`, sluit in
  `--dur-exit`. De stageplot-editor fadet alleen, zonder schaal: die is schermvullend op telefoon en het
  3D-podium meet zichzelf bij openen.
- **Meldingen:** de builder heeft geen losse meldingen; "opgeslagen" is een statustekst in de balk en blijft
  zoals hij is.
- **Bevestiging:** een vinkje dat zich in 400ms tekent bij Pro-activatie, één keer. Niet bij PDF-export: dat
  is de afdrukfunctie van de browser, en de pagina kan niet weten of er echt is opgeslagen.
- **Lege staat (C7):** het voorbeeld toont een korte uitnodiging zolang er nog niets is ingevuld.
- **Rijen in de inputlijst:** `addRow()` tekent nu het hele formulier opnieuw. Een nieuwe rij krijgt alleen
  een eigen binnenkomst als dat kan zonder `renderForm()` te herbouwen. Het plan begint met die vraag; is het
  antwoord nee, dan vervalt dit punt.

## Fase 4: gidsen en overige pagina's

- Elke gids krijgt één beeld uit de builder dat bij het onderwerp past (stageplot, inputlijst, PDF-pagina),
  met alt-tekst, in de NL- en de EN-versie (C5).
- 404, privacy en terms krijgen alleen het fundament.

## Bewust geen beweging

- Typen in het formulier en het live voorbeeld: honderden keren per sessie, moet direct zijn.
- Slepen, selecteren en verplaatsen op het stageplot, in 2D en 3D.
- Taalwissel: tekst die je wilt lezen fadet niet in.
- Extra scroll-effecten op de homepage; de bestaande reveal blijft zoals hij is.
- Het zwevende hero-logo blijft, zonder uitbreiding.

## Testen

Na elke fase:

1. `site-check` op de werkkopie, op laptop en iPhone staand en liggend.
2. De ronde "minder beweging" in `site-check`: niets loopt in een lus of duurt lang, niets blijft verborgen.
3. De schermbeelden zelf bekijken op afgesneden tekst en overlap.

## Opleveren

Eén branch, één commit per fase, zodat elke fase los te beoordelen en terug te draaien is. De cacheversie in
`sw.js` gaat bij elke fase omhoog.

## Skills die hierbij horen

- `motion` (nieuw): de tokens, de recepten en de lijst "bewust geen beweging", zodat elke volgende feature
  dezelfde regels volgt.
- `site-check` (uitgebreid): de ronde "minder beweging".

## Buiten dit ontwerp

- Nieuwe productfeatures: eigen brainstorm en eigen spec.
- `rider-builder.html` opsplitsen in losse bestanden.
