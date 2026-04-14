---
description: Načti kontext aktuálního projektu — package, CLAUDE.md, git, tsc, TODO. Full load.
---

# CTX — Full Context Load

Načti kompletní stav aktuálního projektu. Cíl: mít v hlavě vše, než začneš pracovat.

## Postup (všechno paralelně kde to jde)

### 1. Projekt identifikace
- `package.json` → name, version, description, scripts, deps přehled (Electron / Next / Vite / RN / none)
- `tsconfig.json` → existuje? strict mode?
- `index.html` v rootu → vanilla web?
- `GRAL.md` → GRAL framework projekt?
- Přečti prvních 80 řádků `CLAUDE.md` (pokud je) — extrahuj **Pravidla**, **TODO**, **Hotovo**, **Bugy / known issues**

### 2. Git stav (paralelně)
- `git branch --show-current`
- `git status --short`
- `git log --oneline -5` (posl. 5 commitů)
- `git rev-list --count @{u}..HEAD 2>/dev/null` (ahead)
- `git rev-list --count HEAD..@{u} 2>/dev/null` (behind)

### 3. TypeScript (pokud TS projekt)
- `npx tsc --noEmit` → OK / N chyb

### 4. Strukturální scan (Glob)
- Počet TS souborů: `src/**/*.{ts,tsx}`
- Počet testů: `**/*.{test,spec}.{ts,tsx,js}`
- Počet CSS souborů
- Existence `dist/`, `node_modules/`

### 5. TODO / FIXME v kódu
- Grep `TODO|FIXME|XXX|HACK` v src/ (jen počet + top 3)

## Výstup

Po načtení vypiš v tomto formátu:

```
 ██████╗████████╗██╗  ██╗
██╔════╝╚══██╔══╝╚██╗██╔╝
██║        ██║    ╚███╔╝
██║        ██║    ██╔██╗
╚██████╗   ██║   ██╔╝ ██╗
 ╚═════╝   ╚═╝   ╚═╝  ╚═╝

Full Context Load — <název projektu z package.json nebo název složky>

Nacitam projekt...

[<bar>] Projekt       <typ: Electron/Node/Vanilla/RN/Python/…>
[<bar>] CLAUDE.md     <řádků / sekcí>
[<bar>] Zavislosti    <X prod / Y dev>
[<bar>] TypeScript    <OK / N chyb / N/A>
[<bar>] Zdrojaky      <X souboru / Y testu>
[<bar>] Git           <branch / ahead N, behind M / sync>

─────────────────────────────────────────

Rozdelano:
▸ <první TODO položka z CLAUDE.md nebo kódu>
▸ <druhá>
▸ <třetí>

Posledni commity:
• <hash> <subject>
• <hash> <subject>
• <hash> <subject>

Bugy / known issues:
▸ <z CLAUDE.md, max 3>

System nacten. Co to bude?
```

## Pravidla progress barů

- Každý bar 10 znaků: `█` = OK, `░` = chybí/problém
- **Projekt:** detekováno jasně → ██████████, nejasné → ██████░░░░
- **CLAUDE.md:** existuje a >50 řádků → ██████████, existuje kratší → ███████░░░, chybí → ░░░░░░░░░░
- **Závislosti:** node_modules existuje a package-lock.json aktuální → ██████████, chybí node_modules → ████░░░░░░
- **TypeScript:** tsc čisté → ██████████, N chyb → dle poměru, není TS → N/A (░░░░░░░░░░)
- **Zdrojáky:** jen info, bar reflektuje pokrytí testy (testů >10% souborů → ██████████)
- **Git:** sync s upstream → ██████████, ahead → ████████░░, dirty → ██████░░░░, detached → ███░░░░░░░

## Pravidla výstupu

- Čti paralelně kde to jde (package.json + CLAUDE.md + git současně)
- Pokud něco chybí — řekni to v baru (░), ne v error textu
- Nekopíruj obsah souborů do odpovědi — jen shrň
- "Rozdělano" = max 3 položky, priorita: TODO v CLAUDE.md > FIXME v kódu > dirty git files
- "Bugy" = sekce "Bugy" nebo "Known issues" v CLAUDE.md, max 3
- Celý výstup česky, stručně

## Pokud není git repo ani package.json

Vypiš:
```
[░░░░░░░░░░] Neni to projekt / repo
```
A skonči. Nenavrhuj akce.
