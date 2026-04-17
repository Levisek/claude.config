# VISUAL-AUDIT — {{PROJEKT_NAZEV}}

> Runtime vizuální audit · {{DATUM}} · git `{{GIT_SHA}}` · {{TYP_CILE}}

---

## 0. SOUHRN

```
╭─ severity ──────────────────────────────────╮
│  🔴 {{POCET_KRITIK}} kritik                 │
│  🟡 {{POCET_UPOZORNENI}} upozornění         │
│  🟢 {{POCET_OK}} OK                         │
│                                             │
│  zábrana releasu: {{ANO_NE}}                │
╰─────────────────────────────────────────────╯

╭─ pokrytí ───────────────────────────────────╮
│  viewporty:  375  768  1024  1440           │
│  dark mode:  {{ANO_NE}}                     │
│  a11y tree:  axe-core {{AXE_VERZE}}         │
│  electron:   {{ELECTRON_VERZE_NEBO_N_A}}    │
╰─────────────────────────────────────────────╯
```

---

## 1. 🔴 KRITICKÉ ({{POCET_KRITIK}})

<!-- Pro každý nález: -->

### {{ID_PRAVIDLA}} · {{NAZEV_PRAVIDLA}}

**Kde:** `{{FILE_PATH}}:{{LINE}}`
**Viewport:** {{VIEWPORT}}
**Naměřeno:** {{NAMERENO}}
**Očekáváno:** {{OCEKAVANO}}

![before]({{.audit/screenshots/{{ID}}_before.png}})

**Fix:**
```{{JAZYK}}
{{NAVRH_OPRAVY}}
```

---

## 2. 🟡 UPOZORNĚNÍ ({{POCET_UPOZORNENI}})

<!-- Stejná struktura jako §1, ale zkrácená (stačí 1 screenshot) -->

---

## 3. 🟢 OK ({{POCET_OK}})

<details>
<summary>Prošlo bez problému (klikni pro seznam)</summary>

| ID | Pravidlo | Kategorie |
|----|----------|-----------|
| V001 | Každý obrázek má alt | a11y |
| V002 | Právě jeden h1 | a11y |
| ... | ... | ... |

</details>

---

## 4. 📦 ELECTRON

<!-- Jen pokud cíl = Electron app. Jinak tuto sekci vynech. -->

```
╭─ electron specific ─────────────────────────╮
│  oken screenshotováno:  {{POCET_OKEN}}      │
│  CSP violations:        {{POCET_CSP}}       │
│  IPC stall > 500ms:     {{POCET_STALL}}     │
│  zoom levels OK:        {{ZOOM_OK}}/3       │
│  theme sync:            {{THEME_OK}}        │
╰─────────────────────────────────────────────╯
```

### Okna

| # | Titul | URL/route | Viewport | Screenshot |
|---|-------|-----------|----------|------------|
| 1 | {{TITUL_1}} | {{URL_1}} | {{VP_1}} | ![]({{SS_1}}) |
| ... | ... | ... | ... | ... |

---

## 5. METADATA

```yaml
timestamp: {{TIMESTAMP_ISO}}
git_sha: {{GIT_SHA}}
git_branch: {{BRANCH}}
git_dirty: {{DIRTY}}

runner:
  playwright: {{PLAYWRIGHT_VERZE}}
  chromium: {{CHROMIUM_VERZE}}
  electron: {{ELECTRON_VERZE_NEBO_N_A}}

checklist:
  verze: {{CHECKLIST_VERZE}}
  pravidel_celkem: {{POCET_PRAVIDEL}}
  pravidel_zkontrolovano: {{POCET_ZKONTROLOVANO}}
  ignorovano: {{POCET_IGNOR}}  # přes .visual-audit.ignore

prostředí:
  os: {{OS}}
  rozliseni: {{ROZLISENI}}
  dpi: {{DPI}}
```

---

*Generováno `/visual-audit` · Claude Code · jen pravda, žádné fráze.*
