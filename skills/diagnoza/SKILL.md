---
name: diagnoza
description: Diagnostická smyčka pro těžké chyby a výkonnostní regrese — nejdřív smyčka, která na té chybě zčervená, až pak hypotézy. Spouští se ručně přes /diagnoza (s popisem chyby), když první pokus o opravu nezabral nebo chyba není zjevná.
disable-model-invocation: true
argument-hint: "Co je rozbité a jak se to projevuje"
---

# Diagnóza

Převzato z `mattpocock/skills` (`diagnosing-bugs`, MIT), upraveno pro tyhle
stroje. Fáze přeskoč jen s výslovným důvodem.

Platí pravidla z `CLAUDE.md`, sekce *Ověřování* — tahle skill je jejich
pracovní postup, ne náhrada.

## Tajemství

Ve výstupech, které ukazuješ, nahraď každé tajemství `<REDACTED>`. Smyčku
stav nad proměnnými prostředí nebo souborem s právy 600, ne nad klíčem na
příkazové řádce (je vidět přes `ps`). Z zachycených požadavků cituj jen
řádky, které nesou signál — hlavičky `Authorization` ne.

## Fáze 1: Smyčka, která zčervená

**Tohle je celá skill.** Když máš rychlý signál projde/neprojde, který se
rozsvítí na *téhle* chybě, příčinu najdeš. Když ho nemáš, čtení kódu tě
nezachrání. Sem patří nejvíc úsilí.

Způsoby, zhruba v tomhle pořadí:

1. **Padající test** na nejbližším švu, který na chybu dosáhne.
2. **`curl` / HTTP skript** proti běžící službě (na serveru `localhost:<port>`).
3. **CLI s pevným vstupem** a `diff` proti známě dobrému výstupu.
4. **Headless prohlížeč** — jen izolovaná instance s vlastním
   `--user-data-dir` a portem (viz *Procesy a instance* v `CLAUDE.md`).
5. **Přehrání zachyceného** — uložit skutečný požadavek, log nebo databázi
   (u SQLite i s `-wal` a `-shm`) a přehrát mimo živý systém.
6. **Jednorázový harness** — minimální výřez systému, jedna funkce.
7. **Fuzz** — když je výstup „někdy špatně", 1000 náhodných vstupů.
8. **Bisekce** — chyba vznikla mezi dvěma stavy → `git bisect run`.
9. **Rozdílová smyčka** — stejný vstup přes starou a novou verzi, `diff`.
10. **Člověk ve smyčce** — až nakonec. Na serveru interaktivní skript
    nepoběží (stdin z `/dev/null`), takže uživateli dej **přesné kroky
    a co má poslat zpátky**, ne „zkus to".

**Prostředí, které to pak spustí.** Chyba v cronu se reprodukuje
v `env -i HOME=$HOME PATH=/usr/bin:/bin …`, chyba v kontejneru přes
`sudo -n docker logs`, ne ve vlastním shellu.

### Zúžit smyčku

- Rychleji: cache přípravy, jen relevantní část.
- Ostřeji: testuj konkrétní symptom, ne „nespadlo to".
- Deterministicky: zafixuj čas, seed, souborový systém, síť.

Smyčka na 30 s, která občas lže, je jen o málo lepší než žádná.

### Nedeterministické chyby

Cíl není čistá reprodukce, ale **vyšší míra reprodukce**: spouštět 100×,
paralelně, pod zátěží, se vsunutými prodlevami. 50 % se ladit dá, 1 % ne.

### Když smyčka postavit nejde

Řekni to nahlas, vyjmenuj, co jsi zkusil, a požádej o: přístup k prostředí,
kde se to děje; zachycený artefakt (log, výpis, HAR — bez tajemství); nebo
souhlas s dočasnou instrumentací. **Bez smyčky nehypotetizuj.**

### Hotovo, když

Umíš jmenovat **jeden příkaz**, který jsi **už aspoň jednou spustil**
(ukaž ho i výstup) a který je:

- [ ] **schopný zčervenat** — jde skutečnou cestou chyby a testuje přesně
      symptom, který popsal uživatel;
- [ ] **deterministický** — pokaždé stejný verdikt (u nestálých chyb
      ustálená vysoká míra reprodukce);
- [ ] **rychlý** — sekundy, ne minuty;
- [ ] **spustitelný bez člověka**.

Když se přistihneš, že čteš kód a stavíš teorii dřív, než tenhle příkaz
existuje — **stop.** Přesně tomu tahle skill brání.

## Fáze 2: Reprodukce a zmenšení

Spusť smyčku a sleduj, jak zčervená. Ověř:

- [ ] je to **chyba, kterou popsal uživatel**, ne jiná, co leží vedle;
- [ ] reprodukuje se opakovaně;
- [ ] máš zachycený přesný symptom (hláška, špatný výstup, čas).

Pak repro **zmenši**: odebírej vstupy, volající, konfiguraci a kroky po
jednom a po každém pusť smyčku znovu. Hotovo, když odebrání čehokoliv
zbylého udělá smyčku zelenou.

## Fáze 3: Hypotézy

**3–5 seřazených hypotéz** dřív, než kteroukoliv testuješ. Každá musí být
vyvratitelná:

> „Když je příčinou X, pak změna Y chybu odstraní / změna Z ji zhorší."

Hypotéza bez predikce je dojem — zahoď ji nebo zaostři.

**Seznam ukaž uživateli dřív, než testuješ** — často ví, že #3 se včera
měnila, nebo že #1 už vyloučil. Neblokuj na tom; když nereaguje, jeď podle
svého pořadí.

Než navrhneš příčinu, mrkni do trezoru (`💡 Poučení/`, `📌 TODO.md`) —
mohlo to už jednou padnout.

## Fáze 4: Instrumentace

Každá sonda odpovídá jedné predikci z fáze 3. **Jedna proměnná naráz.**

1. Debugger / REPL, když to prostředí umí.
2. Cílené logy na hranicích, které hypotézy rozliší.
3. Nikdy „logovat všechno a grepovat".

Každý ladicí výpis označ prefixem, třeba `[DEBUG-a4f2]` — úklid je pak jeden
grep. **Výkon:** logy tu obvykle lžou. Nejdřív základní měření, pak bisekce.

## Fáze 5: Oprava a regresní test

Regresní test piš **před opravou**, ale jen když existuje **správný šev** —
místo, kde test projde skutečným vzorem chyby tak, jak nastává u volajícího.
Když je jediný dostupný šev moc mělký, test by dal falešnou jistotu.
**Chybějící šev je sám nález** — zapiš ho.

1. Zmenšenou reprodukci převeď na padající test.
2. Sleduj, jak padá. Když jsi červenou vynutil úpravou kódu nebo fixture,
   `diff` proti nedotčené kopii ukáže, že se úprava opravdu projevila.
3. Oprav.
4. Sleduj, jak prochází.
5. Pusť smyčku z fáze 1 proti původnímu, nezmenšenému scénáři.

## Fáze 6: Úklid

- [ ] původní reprodukce už nereprodukuje (smyčka z fáze 1);
- [ ] regresní test prochází (nebo je zapsané, proč šev chybí);
- [ ] žádný `[DEBUG-…]` nezůstal (`grep` prefixu);
- [ ] jednorázové harnessy smazané nebo zřetelně odložené;
- [ ] hypotéza, která se potvrdila, je v commit message — ať se z ní učí
      příští ladění. Když stojí za zapamatování, i do `💡 Poučení/`.
