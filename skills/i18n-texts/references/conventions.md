# i18n konvence klíčů a fallback strategie

## Struktura klíčů

Používej tečkou-oddělené hierarchie odpovídající UI struktuře:

```
auth.login.title             "Přihlášení"
auth.login.email             "E-mail"
auth.login.submit            "Přihlásit se"
auth.login.errors.invalid    "Neplatné přihlašovací údaje"

dashboard.widgets.stats.title       "Statistiky"
dashboard.widgets.stats.empty       "Žádná data k zobrazení"
```

## Typy klíčů

| Úroveň | Účel | Příklad |
|--------|------|---------|
| **Root (první segment)** | Feature / page | `auth`, `dashboard`, `settings` |
| **Sub-segment** | Komponenta / sekce | `login`, `stats`, `profile` |
| **Leaf** | Konkrétní text | `title`, `submit`, `empty` |

Pro globální texty (actions, common) použij root `common.`:

```
common.actions.save          "Uložit"
common.actions.cancel        "Zrušit"
common.actions.delete        "Smazat"
common.status.loading        "Načítám…"
common.status.error          "Chyba"
```

## Interpolace

```
"greeting": "Ahoj, {name}!"         // použij {placeholder} syntaxi dle lib
"items.count": "{count, plural, =0 {žádné} one {# položka} few {# položky} other {# položek}}"
```

Česká pluralizace vyžaduje ICU plural forms — pokud lib nepodporuje, dokumentuj to v komentáři v language file.

## Fallback strategie

- Fallback jazyk je vždy **ten, který má nejkompletnější překlad** (obvykle `cs` nebo `en` dle projektu).
- Missing key → v dev módu log warning, v prod zobraz klíč (neselhávat).
- Pro staging: nastav i18n lib aby missing keys byly **viditelné** (např. prefix `[MISSING: foo.bar]`) — snadnější review před releasem.

## Anti-patterny

### Stringy lepené z více klíčů

```
// ŠPATNĚ
<p>{t('greeting')} {user.name}!</p>

// LEPŠÍ
<p>{t('greeting.withName', { name: user.name })}</p>
```

Důvod: v jiných jazycích může být slovosled jiný.

### Klíče podle obsahu, ne podle funkce

```
// ŠPATNĚ
t('ulozit')

// LEPŠÍ
t('common.actions.save')
```

### Podmíněné překlady přes ternary

```
// ŠPATNĚ
{isEditing ? 'Upravit' : 'Přidat'}

// LEPŠÍ
{t(isEditing ? 'form.edit' : 'form.add')}
```
