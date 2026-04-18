---
name: roadmap
description: Use when the user wants to plan a new application or significant feature before coding. CZ triggers "udělej mi roadmapu", "naplánuj appku", "naplánuj to", "potřebuju plán na", "jak to postavit", "rozvrhni mi", "udělej mi plán na", "udělej mi roadmap". EN triggers "roadmap for building X", "plan for implementing X", "how should we build X". Do NOT use for one-line fixes, typos, hotfixes, "rychlovka", explaining existing code, config tweaks, or single-file bugfixes.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Skill, Task
---

# Roadmap

CZ wrapper nad Superpowers workflow. Od nápadu k detailnímu plánu, pak ke kódu — nikdy obráceně. Komunikuješ s uživatelem česky, interně voláš EN Superpowers skills.

## Core princip

**Žádný kód bez `.roadmap/PLAN.md`.** Pokud skill dotáhneš jen na brainstorm nebo scope, zastav. Plán musí odsouhlasit user.

## Workflow

1. **Detekuj rozsah** (SMALL / MEDIUM / LARGE). Viz `references/scope-detection.md`.
   - SMALL → ustup, doporuč rovnou Edit + `tsc-verification`. Nic nezakládej.
   - MEDIUM / LARGE → pokračuj.

2. **Založ `.roadmap/` v projektu** (workdir kde běží session):
   - Přidej `.roadmap/` do `.gitignore` pokud tam není (pokud je git repo).
   - Zapiš `.roadmap/SCOPE.md` — viz `references/artifacts.md`.

3. **Recovery check**: pokud `.roadmap/STATUS.md` už existoval před tímhle spuštěním, přečti ho a pokračuj od poslední uzavřené fáze místo znovuspuštění.

4. **Proveď fáze v pořadí** (deleguj na Superpowers skills):

   | Fáze | MEDIUM | LARGE | Skill |
   |------|--------|-------|-------|
   | Brainstorm | ✓ (short) | ✓ (full) | `superpowers:brainstorming` |
   | Plan | ✓ | ✓ | `superpowers:writing-plans` |
   | **GATE: user schvaluje PLAN.md** | ✓ | ✓ | — |
   | TDD | — | ✓ | `superpowers:test-driven-development` |
   | Execute | ✓ | ✓ | `superpowers:executing-plans` |
   | Verify | — | ✓ | `superpowers:verification-before-completion` |
   | Review | — | ✓ | `superpowers:requesting-code-review` |

5. **Po každé fázi** aktualizuj `.roadmap/STATUS.md` (fáze hotová, časové razítko, další na řadě).

6. **Gates** (hard stopy) — viz `references/gates.md`:
   - Nespouštěj `executing-plans` dokud `PLAN.md` neexistuje a user ho neodsouhlasil.
   - U LARGE nespouštěj execute bez TDD setupu.
   - Pokud user chce fázi přeskočit, zaznamenej do `.roadmap/SKIPPED.md` s důvodem a pokračuj.

## Artefakty v `.roadmap/`

| Soubor | Obsah |
|--------|-------|
| `SCOPE.md` | Detekovaný rozsah + heuristika která ho určila |
| `BRAINSTORM.md` | Otázky a odpovědi z brainstorming fáze |
| `PLAN.md` | Atomické úkoly (2–5 min každý) z writing-plans |
| `STATUS.md` | Aktuální fáze, dokončené fáze, timestamp |
| `SKIPPED.md` | Log fází co user explicitně odmítl + důvod |

Šablony: `references/artifacts.md`.

## Integrace s ostatními skills

- **Electron projekt** — respektuj `electron-security` během plánu i execute.
- **TypeScript projekt** — plán musí zohlednit `typescript-strict`, po executu volej `tsc-verification`.
- **UI/frontend** — v fázi QA volej `visual-audit` pro runtime check.
- **i18n / design-tokens** — pokud projekt má systém, plán musí počítat s tím že texty a styly jdou přes tokeny.

## Red flags — STOP

- Začneš psát kód bez `.roadmap/PLAN.md` → smaž kód, vrať se k plánu.
- Claim „je to triviální, plán netřeba" u MEDIUM/LARGE → to je rationalizace, pokračuj v workflow.
- User řekne „jen to udělej" bez plánu u LARGE → vysvětli že bez plánu se to rozpadne, nabídni SMALL downgrade nebo gate skip (s logem).
- Přeskočíš gate bez zápisu do `SKIPPED.md` → porušení. Zapiš a pokračuj.

## Když se k workflow nehodí

- SMALL scope (jediný soubor, <30 řádků, jasné zadání) → skill ustup, žádné artefakty.
- User říká „rychlovka" / „hotfix" / „jen to spravit" → SMALL, žádná roadmap.
- User explicitně říká „bez plánu" → zeptej se proč, pokud trvá → `SKIPPED.md` log celé roadmap a pokračuj s obyčejným workflow.
