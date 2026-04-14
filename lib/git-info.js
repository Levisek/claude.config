// Sdílená git helperka. Per-process cache (jeden běh skriptu = jedno čtení).

const { execSync } = require('child_process');

let cached = null;
let cachedLite = null;

function run(cmd, cwd) {
  try {
    return execSync(cmd, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1000,
    }).trim();
  } catch {
    return null;
  }
}

// Lite varianta pro statusLine — jeden git call, minimum info.
function collectLite(cwd) {
  const out = run('git status --porcelain=v2 --branch', cwd);
  if (out === null) return { inRepo: false };

  let branch = '(detached)';
  let ahead = 0, behind = 0;
  let dirtyCount = 0;
  let hasUpstream = false;

  for (const line of out.split('\n')) {
    if (line.startsWith('# branch.head ')) branch = line.slice(14).trim();
    else if (line.startsWith('# branch.upstream ')) hasUpstream = true;
    else if (line.startsWith('# branch.ab ')) {
      const m = line.match(/\+(\d+) -(\d+)/);
      if (m) { ahead = parseInt(m[1], 10); behind = parseInt(m[2], 10); }
    }
    else if (line && !line.startsWith('#')) dirtyCount++;
  }

  return { inRepo: true, branch, ahead, behind, hasUpstream, dirty: dirtyCount > 0, dirtyCount };
}

function gitInfoLite(cwd = process.cwd()) {
  if (cachedLite && cachedLite.cwd === cwd) return cachedLite.data;
  const data = collectLite(cwd);
  cachedLite = { cwd, data };
  return data;
}

function collect(cwd) {
  const inRepo = run('git rev-parse --is-inside-work-tree', cwd) === 'true';
  if (!inRepo) return { inRepo: false };

  const branch = run('git branch --show-current', cwd) || '(detached)';
  const statusRaw = run('git status --short', cwd) || '';
  const dirtyLines = statusRaw ? statusRaw.split('\n').filter(Boolean) : [];
  const dirty = dirtyLines.length > 0;
  const dirtyCount = dirtyLines.length;

  const hasUpstream = !!run('git rev-parse --abbrev-ref @{u}', cwd);
  const ahead = hasUpstream ? parseInt(run('git rev-list --count @{u}..HEAD', cwd) || '0', 10) : 0;
  const behind = hasUpstream ? parseInt(run('git rev-list --count HEAD..@{u}', cwd) || '0', 10) : 0;

  const commitsRaw = run('git log --pretty=format:%h\x1f%s -10', cwd) || '';
  const numstatRaw = run('git log --numstat --pretty=format:%h -10', cwd) || '';

  // Parse commits: každý řádek `hash\x1fsubject`.
  const commits = commitsRaw
    ? commitsRaw.split('\n').filter(Boolean).map(line => {
        const [hash, subject] = line.split('\x1f');
        return { hash, subject: subject || '', additions: 0, deletions: 0 };
      })
    : [];

  // Parse numstat: bloky oddělené hash řádkem.
  if (numstatRaw) {
    const blocks = numstatRaw.split(/\n(?=[0-9a-f]{7,}\n)/);
    for (const block of blocks) {
      const lines = block.split('\n').filter(Boolean);
      if (lines.length === 0) continue;
      const hash = lines[0];
      const commit = commits.find(c => c.hash === hash);
      if (!commit) continue;
      for (const line of lines.slice(1)) {
        const [add, del] = line.split('\t');
        commit.additions += parseInt(add, 10) || 0;
        commit.deletions += parseInt(del, 10) || 0;
      }
    }
  }

  return {
    inRepo: true,
    branch,
    ahead,
    behind,
    hasUpstream,
    dirty,
    dirtyCount,
    dirtyLines,
    recentCommits: commits,
  };
}

function gitInfo(cwd = process.cwd()) {
  if (cached && cached.cwd === cwd) return cached.data;
  const data = collect(cwd);
  cached = { cwd, data };
  return data;
}

module.exports = { gitInfo, gitInfoLite };
