---
description: Rychlý přehled Claude Code — co umí, co napsat, kam dál
---

# /welcome — onboarding pro Claude Code

Ukaž novému uživateli krátký, přehledný rozcestník. Česky, stručně, vlídně. Max 40 řádků.

## Formát výstupu — pevně daný

````
 __    __ ___  __    ___  ___  __  __  _____
/\ \/\ \\  __)/\ \  / __)/ _ \/\ \/\ \/\   /
\ \ \_/ /\ \_/\ \ \_\__ \\ \_\ \ \ \_\ \ \/ 
 \ \___/  \__/ \ \_____/ \___/\ \_\ \_\_\/  
  \/__/         \/___/        \/_/\/_/      

Vítej v Claude Code.
````

Pak tři unicode rámečky pod sebou:

````
╭─ co to umí ──────────────────────────────────────────╮
│  ▸ Čte, píše a edituje soubory v projektu            │
│  ▸ Spouští shell příkazy, testy, build               │
│  ▸ Rozumí git — commit, push, review, merge          │
│  ▸ Hledá v kódu, refaktoruje, opravuje bugy          │
╰──────────────────────────────────────────────────────╯

╭─ užitečné commandy ──────────────────────────────────╮
│  /ctx        Načte plný kontext aktuálního projektu  │
│  /status     Kompaktní panel — git + tsc stav        │
│  /commit     Navrhne a commitne změny                │
│  /push       Bezpečný git push s kontrolami          │
│  /theme      Přepne vizuální styl (default/nerd/...) │
│  /iq         Přepne reasoning effort (60/75/99)      │
╰──────────────────────────────────────────────────────╯

╭─ tipy pro nováčky ───────────────────────────────────╮
│  ▸ Piš česky nebo anglicky — rozumí obojímu          │
│  ▸ Destruktivní příkazy (rm -rf, force push) jsou    │
│    zablokované — uvidíš červený rámeček se zprávou.  │
│  ▸ Editace citlivých souborů (.pem, .ssh, .aws) je   │
│    zakázaná — upravuj je ručně mimo Claude.          │
│  ▸ Status pod promptem ukazuje git + tsc live.       │
│  ▸ Pro vypnutí welcome tipu v banneru: edituj pole   │
│    banner.showWelcomeTip v ~/.claude/theme-config    │
╰──────────────────────────────────────────────────────╯

Tak do toho! Napiš co potřebuješ.
````

## Pravidla

- Vždy vypiš přesně v tomto pořadí: ASCII banner → „co to umí" → „užitečné commandy" → „tipy pro nováčky" → závěrečná věta.
- Každý rámeček zarovnej — všechny řádky uvnitř stejnou šířku.
- Max 40 řádků celkem.
- Česky, přátelsky, bez přezdívek a zkratek.
- Žádné další otázky na konci — jen ten závěrečný řádek „Tak do toho!".
- Nepoužívej ANSI barvy (nerenderují se v UI).
