---
name: gauntlet-loop
description: Use when the user asks for a "gauntlet loop", "gauntlet", builder–critic smyčku, or wants a visual/UX artifact (web page, scene, UI) pushed until it holds up against a named real-world reference. Expensive — not for small fixes, configs, scripts or anything without a reference to compare against.
---

# Gauntlet loop

Builder staví, **slepý kritik** porovnává se skutečným vzorem, opakuje se, dokud to neobstojí nebo nedojdou kola. Postup podle Matta Shumera, zkrocený stropy.

**Laťka se během běhu nemění.** Když část nedosáhne, výsledek je FAIL a tak se i ohlásí — ne „skoro PASS“.

## Role

| Role | Kdo | Vidí |
|---|---|---|
| Lead | hlavní turn | všechno; rozděluje, fotí, míchá X/Y |
| Builder | `implementer-multi` | cíl části, laťku, verdikt kritika z minulého kola |
| Kritik | `gauntlet-critic` | jen dva obrázky X/Y a kritéria |

## Postup

1. **Izolace.** Vlastní worktree z hlavní větve — rozdělaná práce v hlavním checkoutu se nesmí dotknout. Pracovní soubory do `.gauntlet/` (dej do `.git/info/exclude`).
2. **Plán** (`.gauntlet/plan.md`): cíl, vzor (URL nebo snímek), 2–4 části. Každá část: soubory, které smí měnit, **3–5 kritérií viditelných na snímku**, scénář snímku (URL, `--eval`, čekání).
3. **Vzor nafoť jednou** a dál ho nepřefocuj:
   `node ~/.claude/skills/gauntlet-loop/snimky.mjs <url> .gauntlet/vzor-<cast>.png --wait 8000`
   (bez npm: `PLAYWRIGHT_PATH=<jiny-projekt>/node_modules/playwright`)
4. **Kolo pro část** (max **3 kola**):
   1. Builder implementuje a commitne. Dostane verdikt z minulého kola, ne historii.
   2. Lead pustí testy projektu a jeho vlastní kontroly. Spadnou → kolo se počítá, zpět builderovi s chybou, kritik se nevolá.
   3. Lead nafotí stav stejným scénářem, **hodí mincí**, kdo je X a kdo Y (`node -e 'console.log(Math.random()<.5)'`), a zapíše si to do `.gauntlet/log.md`.
   4. Kritik dostane jen dvě cesty a kritéria.
   5. **PASS** = náš snímek vyhrál nebo remízoval ve **všech** kritériích. Jinak builder dostane tabulku a slabinu našeho snímku (přeloženou z X/Y).
5. **Souběh:** nejvýš 3 části naráz a jen když nesdílí soubory. Jinak po jedné.
6. **Konec:** tabulka částí (PASS/FAIL, kola, snímky před/po) uživateli. Merge až po jeho souhlasu.

## Časté chyby

| Chyba | Proč vadí |
|---|---|
| Kritik ví, který snímek je náš | Přestane být slepý, začne fandit |
| Kritérium „vypadá profesionálně“ | Nejde rozhodnout ze snímku → remízy zadarmo |
| Builder dostane celou historii | Ladí argumenty, ne výsledek |
| Po 3. kole „ještě jedno“ | Strop je důvod, proč to je levné; další kolo jen se souhlasem |
| Vzor přefocený v půlce | Laťka se posunula |
| Jeden verdikt kritika brán jako pravda | Kritik kolísá (stejná hloubka jednou remíza, podruhé prohra). Změna verdiktu u kritéria, na které builder nesáhl, je šum — zapiš to do logu |
| Mantinel „nesahej na X“ jen v promptu | Builder sdílené moduly mění pro všechny režimy. Lead nafotí i to, co se měnit nemělo, a porovná s hlavní větví |
| Dev server pustit s výchozím timeoutem | Na pozadí po 30 min umře uprostřed kola. Pusť ho s maximálním timeoutem |
| `gauntlet-critic` čerstvě vytvořený | Agent se načte až po restartu session; do té doby `general-purpose` + `model: sonnet` + tělo role z `agents/gauntlet-critic.md` |
