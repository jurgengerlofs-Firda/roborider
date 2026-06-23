# RoboRider — abonnementen via Lemon Squeezy (stappenplan)

Lemon Squeezy regelt de betaling, de maandelijkse incasso én de EU-BTW (merchant of record). Jij hoeft geen belastingaangifte per land te doen.

## 1. Account & winkel
1. Maak een account op lemonsqueezy.com en maak een **Store** aan (bijv. "RoboRider").
2. Vul je **uitbetaalgegevens** in (IBAN). Identiteitsverificatie kan gevraagd worden; een **KvK-nummer** heb je mogelijk nodig.

## 2. Product met abonnement
1. Maak een **Product** → "RoboRider Pro".
2. Voeg een **subscription**-variant toe: **€7 / maand** (en eventueel **€49 / jaar**), valuta EUR.
3. Zet bij het product **License keys** aan (genereer een licentiesleutel per aankoop). Activatielimiet bijv. 3 apparaten of onbeperkt.
4. Publiceer en kopieer de **checkout-link** (Share → checkout URL).

## 3. Link in de code plakken
Vervang in **twee bestanden** de regel `const CHECKOUT_URL = "...REPLACE-WITH-YOUR-LINK"` door jouw checkout-link:
- `rider-builder.html` (bovenin het script)
- `index.html` (bovenin het script)
Daarna pushen (Commit → Push).

## 4. Testen
1. Zet Lemon Squeezy op **Test mode**, koop een abonnement met een testkaart.
2. Je krijgt een **licentiesleutel** (in de bevestigingsmail / klantportaal).
3. Open de builder → knop **✦ Pro** → "ik heb al een licentiesleutel" → plak de sleutel. Het watermerk verdwijnt = werkt.
4. Tevreden? Zet Test mode uit → live.

## Goed om te weten
- Het **watermerk** op de gratis PDF is het verschil tussen Free en Pro. Voor een browser-tool is dat een "zacht" slot (technisch te omzeilen), maar het werkt voor verreweg de meeste mensen.
- Sterkere features (cloud-opslag, deelbare zaal-links, teams) hebben een echte backend nodig — dat bouwen we later met jouw Supabase + accounts.
- **Advies:** zet de prijzen pas echt live als je uit je netwerk hoort dat mensen willen betalen. Tot die tijd staat er netjes "gratis tijdens de preview".
