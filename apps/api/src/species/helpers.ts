import type { CareProfile } from "@plantapp/shared";

export function deriveFilterColumns(careProfile: CareProfile) {
  return {
    light: careProfile.placement?.light ?? null,
    hardy: careProfile.placement?.hardy ?? null,
    petsToxic: careProfile.toxicity?.petsToxic ?? null,
    indoor: careProfile.placement?.indoor ?? null,
    outdoor: careProfile.placement?.outdoor ?? null,
  };
}

export function slugify(botanicalName: string): string {
  return botanicalName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
