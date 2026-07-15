// src/security/inputValidation.ts
//
// Small, dependency-free validation helpers used across the action layer.
// The action layer executes LLM-driven input, so every value that reaches a
// shell, an email header, or a browser navigation must be validated here first.

/**
 * Reject CR/LF (and stray control chars) in a value destined for an email
 * header. Prevents header injection (e.g. sneaking a `Bcc:` via a newline in
 * the `to`/`subject` field). Throws on violation so the caller surfaces a
 * clear error instead of silently sending a malformed message.
 */
export function assertSafeHeaderValue(field: string, value: string): string {
  if (/[\r\n]/.test(value)) {
    throw new Error(`Invalid ${field}: line breaks are not allowed in email headers.`);
  }
  return value;
}

/**
 * Allow only http(s) URLs for browser navigation / opening. Blocks
 * `file://`, `javascript:`, `data:`, internal schemes, etc.
 */
export function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
