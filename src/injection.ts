const SUSPICIOUS_PATTERNS = [
  /ignore (all|previous|earlier) instructions/gi,
  /system prompt/gi,
  /disregard .* instructions/gi,
  /new instructions/gi,
  /base64[, :][A-Za-z0-9+/=]{40,}/g,
];

const ZERO_WIDTH_RE = /[\u200B-\u200F\uFEFF]/g;
const TAG_CHARS_RE = /[\u{E0000}-\u{E007F}]/gu;

export type InjectionScan = {
  sanitized: string;
  warnings: string[];
};

export function sanitizeUntrustedText(input: string): InjectionScan {
  const warnings: string[] = [];
  let out = input.replace(ZERO_WIDTH_RE, "").replace(TAG_CHARS_RE, "");
  if (out !== input) warnings.push("stripped_invisible_characters");
  for (const p of SUSPICIOUS_PATTERNS) {
    if (p.test(out)) warnings.push(`pattern_match:${p.source}`);
  }
  return { sanitized: out, warnings };
}

export function wrapUntrustedContent(url: string, text: string): string {
  const ts = new Date().toISOString();
  return `<untrusted_content source="${url}" retrieved_at="${ts}">\n${text}\n</untrusted_content>`;
}
