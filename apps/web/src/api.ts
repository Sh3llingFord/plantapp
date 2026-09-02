import type { CareProfile, LightLevel, CompassDirection } from "@plantapp/shared";

export interface Location {
  id: string;
  name: string;
  direction: CompassDirection | null;
  indoor: boolean;
  lightEstimate: LightLevel | null;
  createdAt: string;
}

export interface Species {
  id: string;
  botanicalName: string;
  careProfile: CareProfile;
  light: LightLevel | null;
  hardy: boolean | null;
  petsToxic: boolean | null;
  indoor: boolean | null;
  outdoor: boolean | null;
  isSeed: boolean;
  photoPath: string | null;
  createdAt: string;
}

export interface Plant {
  id: string;
  nickname: string;
  speciesId: string | null;
  freeTextSpecies: string | null;
  locationId: string | null;
  purchaseDate: string | null;
  notes: string | null;
  photoPath: string | null;
  careProfileOverrides?: Partial<CareProfile> | null;
  createdAt: string;
  speciesBotanicalName?: string | null;
  speciesCareProfile?: CareProfile | null;
}

export interface PlantDetail extends Plant {
  careProfile: CareProfile | null;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Fehler ${res.status}`);
  }
  return res.json();
}

function query(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries as [string, string][]).toString();
}

export const api = {
  locations: {
    list: () => request<Location[]>("/api/locations"),
    create: (body: Partial<Location>) =>
      request<Location>("/api/locations", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Location>) =>
      request<Location>(`/api/locations/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => request<{ ok: true }>(`/api/locations/${id}`, { method: "DELETE" }),
  },
  species: {
    list: (params: { q?: string; light?: string; hardy?: string; petsToxic?: string } = {}) =>
      request<Species[]>(`/api/species${query(params)}`),
    get: (id: string) => request<Species>(`/api/species/${id}`),
    uploadPhoto: async (id: string, file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/species/${id}/photo`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Foto-Upload fehlgeschlagen");
      return res.json() as Promise<{ photoPath: string }>;
    },
  },
  plants: {
    list: (params: { q?: string; locationId?: string } = {}) =>
      request<Plant[]>(`/api/plants${query(params)}`),
    get: (id: string) => request<PlantDetail>(`/api/plants/${id}`),
    create: (body: Partial<Plant>) =>
      request<Plant>("/api/plants", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Plant>) =>
      request<Plant>(`/api/plants/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => request<{ ok: true }>(`/api/plants/${id}`, { method: "DELETE" }),
    uploadPhoto: async (id: string, file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/plants/${id}/photo`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Foto-Upload fehlgeschlagen");
      return res.json() as Promise<{ photoPath: string }>;
    },
    enrich: (id: string) =>
      request<{ status: "done" | "queued"; jobId?: string; speciesId?: string }>(
        `/api/plants/${id}/enrich`,
        { method: "POST" },
      ),
  },
  enrichmentJobs: {
    get: (id: string) =>
      request<{ id: string; status: "queued" | "done" | "failed"; error: string | null }>(
        `/api/enrichment/jobs/${id}`,
      ),
  },
};

export const LIGHT_LABELS: Record<LightLevel, string> = {
  full_sun: "Volle Sonne",
  partial_sun: "Halbschatten",
  bright_indirect: "Hell, indirekt",
  shade: "Schatten",
};
