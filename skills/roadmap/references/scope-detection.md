# Scope detection

Heuristika pro rozhodnutí SMALL / MEDIUM / LARGE. Jde o rychlý odhad, ne o vědu. Když váháš mezi dvěma, **zvol větší** — bezpečnější je mít plán navíc než se propadnout do kódu bez něj.

## Signály

### SMALL — skill ustoupí, žádná roadmap

- Jeden soubor, nebo jednoznačně izolovaná změna
- Odhad <30 řádků změn, <15 min práce
- Žádné rozhodnutí o architektuře / stacku / knihovnách
- User fráze: „oprav typo", „přidej log", „změň barvu tlačítka", „rychlovka", „hotfix"
- Zadání se vejde do jedné věty bez ztráty smyslu

**Akce:** Řekni usrovi „Tohle je SMALL, roadmap netřeba — jdu rovnou na edit." a pokračuj bez `.roadmap/`.

### MEDIUM — krátký workflow (brainstorm → plan → execute)

- 2–10 souborů
- Nová feature v existujícím projektu
- Stack je daný, nerozhoduješ o něm
- Odhad 30 min – 3 h práce
- User fráze: „přidej feature X", „rozšiř Y o Z", „udělej formulář pro…", „napoj X na Y"

**Akce:** Plný workflow kromě TDD / verification / review fáze. Brainstorm krátký (3–5 otázek), plán atomický.

### LARGE — plný workflow (brainstorm → plan → TDD → execute → verify → review)

- Nová aplikace nebo celý subsystém
- Refaktor napříč moduly / několik desítek souborů
- Rozhodnutí o stacku, architektuře, databázi, autentifikaci
- Odhad >3 h práce, nebo několik session
- User fráze: „udělej mi appku", „postav mi", „chci nový projekt", „přepiš X od nuly", „naprogramuj mi plnou Y"

**Akce:** Plný workflow. Brainstorm důkladný (8–15 otázek, discovery + constraints). TDD setup povinný před executem.

## Příklady

| User řekne | Scope | Proč |
|-----------|-------|------|
| „oprav preklep v README" | SMALL | jediný soubor, žádné rozhodnutí |
| „přidej tlačítko Cancel vedle Submit" | SMALL | izolovaná UI změna |
| „přidej do settingsů checkbox pro dark mode" | MEDIUM | 2–4 soubory, může vyžadovat theme state |
| „udělej mi stránku s grafem ze Supabase dat" | MEDIUM | nová feature, stack daný |
| „udělej mi Electron appku na úkoly" | LARGE | nový projekt, stack volba, architektura |
| „zrefaktoruj auth tak aby používal JWT místo session cookies" | LARGE | napříč moduly, architektonické rozhodnutí |
| „udělej mi roadmapu pro todo appku" | LARGE | user explicitně chce roadmapu → důvěřuj |

## Ambiguity → zeptej se

Pokud ze zadání nejde rozhodnout, polož **jednu** otázku:

> „Rozsah tohohle — je to spíš (A) rozšíření existující funkce, nebo (B) nový modul / subsystém? Potřebuju vědět, jestli má smysl plná roadmap nebo kratší plán."

Pak zvol podle odpovědi. Nikdy neptej na víc otázek najednou v této fázi — otázky patří do brainstorm fáze.

## Downgrade / upgrade během workflow

- Pokud během brainstormu zjistíš že scope je větší/menší než jsi odhadl, **aktualizuj `SCOPE.md`** (přepiš, přidej řádek „re-scoped from X to Y, reason: …").
- Pokud user během plánu řekne „tohle je jednodušší než myslíš" → navrhni downgrade, nech ho rozhodnout.
