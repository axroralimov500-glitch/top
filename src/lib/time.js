export function nowIso() {
  return new Date().toISOString();
}

export function isoAfterSeconds(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export function isExpired(iso) {
  return Boolean(iso) && iso <= nowIso();
}
