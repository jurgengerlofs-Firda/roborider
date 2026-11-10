# Wat RoboRider meet

RoboRider telt anoniem wat mensen doen, via GoatCounter. Een telling is alleen een naam (bijvoorbeeld
`ev/pdf_export_free`): geen cookies, geen opslag in de browser, geen inhoud van riders, niets wat naar een
persoon leidt. Je vindt ze in GoatCounter als paden die met `ev/` beginnen. De helper heet `track()` en staat
in `rider-builder.html` en `index.html`.

"Eén keer" betekent: hooguit één telling per keer dat de pagina geladen wordt.

## De trechter: van bezoeker naar Pro

| Stap | Telling | Wanneer |
|---|---|---|
| 1. Komt binnen | paginabezoek `/` of `/rider-builder.html` | standaard GoatCounter |
| 2. Ziet het podium | `home_stage_shown` | 3D-podium op de homepage is geladen |
| 3. Speelt ermee | `home_stage_touched` (één keer) | bezoeker raakt het podium aan |
| 4. Gaat bouwen | `home_cta_build`, `home_cta_sample`, `home_stage_open_rider`, `home_showcase_sample`, `home_to_builder_other` | klik naar de builder |
| 5. Start een rider | `wizard_build`, `example_load` | snelstart gebruikt, voorbeeld geladen |
| 6. Maakt een stageplot | `plot_open`, `plot_item_add` (één keer) | editor geopend, eerste element toegevoegd |
| 7. Ziet 3D | `plot3d_open_free`, `plot3d_open_pro`, `preview3d_shown_free/pro/demo/shared` | 3D geopend in editor of voorbeeld |
| 8. Wil meer | `plot3d_unlock_click`, `pdf_upsell_shown`, `pro_modal_open` | klik op ontgrendelen, Pro-venster |
| 9. Gaat betalen | `pro_checkout_click` | klik naar de checkout |
| 10. Is Pro | `pro_activated` (`pro_key_rejected` bij een foute sleutel) | licentiesleutel geaccepteerd |

De belangrijkste verhouding voor 3D: `plot3d_unlock_click` gedeeld door `plot3d_open_free`. Die zegt hoeveel
gratis gebruikers die 3D zien ook willen ontgrendelen.

## Overige tellingen

| Telling | Wanneer |
|---|---|
| `pdf_export_free`, `pdf_export_pro` | PDF geëxporteerd |
| `demo_view`, `shared_view` | voorbeeldrider of gedeelde link geopend |
| `share_link_click`, `rider_save_click` | deel-link gemaakt, rider opgeslagen in account |
| `account_modal_open` (één keer), `login_link_sent` | inlogvenster, inloglink verstuurd |
| `plot_add_<type>_<variant>` (één keer per soort) | welk instrument is toegevoegd, bijv. `plot_add_keys_grand` |
| `plot_panel_<veld>` (één keer per veld) | instellingenpaneel gebruikt: `v` (type), `pose`, `hgt`, `w`, `h`, `rot`, `label` |
| `plot3d_live_on`, `plot3d_live_off` (één keer) | Live-knop gebruikt |
| `preview_plot_2d`, `preview_plot_3d` (één keer) | gewisseld in het voorbeeld |
| `lang_<taal>` (één keer) | taal gewisseld in de builder |
| `plot3d_failed`, `preview3d_failed`, `home_stage_failed` | 3D kon niet starten op dit apparaat |

## Een telling toevoegen

Roep `track("naam")` aan op de plek waar het gebeurt, of `track("naam", true)` voor iets dat zich herhaalt.
Gebruik kleine letters en underscores, zet nooit inhoud van een gebruiker in de naam, en voeg de telling toe
aan deze lijst.
