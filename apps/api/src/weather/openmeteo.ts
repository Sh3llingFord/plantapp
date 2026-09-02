// Open-Meteo — kein API-Key, keine Registrierung nötig (siehe docs/ROADMAP.md, M5).

export interface GeocodeResult {
  label: string;
  latitude: number;
  longitude: number;
}

interface GeocodingApiResponse {
  results?: Array<{ name: string; latitude: number; longitude: number; country?: string; admin1?: string }>;
}

export async function geocodeLocation(query: string): Promise<GeocodeResult | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=de&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding fehlgeschlagen (Status ${res.status})`);
  const data = (await res.json()) as GeocodingApiResponse;
  const first = data.results?.[0];
  if (!first) return null;
  const label = [first.name, first.admin1, first.country].filter(Boolean).join(", ");
  return { label, latitude: first.latitude, longitude: first.longitude };
}

export interface DailyForecastDay {
  date: string; // "YYYY-MM-DD"
  tempMinC: number;
  tempMaxC: number;
  precipitationSumMm: number;
}

interface ForecastApiResponse {
  daily: {
    time: string[];
    temperature_2m_min: number[];
    temperature_2m_max: number[];
    precipitation_sum: number[];
  };
}

export async function fetchForecast(latitude: number, longitude: number): Promise<DailyForecastDay[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&daily=temperature_2m_min,temperature_2m_max,precipitation_sum&timezone=auto&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wettervorhersage fehlgeschlagen (Status ${res.status})`);
  const data = (await res.json()) as ForecastApiResponse;
  return data.daily.time.map((date, i) => ({
    date,
    tempMinC: data.daily.temperature_2m_min[i],
    tempMaxC: data.daily.temperature_2m_max[i],
    precipitationSumMm: data.daily.precipitation_sum[i],
  }));
}
