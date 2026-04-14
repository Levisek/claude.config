---
description: Spustí TypeScript compile check a ohlásí chyby kompaktně
---

Zkompiluj TypeScript projekt v aktuálním pracovním adresáři a ohlas výsledek.

## Postup

1. Ověř, že v cwd existuje `tsconfig.json` (přes Read nebo Glob). Pokud ne, ohlas uživateli jednu větu "Tady není TypeScript projekt (chybí tsconfig.json)." a skonči.
2. Spusť přes Bash: `npx tsc --noEmit` (bez výstupu do souborů, jen kontrola).
3. Vyhodnoť výstup:
   - **Čisté (exit 0, žádný output)** → odpověz jednou větou: `✓ tsc prošel bez chyb`
   - **Chyby** → spočítej řádky obsahující `error TS`, zobraz:
     ```
     ✗ tsc selhal: N chyb
     
     Top 5:
     - path/to/file.ts:12:5 — error TSxxxx: popis
     - ...
     ```
     Pokud chyb víc než 5, přidej řádek `... a dalších N chyb`.

## Pravidla

- Neopravuj chyby, jen reportuj — uživatel rozhodne co dál.
- Nenavrhuj řešení, pokud si je uživatel nevyžádá.
- Časový limit: 120 s (defaultní Bash timeout stačí pro většinu projektů).
