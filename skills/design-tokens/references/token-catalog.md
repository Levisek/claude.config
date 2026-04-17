# Token catalog — typické kategorie

Tahle reference je šablona, ne závazný set. Reálný token catalog projektu bývá v `tokens.css`, `theme.ts`, `tailwind.config.{js,ts}`, nebo podobně.

## Color tokens

```
--color-bg-base              // pozadí stránky
--color-bg-elevated          // karty, modály
--color-bg-sunken            // inputs, pre-tagy
--color-text-primary
--color-text-secondary
--color-text-muted
--color-border-default
--color-border-focus
--color-accent               // primary brand
--color-accent-hover
--color-danger
--color-warning
--color-success
```

## Spacing (obvykle step-based)

```
--space-0: 0;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;
--space-12: 48px;
--space-16: 64px;
```

## Font sizes

```
--font-size-xs:   12px;
--font-size-sm:   14px;
--font-size-md:   16px;
--font-size-lg:   18px;
--font-size-xl:   20px;
--font-size-2xl:  24px;
--font-size-3xl:  30px;
```

## Border radius

```
--radius-sm:   4px;
--radius-md:   8px;
--radius-lg:   12px;
--radius-full: 9999px;
```

## z-index scale

```
--z-base:     0;
--z-dropdown: 10;
--z-sticky:   20;
--z-overlay:  30;
--z-modal:    40;
--z-popover:  50;
--z-toast:    60;
--z-tooltip:  70;
```

Pravidlo: **nikdy** literální `z-index: 9999`. Pokud máš problém s vrstvením, přidej scale do tokenů.

## Shadows

```
--shadow-sm:  0 1px 2px rgba(0, 0, 0, .05);
--shadow-md:  0 4px 8px rgba(0, 0, 0, .08);
--shadow-lg:  0 12px 24px rgba(0, 0, 0, .12);
```

## Line heights

```
--line-height-tight:   1.2;
--line-height-normal:  1.5;
--line-height-relaxed: 1.7;
```

## Motion

```
--duration-fast:   120ms;
--duration-normal: 200ms;
--duration-slow:   320ms;
--easing-default:  cubic-bezier(0.4, 0, 0.2, 1);
--easing-in:       cubic-bezier(0.4, 0, 1, 1);
--easing-out:      cubic-bezier(0, 0, 0.2, 1);
```
