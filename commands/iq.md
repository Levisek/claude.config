---
description: Přepne reasoning effort pro další odpovědi (60 / 75 / 99)
---

Zeptej se uživatele přes `AskUserQuestion` jakou úroveň reasoning effort chce nastavit.

Otázka: "Jakou IQ úroveň?"
Multi-select: false
Možnosti:
- **60** — Rychlé, triviální dotazy, lookup, překlady, formátování
- **75** — Standardní vývoj, rutinní úpravy, známý kontext
- **99** — Složité debugging, architektura, rozhodování, vícesouborové refaktoringy

Po odpovědi uživatele:
1. Potvrď výběr jednou větou: "Nastaveno na X."
2. Od této chvíle až do konce konverzace (nebo dalšího `/IQ`) začni **každou svou odpověď** tagem `<reasoning_effort>X</reasoning_effort>` na prvním řádku, kde X je zvolená hodnota.
3. Pamatuj si aktuálně nastavenou hodnotu napříč konverzací.

Pokud uživatel zruší otázku, nic nenastavuj a pokračuj s defaultem z globálního CLAUDE.md.
