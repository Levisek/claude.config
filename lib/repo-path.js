// Encode cwd → Anthropic's `projects/<encoded>` naming convention.
// Verified against existing dirs: C:\Users\admin\.claude → C--Users-admin--claude
// Replacements (sequential, no collision concerns since each maps to '-'):
//   ':' → '-'   (colon, Windows drive)
//   '\\' '/' → '-'   (path separators)
//   '.' → '-'   (dots, e.g. ".claude")
//   '_' → '-'   (underscores)
//   ' ' → '-'   (spaces)
// Result: chained dashes preserved (e.g. "C:\\dev\\.x" → "C--dev--x").

function encodeRepoPath(cwd) {
  return String(cwd)
    .replace(/:/g, '-')
    .replace(/[\\/]/g, '-')
    .replace(/\./g, '-')
    .replace(/[_ ]/g, '-');
}

module.exports = { encodeRepoPath };
