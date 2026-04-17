# visual-audit — CHANGELOG

## 2026-04-17 — Refactor do progressive disclosure

- SKILL.md zmenšen z 156 → ~50 řádků.
- Frontmatter description přepsaný do formátu "Use when … Do NOT use …".
- Přidán `allowed-tools: Bash, Read, Write, Edit, Glob, Grep`.
- Existující soubory přesunuty:
  - `checklist.yaml` → `rules/checklist.yaml`
  - `electron.yaml` → `rules/electron.yaml`
  - `report-template.md` → `references/report-template.md`
  - `runner/*` → `scripts/*`
- Nové references:
  - `references/electron-setup.md` (CDP protokol)
  - `references/safe-launch.md` (incident 2026-04-14 pravidla)
- Sekce 7 (deprecated `_electron.launch`) přesunuta sem, viz níže.

---

## Deprecated doktrína — archiv

Dříve (před Electron 41) používal skill `_electron.launch({ args: ['.'] })` pro startup Electron aplikací pod Playwright. Od Electron 41 edge case — main proces v některých aplikacích nedokončí startup když Playwright injektuje `--inspect=0 --remote-debugging-port=0`.

**Náhrada:** CDP connect protokol, viz `references/electron-setup.md`.

**Fallback:** Pokud `electron` v deps je **do v30 včetně**, `_electron.launch` je ještě bezpečný. Pro v31+ vždy CDP.
