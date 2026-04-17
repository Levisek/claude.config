# Refactor report — 2026-04-17

Globální `~/.claude/` setup refaktorován z monolitického `CLAUDE.md` do progressive-disclosure skills. Zdroj plánu: `~/.claude/plans/zazzy-wibbling-sky.md` (schváleno v Plan Mode).

## Co se změnilo

| Oblast | Před | Po |
|--------|------|----|
| `CLAUDE.md` | 39 ř., 7 sekcí (cross-project + tech-specific) | 35 ř., 5 sekcí — **jen cross-project + process safety** |
| Skills (vlastní) | `visual-audit` | `visual-audit` + `electron-security` + `typescript-strict` + `i18n-texts` + `design-tokens` + `tsc-verification` |
| Skills (externí) | — | `trailofbits/` sparse clone (4 pluginy) |
| `visual-audit/SKILL.md` | 156 ř., monolitické | 78 ř., odkazy do `references/` |

## Nové skills — trigger přehled

| Skill | Trigger (`Use when …`) | Negative example (`Do NOT use …`) |
|-------|------------------------|----------------------------------|
| `electron-security` | Práce na Electron aplikaci (electron v deps, main.ts, BrowserWindow) | Regular web app, Node.js CLI, Tauri/Neutralino/NW.js |
| `typescript-strict` | Úprava `.ts`/`.tsx` v projektu s tsconfig.json | Plain `.js`, `.d.ts` declaration, projekt bez tsconfig |
| `i18n-texts` | UI komponenty v projektu s i18n lib nebo `locales/` | Backend, CLI, logy, error messages, projekt bez i18n |
| `design-tokens` | CSS/SCSS/styled/Tailwind v projektu s token systémem | 3rd-party libs, initial token-scheme design, throwaway prototypes |
| `tsc-verification` | **Konec** série změn v TS projektu → `npx tsc --noEmit` | Triviální single-line edity, read-only ops, mid-refactor |

## visual-audit struktura (před/po)

**Před:**
```
visual-audit/
├── SKILL.md (156 ř.)
├── checklist.yaml
├── electron.yaml
├── report-template.md
└── runner/
```

**Po:**
```
visual-audit/
├── SKILL.md (78 ř., "Use when…" description, allowed-tools)
├── CHANGELOG.md              # deprecated _electron.launch doktrína
├── rules/
│   ├── checklist.yaml        # V001–V099
│   └── electron.yaml         # E001–E099
├── references/
│   ├── electron-setup.md     # CDP protokol
│   ├── safe-launch.md        # ⚠️ incident 2026-04-14 pravidla
│   └── report-template.md
└── scripts/
    ├── package.json
    └── run.mjs
```

Git zachoval historii přes `git mv`-style rename detection (6 renames v commitu).

## Skills, které NELZE automatizovat (manuální kroky)

### Superpowers (Jesse Vincent, claude-plugins-official)

Plugin se instaluje přes interaktivní slash command v Claude Code session — nelze spustit z Bash. Spusť v libovolné Claude Code session:

```
/plugin install superpowers@claude-plugins-official
```

Po instalaci:
1. `/plugin list` — ověř, že je nainstalovaný
2. Test: `/superpowers:brainstorm` s triviálním zadáním (např. „pojmenuj mi proměnnou")
3. Zkontroluj v `~/.claude/plugins/` že se tam vytvořilo

### Trail of Bits — ověření

```bash
ls ~/.claude/skills/trailofbits/plugins/
# Očekávaný výstup: insecure-defaults, semgrep-rule-creator, static-analysis, supply-chain-risk-auditor
```

Hotovo během refaktoru, ale stojí to za znovuověření po restartu session (skills loader může cachovat).

## Známé issues / co zbývá

1. **Superpowers install** — viz výše, manuální krok.
2. **Skill descriptions trigger quality** — `description` polsko je klíčové, ale skutečný trigger depends na LLM heuristikách. Až budou reálné use cases, chtělo by to validovat, jestli Claude skills správně invoke. Pokud ne, iterovat `description` (víc konkrétních triggerů, víc negative examples).
3. **visual-audit `scripts/run.mjs`** — 707 řádků, nebyl součástí refaktoru (jen přesun). Případný audit / refactor samostatně.
4. **Portabilita install skriptu** (TODO Priorita 1) — nedotčena refaktorem. Hardcoded cesty `~/.claude` v některých skriptech.
5. **Další slash commandy** (TODO Priorita 3 kandidáti: `/review`, `/secrets`, `/deadcode`, `/race`) — nereplaced, pro budoucí iteraci.

## Další kroky z TODO.md

- **Priorita 1** — portabilita (install skript, detekce `$USERPROFILE`)
- **Priorita 2** — Trail of Bits integrace do `/audit` commandu (graceful fallback když trailofbits/ neexistuje)
- **Priorita 3** — další skill sety (Superpowers výše, potenciálně i jiné z agentskills.io)
- **Priorita 4** — session continuity (claude-session-restore repo)

## Rollback

Pokud něco nefunguje:

```bash
# CLAUDE.md rollback
cp ~/.claude-config/backup/CLAUDE.md.pre-refactor-2026-04-17.md ~/.claude/CLAUDE.md

# Celý refaktor rollback (v git)
cd ~/.claude-config
git revert HEAD       # jen commit refaktoru
# Pak mirror-copy zpátky do ~/.claude/:
cp CLAUDE.md ~/.claude/
# ... a podobně pro skills
```

## Verifikace checklist

- [x] `~/.claude/CLAUDE.md` ≤ 35 ř., jen cross-project pravidla + procesy
- [x] 5 nových skills má `Use when…` + `Do NOT use…` v description
- [x] 5 nových skills má `allowed-tools`
- [x] 5 nových SKILL.md je ≤ 56 řádků
- [x] `visual-audit/SKILL.md` ≤ 78 ř. (sekce 5, 6, 7 přesunuty)
- [x] `visual-audit/` má `rules/`, `references/`, `scripts/`, `CHANGELOG.md`
- [x] Trail of Bits: 4 pluginy v `skills/trailofbits/plugins/`
- [x] `~/.claude-config/` clone OK, commit vytvořen
- [ ] **Push na origin** — čeká se na user potvrzení (shared-state action)
- [ ] Superpowers install — **manuální**, viz výše
