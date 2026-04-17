# Secret patterns — regex pro detekci hardcoded credentials

Tyto regex patterny jsou high-confidence pro detekci secrets v kódu. False positives jsou minimální.

## API klíče

| Provider | Pattern | Poznámka |
|----------|---------|----------|
| OpenAI | `sk-[a-zA-Z0-9]{20,}` nebo `sk-proj-[a-zA-Z0-9_-]{40,}` | Project keys i classic |
| Anthropic | `sk-ant-[a-zA-Z0-9_-]{90,}` | |
| GitHub PAT | `ghp_[a-zA-Z0-9]{36}` | Classic PAT |
| GitHub App | `ghu_[a-zA-Z0-9]{36}` / `ghs_[a-zA-Z0-9]{36}` | User / server |
| GitHub fine-grained | `github_pat_[a-zA-Z0-9_]{80,}` | |
| Slack bot | `xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+` | |
| Slack user | `xoxp-[0-9]+-[0-9]+-[0-9]+-[a-f0-9]+` | |
| AWS access key | `AKIA[0-9A-Z]{16}` | Jistota 95 % |
| AWS secret key | `[a-zA-Z0-9/+=]{40}` po `aws_secret_access_key` nebo `AWS_SECRET` | Kontext-sensitivní |
| Google API | `AIza[0-9A-Za-z_-]{35}` | |
| Stripe | `sk_live_[a-zA-Z0-9]{24,}` / `pk_live_[a-zA-Z0-9]{24,}` | Live = CRITICAL, test = MEDIUM |
| Twilio | `AC[a-f0-9]{32}` | Account SID, ne vždy secret |
| SendGrid | `SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}` | |

## Tokeny a session

| Typ | Pattern |
|-----|---------|
| JWT | `eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}` |
| Bearer token (generic) | `[Bb]earer\s+[a-zA-Z0-9._-]{20,}` |
| Base64 credentials | `[Bb]asic\s+[A-Za-z0-9+/=]{20,}` |

## Private keys

```
-----BEGIN (RSA |EC |DSA |OPENSSH |)PRIVATE KEY-----
```

Pokud najdeš v repu = vždy CRITICAL.

## Connection strings

| Pattern | Příklad |
|---------|---------|
| Postgres | `postgres(ql)?://[^:]+:[^@]+@` |
| MySQL | `mysql://[^:]+:[^@]+@` |
| MongoDB | `mongodb(\+srv)?://[^:]+:[^@]+@` |
| Redis | `redis://(:[^@]+)?@` |
| SMTP | `smtp://[^:]+:[^@]+@` |

## Grep příkazy pro rychlý scan

```bash
# OpenAI + Anthropic + GitHub
grep -rEn '(sk-[a-zA-Z0-9]{20,}|sk-ant-[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{36}|gh[us]_[a-zA-Z0-9]{36})' \
  --exclude-dir={node_modules,.git,dist,build,.next,.vite} .

# JWT
grep -rEn 'eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}' \
  --exclude-dir={node_modules,.git,dist,build} .

# Private keys
grep -rln 'BEGIN.*PRIVATE KEY' --exclude-dir={node_modules,.git} .

# Connection strings s heslem
grep -rEn '(postgres|mysql|mongodb|redis|smtp)(\+srv)?://[^:]+:[^@/]+@' \
  --exclude-dir={node_modules,.git,dist,build} .
```

## Co NENÍ secret (false positives)

- `sk-xxx` / `sk-REPLACE_ME` / `sk-YOUR_KEY_HERE` — placeholders
- `process.env.API_KEY` — reference na env, ne sama hodnota
- `sk-[a-f]{40}` v test fixture (soubor `*.test.*`, `*.spec.*`, `fixtures/`)
- Base64-looking stringy v CSS/SVG `data:` URLs
- Hash hodnoty (commit SHA, file hash) — match pattern ale nejsou secrets

## Priority scanu

1. **HEAD** (aktuální tree) — high priority, pokud secret je tam = CRITICAL
2. **Git history** — `git log --all --full-history -p -S 'SECRET'` — secret v historii i když už je odstraněný = stále CRITICAL (je public)
3. **`.env` files** — ověř že jsou v `.gitignore` a ne tracked: `git ls-files | grep -E '^\.env($|\.)'`

## Remediation když najdeš secret

1. **Nekomitnuj „fix"** — už to je venku.
2. **Rotate secret** okamžitě (u providera).
3. **Odeber z git historie** (`git filter-repo` nebo BFG) — ale předpokládej že to bylo scraped.
4. **Přidej do `.gitignore`**.
5. **Post-mortem** — proč to tam bylo? chybí linter? secrets manager?
