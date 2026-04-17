# Kdy `any`, kdy `unknown`, kdy type guard

## Rozhodovací strom

```
Máš hodnotu neznámého typu?
│
├─ Přichází z kontrolovaného zdroje (náš kód, náš schema)?
│  └─ Použij konkrétní typ. Pokud je sjednocení, union.
│
├─ Přichází zvenčí (HTTP, FS, postMessage, JSON.parse)?
│  ├─ Máš schema (Zod/Valibot)?
│  │  └─ `schema.parse(x)` → typed.
│  └─ Nemáš schema?
│     └─ Typ = `unknown`, narrow ručně před použitím.
│
├─ Externí lib má broken types?
│  └─ `any` s komentářem odkazujícím na upstream issue.
│
└─ Generický pattern (tree traversal, recursive data)?
   └─ Zkus recursive type (`type Tree<T> = T | Tree<T>[]`).
      Pokud selže → `unknown` + type guard na každém levelu.
```

## Příklady

### JSON parse z API

```ts
// ŠPATNĚ
const data: any = JSON.parse(body);

// LEPŠÍ — unknown + schema
const raw: unknown = JSON.parse(body);
const data = userSchema.parse(raw);  // typed
```

### Event handler s `detail` payload

```ts
// ŠPATNĚ
window.addEventListener('my-event', (e: any) => doStuff(e.detail));

// LEPŠÍ
interface MyEventDetail { id: string; value: number; }
window.addEventListener('my-event', (e: Event) => {
  if (!(e instanceof CustomEvent)) return;
  const detail = e.detail as MyEventDetail;  // stále cast, ale zúžený kontext
  doStuff(detail);
});
```

### Recursive tree

```ts
// OK
type JsonValue =
  | string | number | boolean | null
  | JsonValue[]
  | { [k: string]: JsonValue };

function walk(v: JsonValue): void { ... }
```

## Červené vlajky

| Kód | Problém |
|-----|---------|
| `(x as any).foo` | Cast k any, pak přístup — compiler ti nepomůže |
| `function f(x: any)` bez komentáře | Odpadá type checking uvnitř funkce |
| `catch (e) { ... e.message ... }` | `e` je `unknown` v TS 4.4+, použij `e instanceof Error` |
| `JSON.parse(x)` bez následného schema | Vrací `any`, propadne to do volajícího |
