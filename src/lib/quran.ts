import metadata from "../data/quran.json";
export const SURAHS = metadata.surahs;
export const TOTAL_AYAHS = 6236;
export interface AyahRange {
  surah: number;
  start: number;
  end: number;
}
export function validRange(range: AyahRange): boolean {
  const s = SURAHS[range.surah - 1];
  return (
    Number.isInteger(range.surah) &&
    !!s &&
    Number.isInteger(range.start) &&
    Number.isInteger(range.end) &&
    range.start >= 1 &&
    range.end >= range.start &&
    range.end <= s.ayahs
  );
}
export function unionRanges(ranges: AyahRange[]): AyahRange[] {
  const sorted = ranges
    .filter(validRange)
    .map((r) => ({ ...r }))
    .sort((a, b) => a.surah - b.surah || a.start - b.start);
  return sorted.reduce<AyahRange[]>((merged, r) => {
    const last = merged.at(-1);
    if (last && last.surah === r.surah && r.start <= last.end + 1)
      last.end = Math.max(last.end, r.end);
    else merged.push(r);
    return merged;
  }, []);
}
export function uniqueAyahs(ranges: AyahRange[]): number {
  return unionRanges(ranges).reduce((n, r) => n + r.end - r.start + 1, 0);
}
export function globalAyah(surah: number, ayah: number): number {
  return SURAHS[surah - 1].offset + ayah;
}
function partitionProgress(
  ranges: AyahRange[],
  boundaries: typeof metadata.juz,
) {
  const merged = unionRanges(ranges).map((r) => ({
    start: globalAyah(r.surah, r.start),
    end: globalAyah(r.surah, r.end),
  }));
  return boundaries.map((part, i) => {
    const start = globalAyah(part.surah, part.ayah);
    const next = boundaries[i + 1];
    const end = next ? globalAyah(next.surah, next.ayah) - 1 : TOTAL_AYAHS;
    const memorized = merged.reduce(
      (n, r) =>
        n + Math.max(0, Math.min(end, r.end) - Math.max(start, r.start) + 1),
      0,
    );
    return {
      number: part.number,
      total: end - start + 1,
      memorized,
      percent: (memorized / (end - start + 1)) * 100,
    };
  });
}
export const juzProgress = (ranges: AyahRange[]) =>
  partitionProgress(ranges, metadata.juz);
export function rangeJuz(range: AyahRange): number[] {
  return juzProgress([range])
    .filter((j) => j.memorized > 0)
    .map((j) => j.number);
}
export function rangePages(range: AyahRange): string {
  const p = partitionProgress([range], metadata.pages).filter(
    (p) => p.memorized > 0,
  );
  return p.length
    ? `${p[0].number}${p.length > 1 ? `–${p.at(-1)!.number}` : ""}`
    : "";
}
export const rangeLabel = (r: AyahRange) =>
  `${SURAHS[r.surah - 1]?.name ?? "Surah"} ${r.start}–${r.end}`;
