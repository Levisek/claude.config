---
description: Krátký postmortem po dokončeném úkolu — zapíše "co bylo nečekané" do memory/surprises-<repo>.md
---

Po dokončeném úkolu zaznamenej, co se odlišilo od očekávání. Slouží jako prior pro budoucí odhady.

## Postup

### 1. Zjisti repo

Pomocí `lib/repo-name.js` (`resolveRepoName(process.cwd())`) urči kanonické jméno repa. Pokud máš shell, jednoduše:

```
node -e "console.log(require('C:/Users/admin/.claude/lib/repo-name.js').resolveRepoName())"
```

### 2. Zeptej se přes AskUserQuestion (2 otázky)

**Otázka 1:** „Co bylo nečekané? (1–2 věty)" — multiSelect: false, options:
- **Zapsat odpověď** — uživatel napíše text
- **Přeskočit** — neukládat nic

**Otázka 2:** (jen pokud Q1 ≠ Přeskočit) „Estimate vs actual? (volitelné — např. `15min / 40min`)" — options:
- **Zapsat čas** — uživatel napíše
- **Nevím / přeskočit**

### 3. Zápis

Soubor: `C:/Users/admin/.claude/memory/surprises-<repo>.md`

Pokud neexistuje, vytvoř s frontmatter (kompatibilní s auto-memory schématem):

```markdown
---
name: surprises-<repo>
description: Postmortem surprises pro repo <repo> — co se odlišilo od očekávání
metadata:
  type: project
---

Per-repo postmortem log. Každý bullet = jedno překvapení.

```

Pak appendni nový bullet **na konec souboru** ve formátu:

```
- {YYYY-MM-DD}: {surprise text} (estimate: {est}, actual: {actual})
```

Pokud user neuvedl čas, vynech závorkovou část:

```
- {YYYY-MM-DD}: {surprise text}
```

Datum vezmi z `currentDate` kontextu (dnešní datum).

### 4. Report

Po úspěšném zápisu vypiš jen:

```
✓ Zapsáno do memory/surprises-<repo>.md
```

## Pravidla

- Pokud user řekl „Přeskočit" v Q1, **nic nezapisuj** a tiše skonči.
- Neukládej shrnutí celého úkolu — jen překvapení (zboční signál pro budoucí kalibraci).
- Soubor se pak konzumuje přes `hooks/detect-triggers.js` při planning fázi (top 5 nejnovějších bullets).
- Neukládej věci derivovatelné z git logu / kódu — jen co se odlišilo od **odhadu**.
