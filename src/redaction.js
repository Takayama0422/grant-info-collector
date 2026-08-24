'use strict';

// エラーメッセージに認証情報らしき文字列が混入していた場合に備えるマスク処理。
// 既定の収集経路は認証情報を必要としないが、将来 authRequired なソースを
// 明示的に許可した場合に備えて残す。
const SECRET_PATTERNS = [
  /(authorization\s*:\s*)\S+/gi,
  /(bearer\s+)\S+/gi,
  /(api[_-]?key\s*[=:]\s*)\S+/gi,
  /(token\s*[=:]\s*)\S+/gi,
];

function maskSecrets(text) {
  let masked = text;
  for (const pattern of SECRET_PATTERNS) {
    masked = masked.replace(pattern, '$1[REDACTED]');
  }
  return masked;
}

function safeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return maskSecrets(message);
}

module.exports = { maskSecrets, safeError };
