---
description: Kompaktní souhrn git + tsc stavu projektu
---

Zobraz jednorázový kompaktní report o stavu repa.

## Postup

### 1. Shromáždi info paralelně (Bash)
- `git branch --show-current`
- `git status --short`
- `git log --oneline @{upstream}..HEAD 2>/dev/null` — ahead (pokud upstream)
- `git log --oneline HEAD..@{upstream} 2>/dev/null` — behind
- Pokud existuje `tsconfig.json` → `npx tsc --noEmit`

### 2. Format výstupu

Kompaktní, s emoji prefixy:
```
📍 <branch> (ahead N, behind M)
📝 X změn (a modified, b untracked, c staged)   -- nebo "✓ čistý strom"
✓ tsc OK                                        -- nebo ✗ tsc: N chyb
```

Řádky, které nejsou relevantní, vynech:
- Pokud není upstream → jen `📍 <branch> (no upstream)`
- Pokud ahead=0 behind=0 → `📍 <branch> (sync)`
- Pokud není TS projekt → vůbec neřeš tsc řádek

### 3. Rozšíření při chybách

**Pokud tsc failne** — pod základním výpisem přidej blok:
```
Chyby (top 5):
  - path/file.ts:12:5 — error TSxxxx: popis
  - ...
```

**Pokud je dirty tree** — pod základním výpisem přidej první 5 souborů:
```
Změny:
  M  src/app.ts
  A  new-file.md
  ?? untracked.txt
```

## Pravidla

- Read-only operace, žádné modifikace.
- Výstup musí být krátký a čitelný na jeden pohled — pokud se nevejde do 15 řádků, zkrať.
- Žádné otázky, žádné potvrzení — jen report a konec.
