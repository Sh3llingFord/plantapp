import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { CareProfileSchema } from "../../packages/shared/src/care-profile.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, "plants.seed.json");

test("plants.seed.json ist ein Array", () => {
  const raw = JSON.parse(readFileSync(seedPath, "utf-8"));
  assert.ok(Array.isArray(raw), "Seed-Datei muss ein JSON-Array sein");
});

test("plants.seed.json enthält 50 Pflanzen", () => {
  const raw = JSON.parse(readFileSync(seedPath, "utf-8"));
  assert.equal(raw.length, 50, `Erwartet 50 Seed-Pflanzen, gefunden: ${raw.length}`);
});

test("jede Seed-Pflanze entspricht dem CareProfile-Schema", () => {
  const raw = JSON.parse(readFileSync(seedPath, "utf-8"));
  for (const entry of raw) {
    const result = CareProfileSchema.safeParse(entry);
    assert.ok(
      result.success,
      `Schema-Fehler bei "${entry?.identity?.botanicalName ?? "?"}": ${
        result.success ? "" : JSON.stringify(result.error.issues, null, 2)
      }`,
    );
  }
});

test("jede Seed-Pflanze hat mindestens eine Quelle", () => {
  const raw = JSON.parse(readFileSync(seedPath, "utf-8"));
  for (const entry of raw) {
    assert.ok(
      Array.isArray(entry.meta?.sources) && entry.meta.sources.length > 0,
      `${entry?.identity?.botanicalName ?? "?"} hat keine Quellen in meta.sources`,
    );
  }
});

test("botanische Namen sind eindeutig", () => {
  const raw = JSON.parse(readFileSync(seedPath, "utf-8"));
  const names = raw.map((e: { identity: { botanicalName: string } }) => e.identity.botanicalName);
  const unique = new Set(names);
  assert.equal(unique.size, names.length, "Botanische Namen müssen eindeutig sein");
});
