---
description: Přepne vizuální styl Claude Code (default / nerd / plain)
argument-hint: default | nerd | plain
---

# /theme — přepínač vizuálního stylu

Přepne aktivní téma v `~/.claude/theme-config.json`. Nové téma se projeví okamžitě ve statusLine, postupně v dalších bannerech a boxech.

## Argumenty

- `default` (výchozí) — unicode rámečky `╭─╮│╰─╯`, emoji, ANSI barvy
- `nerd` — unicode + Powerline ikony (``, `` atd.), vyžaduje Nerd Font v terminálu
- `plain` — ASCII-only (`+-+|+-+`, `v`, `x`), bez barev — pro TTY bez unicode podpory

Pokud argument není zadán nebo je neznámý, ukaž aktuální téma + nápovědu.

## Postup

### 1. Přečti aktuální config
- Cesta: `C:/Users/levingerm/.claude/theme-config.json`
- Parse JSON → aktuální `theme` hodnota

### 2. Pokud je argument zadán a validní (default/nerd/plain)
- Updatuj pole `theme` v configu (zachovej ostatní pole beze změny)
- Zapiš zpátky jako pretty JSON (2 mezery indent)
- Vypiš potvrzení + preview

### 3. Pokud není argument
- Jen vypiš aktuální téma + seznam možností

## Formát výstupu — po změně

````
╭─ theme · <nové-téma> ────────────────────────╮
│  ✓ Přepnuto z <staré> na <nové>              │
│                                              │
│  Preview:                                    │
│    <ukázka boxu v novém stylu>               │
│    <řádek s check/arrow/info znakem>         │
│                                              │
│  ℹ  Restart session pro plný efekt.          │
╰──────────────────────────────────────────────╯
````

## Formát výstupu — když není argument

````
╭─ theme ──────────────────────────────────────╮
│  Aktivní:  <aktuální-téma>                   │
│                                              │
│  Dostupné:                                   │
│    • default  unicode + barvy                │
│    • nerd     + Powerline ikony              │
│    • plain    ASCII-only                     │
│                                              │
│  Použij: /theme <název>                      │
╰──────────────────────────────────────────────╯
````

## Preview glyphs podle tématu

- `default`: `╭─╮  ✓  ▸  ℹ   🌿  sep: ·`
- `nerd`: `╭─╮  \uf00c  \uf061  \uf05a  \ue0a0  sep: \ue0b1`
- `plain`: `+-+  v  >  i  [git]  sep: |`

## Pravidla

- Pokud `theme-config.json` neexistuje, vytvoř ho s default strukturou:
  ```json
  {
    "theme": "default",
    "statusLine": {
      "segments": ["project", "git", "tsc", "context", "cost"],
      "separator": "default"
    },
    "banner": {
      "showFiglet": true,
      "showWelcomeTip": true
    }
  }
  ```
- Nikdy nepřepisuj jiná pole než `theme`.
- Pokud je argument neznámý, nedělej změnu a vypiš seznam možností.
- Česky.
