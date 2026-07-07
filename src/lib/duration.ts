export type DurationBucket = "any" | "short" | "medium" | "long";

export const DURATION_BUCKETS: { key: DurationBucket; label: string; min?: number; max?: number }[] = [
  { key: "any", label: "Qualquer duração" },
  { key: "short", label: "Até 1h30", max: 90 },
  { key: "medium", label: "1h30 – 2h", min: 91, max: 120 },
  { key: "long", label: "Mais de 2h", min: 121 },
];

export function durationBucketRange(bucket: DurationBucket): { min?: number; max?: number } {
  const found = DURATION_BUCKETS.find((b) => b.key === bucket);
  return { min: found?.min, max: found?.max };
}
