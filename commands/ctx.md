---
description: Načti kontext aktuálního projektu — package, CLAUDE.md, git, tsc, TODO. Full load.
---

# CTX — Full Context Load

Načti kompletní stav aktuálního projektu. Cíl: mít v hlavě vše, než začneš pracovat.

## Postup (všechno paralelně kde to jde)

### 1. Projekt identifikace
- `package.json` → name, version, scripts, deps přehled (Electron / Next / Vite / RN / none)
- `tsconfig.json` → existuje? strict mode?
- `index.html` v rootu → vanilla web?
- `GRAL.md` → GRAL framework projekt?
- Přečti prvních 80 řádků `CLAUDE.md` (pokud je) — extrahuj **Pravidla**, **TODO**, **Hotovo**, **Bugy / known issues**

### 2. Git stav (paralelně)
- `git branch --show-current`
- `git status --short`
- `git log --oneline -5`
- `git rev-list --count @{u}..HEAD 2>/dev/null`
- `git rev-list --count HEAD..@{u} 2>/dev/null`

### 3. TypeScript (pokud TS projekt)
- `npx tsc --noEmit` → OK / N chyb

### 4. Strukturální scan (Glob)
- `src/**/*.{ts,tsx}` — počet TS souborů
- `**/*.{test,spec}.{ts,tsx,js}` — počet testů
- CSS souborů, existence `dist/`, `node_modules/`

### 5. TODO / FIXME v kódu
- Grep `TODO|FIXME|XXX|HACK` v src/ (jen počet + top 3)

## Výstup

Začni figlet bannerem s **názvem projektu** (ne „CTX"). Použij **ANSI Shadow** figlet font (blokový styl s `█`, `╗`, `═`, `║`, `╔`, `╝`, `╚`) — je výrazně čitelnější než slant nebo jiné fonty. Umísti do markdown code blocku. Název zkrať na uppercase bez diakritiky, max 14 znaků.

**Referenční ukázka ANSI Shadow fontu pro slovo "CTX":**

```
 ██████╗████████╗██╗  ██╗
██╔════╝╚══██╔══╝╚██╗██╔╝
██║        ██║    ╚███╔╝
██║        ██║    ██╔██╗
╚██████╗   ██║   ██╔╝ ██╗
 ╚═════╝   ╚═╝   ╚═╝  ╚═╝
```

**Ukázka pro "FPLPRO":**

```
███████╗██████╗ ██╗     ██████╗ ██████╗  ██████╗
██╔════╝██╔══██╗██║     ██╔══██╗██╔══██╗██╔═══██╗
█████╗  ██████╔╝██║     ██████╔╝██████╔╝██║   ██║
██╔══╝  ██╔═══╝ ██║     ██╔═══╝ ██╔══██╗██║   ██║
██║     ██║     ███████╗██║     ██║  ██║╚██████╔╝
╚═╝     ╚═╝     ╚══════╝╚═╝     ╚═╝  ╚═╝ ╚═════╝
```

**Pravidla pro font:**
- Každé písmeno má **6 řádků** výšky.
- Mezery mezi písmeny = 1 znak (nikoli víc).
- Horní řádek začíná mezerou pokud písmeno začíná zaoblením (např. `C`, `G`, `O`, `Q`, `S`).
- Pokud nejsi jistý tvarem písmene, drž se charakteristik: vertikální čáry = `██` s `║`, horizontální = `═`, rohy = `╗╔╚╝`, plné výplně = `██`.

Pod banner připoj jednořádkový štítek:
```
<název> · <typ projektu> · <jazyk>   |   🌿 <branch> <±N ↑N ↓N / sync>   |   tsc: <stav>
```

Pak tyto markdown panely (bez ANSI):

````
╭─ rozděláno ──────────────────────────────────╮
│  ▸ <TODO 1>                                  │
│  ▸ <TODO 2>                                  │
│  ▸ <TODO 3>                                  │
╰──────────────────────────────────────────────╯

╭─ poslední commity ▁▂▄▆█▃▁ ───────────────────╮
│  • <hash> <subject>                          │
│  • <hash> <subject>                          │
│  • <hash> <subject>                          │
╰──────────────────────────────────────────────╯
````

Pokud existují known bugs:

````
╭─ bugy / known issues ────────────────────────╮
│  ▸ <bug 1>                                   │
│  ▸ <bug 2>                                   │
╰──────────────────────────────────────────────╯
````

Nakonec jeden řádek: `Systém načten. Co to bude?`

## Sparkline v řádku „poslední commity"

Vygeneruj sparkline z počtu změn (additions+deletions) posledních 10 commitů. Použij znaky `▁▂▃▄▅▆▇█`. Oldest vlevo, newest vpravo. Pokud jsou všechny commity malé, přesto ukaž relativní rozdíly.

## Pravidla výstupu

- Čti paralelně kde to jde.
- Pokud něco chybí — řekni to v baru (`░`), ne v error textu.
- Nekopíruj obsah souborů do odpovědi — jen shrň.
- „Rozděláno" = max 3 položky, priorita: TODO v CLAUDE.md > FIXME v kódu > dirty git files.
- „Bugy" = sekce „Bugy" / „Known issues" v CLAUDE.md, max 3, panel vynech pokud žádné.
- Celý výstup česky, stručně.
- Rámečky zarovnej — každý řádek uvnitř rámečku má stejnou šířku.

## Pokud není git repo ani package.json

Banner skript to už detekuje (typ `none`, git = „není git repo"). Po banneru jen napiš: `Složka není projekt ani git repo. Neřeším dál.` a skonči.
