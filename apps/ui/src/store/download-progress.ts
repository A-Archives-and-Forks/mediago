export function normalizeDownloadPercent(value: string | number | undefined) {
  const percent = Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(percent) || percent < 0) return null;
  return Math.min(100, percent);
}
