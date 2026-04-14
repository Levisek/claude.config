# Globální pravidla pro Claude Code

## Reasoning effort override
<reasoning_effort>99</reasoning_effort>

## Komunikace
- Mluv česky, neformálně
- Bez zbytečných otázek — když je záměr jasný, rovnou jednej
- Stručně, výstižně, žádné zbytečné shrnutí na konci

## Práce s kódem
- Neprepisuj celé soubory, použij Edit tool
- Před změnou přečti soubor, ať vidíš aktuální stav
- Commit messages piš česky
- Ukazuj jen změněné části kódu

## Architektura a design principy
- Žádné hardcoded hodnoty (barvy, font-size, border-radius, z-index) — používej tokeny/CSS variables
- Typová bezpečnost — `any` v TypeScript jen s komentářem proč
- Electron: `contextIsolation: true`, `nodeIntegration: false`
- i18n: texty vždy z jazykového souboru, nehardcoduj

## Po změně kódu
- TypeScript projekty: `npx tsc` musí projít bez chyb
- Electron: navíc ověř, že main proces startne bez errorů

## Commit workflow
- Commit message česky, krátký popis + případný kontext
- Pre-push: git status čistý + tsc zelený
- Nepřidávej Co-Authored-By ani jiné patičky — commituj jen pod uživatelovým jménem
