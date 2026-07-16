// src/security/redaction.ts
//
// Best-effort secret redaction for captured content (clipboard, screen OCR,
// selected text). Collectors ingest whatever the user copies or has on screen,
// which routinely includes passwords, API keys, and card numbers. This strips
// the obvious high-risk secrets before anything is persisted to SQLite/LanceDB.
//
// It is intentionally conservative-but-safe: it errs toward redacting when a
// value strongly matches a secret shape. It is NOT a guarantee — treat the local
// stores as sensitive regardless.

function luhnValid(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48; // '0' = 48
    if (d < 0 || d > 9) return false;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Redact obvious secrets from a block of text. Returns the cleaned string. */
export function redactSecrets(input: string): string {
  if (!input) return input;
  let out = input;

  // PEM private key blocks.
  out = out.replace(
    /-----BEGIN[A-Z ]*PRIVATE KEY-----[\s\S]*?-----END[A-Z ]*PRIVATE KEY-----/g,
    '[REDACTED PRIVATE KEY]'
  );

  // JWTs (header.payload.signature).
  out = out.replace(/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/g, '[REDACTED]');

  // Well-known provider token shapes.
  out = out.replace(
    /\b(?:sk-[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b/g,
    '[REDACTED]'
  );

  // Bearer tokens — keep the scheme, drop the value.
  out = out.replace(/\bBearer\s+[A-Za-z0-9._-]{10,}/gi, 'Bearer [REDACTED]');

  // key/value secret assignments: password=..., api_key: "...", token = ...
  out = out.replace(
    /\b(password|passwd|pwd|secret|token|api[_-]?key|apikey|auth)\b(\s*[:=]\s*)("?)([^\s"']+)\3/gi,
    (_m, key, sep) => `${key}${sep}[REDACTED]`
  );

  // Credit-card-like digit runs, confirmed by Luhn to cut false positives.
  out = out.replace(/\b(?:\d[ -]?){13,19}\b/g, (m) => (luhnValid(m.replace(/\D/g, '')) ? '[REDACTED]' : m));

  return out;
}
