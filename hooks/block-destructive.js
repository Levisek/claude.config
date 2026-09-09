#!/usr/bin/env node
// PreToolUse (Bash): blokuje katastrofické příkazy.
// Exit 2 + stderr = block. Exit 0 = allow.

const path = require('path');
const os = require('os');
const theme = require(path.join(os.homedir(), '.claude', 'lib', 'theme.js'));

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(input); } catch { process.exit(0); }

  const cmd = (data?.tool_input?.command || '').toLowerCase();
  if (!cmd) process.exit(0);

  function block(why, hint) {
    const g = theme.glyphs();
    // Dlouhý příkaz roztáhne box přes celý terminál — pro výpis stačí začátek.
    const raw = String(data?.tool_input?.command || '');
    const shown = raw.length > 120 ? raw.slice(0, 117) + '…' : raw;
    const box = theme.box({
      title: `${g.shield} BLOKOVÁNO · ${why}`,
      lines: [
        `Claude se pokusil spustit destruktivní příkaz.`,
        ``,
        `${theme.color('Příkaz:', 'dim')} ${shown}`,
        ``,
        ...(hint ? [...hint, ``] : []),
        `${g.arrow} Pokud to opravdu chceš, spusť to ručně`,
        `  v samostatném terminálu mimo Claude.`,
        ``,
        `${theme.color('Pravidlo:', 'dim')} ~/.claude/hooks/block-destructive.js`,
      ],
      color: 'red',
    });
    process.stderr.write(box + '\n');
    process.exit(2);
  }

  // ── Příkaz versus věta o příkazu ────────────────────────────────────────
  // Do 2026-09-09 se vzory hledaly kdekoli v celém řetězci. Hook proto
  // zablokoval zápis TODO, ve kterém byl destruktivní tvar napsaný jako
  // **text dokumentace** uvnitř heredocu. Vadí to pokaždé, když se přes shell
  // píše runbook nebo poznámka o nebezpečných příkazech — a to se tu dělá běžně.
  //
  // Řešení není heredoc vynechat: `bash <<EOF` se opravdu spustí, takže by
  // z toho byla díra. Rozhoduje **pozice**: příkaz stojí na začátku, za
  // oddělovačem, nebo za obalovačem typu `sudo`. Když je před ním slovo věty,
  // backtick nebo uvozovka, mluví se o něm.
  //
  // Zbývající mez: řádek uvnitř heredocu, který destruktivním tvarem začíná,
  // se pořád zablokuje. U hooku, který má chránit před omylem, je to správná
  // strana omylu.
  const OBALOVACE = /^(?:sudo|doas|env|nohup|time|command|exec|xargs|npx|bunx)$/;
  const PRIRAZENI = /^[a-z_][a-z0-9_]*=/;
  const PREPINAC = /^-{1,2}[a-z0-9-]+$/;
  // Hlavy hlídaných příkazů. Slouží jen k tomu, aby se `sudo -u rm` nespletlo
  // s hodnotou přepínače a `rm` se nesnědlo jako argument `-u`.
  const HLAVY = /^(rm|remove-item|del|rd|rmdir|git|mkfs|dd|chmod|format|taskkill|stop-process|get-process|pkill|killall|kill-port|fuser|wmic|invoke-cimmethod)$/;

  /**
   * Zahodí z úseku to, co příkaz jen spouští, a vrátí zbytek od jeho hlavy.
   * Přepínač obalovače si může vzít hodnotu (`sudo -u root …`), takže se
   * přeskakuje i ta — ale nikdy ne token, který sám vypadá jako hlídaný
   * příkaz, jinak by `sudo -u rm -rf /` zmizelo pod stůl.
   */
  function odstranObalovace(usek) {
    const t = usek.split(/\s+/);
    let i = 0;
    let bylObalovac = false;
    while (i < t.length) {
      if (OBALOVACE.test(t[i])) { bylObalovac = true; i++; continue; }
      if (PRIRAZENI.test(t[i])) { i++; continue; }
      if (bylObalovac && PREPINAC.test(t[i])) {
        i++;
        if (i < t.length && !PREPINAC.test(t[i]) && !HLAVY.test(t[i])) i++;
        continue;
      }
      break;
    }
    return t.slice(i).join(' ');
  }

  // Nedělí se na `{}` — rozseklo by to `${HOME}` a `rm -rf ${HOME}` by prošlo.
  const useky = cmd
    .split(/[\n;|&()]+/)
    .map(kus => odstranObalovace(kus.trim()))
    .filter(Boolean);

  /** Vzor v pozici příkazu: kotví se na začátek některého úseku. */
  function vUseku(re) {
    return useky.some(u => re.test(u));
  }

  // Kill podle jména, vzoru nebo portu. Pravidlo z incidentu 2026-04-14:
  // zabití Electronu podle image name shodilo uživateli otevřený Chrome —
  // Chromium/Electron sdílejí GPU a utility procesy napříč instancemi, takže
  // selektor podle jména sáhne i na okna, o kterých nikdo nemluvil.
  // Adresný numerický PID projde; škodí selektor, ne signál.
  const killRules = [
    { re: /^taskkill\b[\s\S]*\s\/t\b/, why: 'taskkill /T (zabíjí i strom potomků)' },
    { re: /^taskkill\b[\s\S]*\s\/im\b/, why: 'taskkill /IM (výběr podle jména)' },
    { re: /^stop-process\b[\s\S]*-name\b/, why: 'Stop-Process -Name' },
    { re: /^(pkill|killall)\b/, why: 'pkill / killall (výběr podle jména)' },
    { re: /^kill-port\b/, why: 'kill-port (výběr podle portu)' },
    { re: /^fuser\s+-[a-z]*k/, why: 'fuser -k (výběr podle portu/souboru)' },
    { re: /^wmic\s+process\b[\s\S]*\bdelete\b/, why: 'wmic process delete' },
    { re: /^invoke-cimmethod\b[\s\S]*-methodname\s+terminate/, why: 'Invoke-CimMethod Terminate' },
  ];
  const RADA_PID = [
    `${theme.color('Místo toho:', 'dim')} zabij konkrétní PID podle čísla,`,
    `  nebo ukonči aplikaci přes IPC / app.quit().`,
  ];

  for (const { re, why, kdekoli } of killRules) {
    if (kdekoli ? re.test(cmd) : vUseku(re)) block(why, RADA_PID);
  }

  // Roura je oddělovač úseků, takže se tenhle tvar hledá jako dvojice: některý
  // úsek začíná výběrem procesů a některý pozdější je ukončuje. Mezi nimi smí
  // stát filtr, proto se nehledá jen soused.
  //
  // Hledat to v celém řetězci by znamenalo blokovat i větu, která tu rouru jen
  // popisuje — na což hook 2026-09-09 doplatil při psaní vlastní zprávy commitu.
  const iVyber = useky.findIndex(u => /^get-process\b/.test(u));
  if (iVyber !== -1 && useky.slice(iVyber + 1).some(u => /^stop-process\b/.test(u))) {
    block('výběr procesů zakončený ukončením', RADA_PID);
  }

  // `kdekoli: true` je pro tvary, které z podstaty nestojí v pozici příkazu:
  // SQL uvnitř `psql -c "…"`, přesměrování na zařízení, fork bomba
  // (ta je z oddělovačů poskládaná celá).
  const patterns = [
    { re: /^rm\s+-[a-z]*r[a-z]*f?\s+\/(\s|$)/, why: 'rm -rf /' },
    { re: /^rm\s+-[a-z]*r[a-z]*f?\s+\/\*/, why: 'rm -rf /*' },
    { re: /^rm\s+-[a-z]*r[a-z]*f?\s+(~|\$home|\$\{home\})(\s|\/|$)/i, why: 'rm -rf home' },
    { re: /^rm\s+-[a-z]*r[a-z]*f?\s+c:[\\/]/i, why: 'rm -rf C:\\' },
    { re: /\bdrop\s+(table|database|schema)\b/, why: 'DROP TABLE/DATABASE', kdekoli: true },
    { re: /\bdelete\s+from\s+\w+\s*;?\s*$/, why: 'DELETE FROM bez WHERE', kdekoli: true },
    { re: /^mkfs/, why: 'mkfs (formát disku)' },
    { re: /^dd\s+.*\bof=\/dev\//, why: 'dd of=/dev/...' },
    { re: />\s*\/dev\/(sd[a-z]|nvme|hd[a-z])/, why: 'overwrite device', kdekoli: true },
    { re: /:\(\)\s*\{\s*:\|:&\s*\}\s*;\s*:/, why: 'fork bomb', kdekoli: true },
    { re: /^chmod\s+-[a-z]*r[a-z]*\s+777\s+\//, why: 'chmod -R 777 /' },
    { re: /^format\s+[a-z]:/i, why: 'format C:' },
    // Windows: Bash tool tam jede přes PowerShell (nebo cmd), takže bashová
    // pravidla výš nechytnou nic. Původní podoba vyžadovala `-recurse` PŘED
    // `-force` a k tomu písmeno disku, takže `Remove-Item -Force -Recurse
    // ~\projekty` jí v klidu prošlo. Lookaheady jsou na pořadí nezávislé
    // a cestu neřeší — rekurzivní vynucené mazání je destruktivní všude.
    { re: /^remove-item\b(?=[\s\S]*-recurse)(?=[\s\S]*-force)/i, why: 'Remove-Item -Recurse -Force' },
    { re: /^(rd|rmdir)\b[\s\S]*\s\/s\b/i, why: 'rd /s (rekurzivní smazání)' },
    { re: /^del\b[\s\S]*\s\/s\b/i, why: 'del /s (rekurzivní smazání)' },
    { re: /^git\s+push\s+.*--force(?!-with-lease)\b/, why: 'git push --force' },
    { re: /^git\s+push\s+.*-f\b(?!\w)/, why: 'git push -f' },
    { re: /^git\s+reset\s+--hard\s+(head~|origin)/, why: 'git reset --hard' },
    { re: /^git\s+clean\s+-[a-z]*f/, why: 'git clean -f' },
    { re: /^git\s+checkout\s+\./, why: 'git checkout . (discard)' },
    { re: /^git\s+branch\s+-d\b/i, why: 'git branch -D' },
  ];

  for (const { re, why, kdekoli } of patterns) {
    if (kdekoli ? re.test(cmd) : vUseku(re)) block(why);
  }
  process.exit(0);
});
