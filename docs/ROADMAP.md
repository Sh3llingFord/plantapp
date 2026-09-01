# Roadmap: Pflanzen-Pflege-PWA („plantapp")

> **Übergabedokument.** Dieser Text ist vollständig und selbsttragend — er enthält alles,
> was in der Planungssession entschieden wurde, samt Begründungen und verworfenen
> Alternativen. Eine neue Claude-Code-Session braucht nichts weiter als diese Datei.
>
> **Startsatz für eine neue Session:**
> „Lies `docs/ROADMAP.md`. Wir bauen M0. Branch `claude/plant-care-pwa-roadmap-8eyks5`.
> Nicht neu planen — umsetzen."

---

## Kontext

Andreas und seine Frau wollen ihre Pflanzen digital verwalten. Das Problem ist konkret: Bei
einer neu gekauften Pflanze weiß man weder, wohin sie soll (Sonne/Schatten, Luftfeuchte,
winterhart?), noch wann sie Wasser, Dünger oder einen Schnitt braucht. Diese Recherche pro
Pflanze zusammenzusuchen ist Arbeit, die eine AI übernehmen kann.

**Ziel:** Eine PWA, die auf beiden Android-Handys wie eine native App installiert ist, die
Pflanzensammlung durchsuchbar hält, Pflegeprofile automatisch per AI recherchiert und
rechtzeitig per Push erinnert — inklusive Frostwarnung.

---

## Entscheidungslog

Diese Punkte sind entschieden und sollen nicht neu aufgerollt werden. Wo eine Alternative
verworfen wurde, steht der Grund dabei — damit eine spätere Session sie nicht erneut
vorschlägt.

| Thema | Entscheidung | Verworfen — warum |
|---|---|---|
| Deployment | **Portainer-Stack, Typ „Repository"** — Portainer klont das Repo auf den Docker-Host und baut das Image dort selbst | GitHub Actions + GHCR (externes CI unerwünscht); lokales `docker compose` (es soll nur ein Stack-YAML sein) |
| Erreichbarkeit | **Cloudflare Tunnel**, proxied DNS-Record `plantsvsmella.inmc.info` → `cloudflared` → Container. Gleiches Muster wie beim vorhandenen HA-Zugriff | Port-Forwarding, eigenes Let's-Encrypt/Caddy-Setup — unnötig |
| Edge-Auth | **Kein Cloudflare Access.** App-eigener Login | Access beantwortet Service-Worker- und Push-Requests mit Login-Redirects und bricht damit PWA-Installation und Push |
| Datenhaltung | **SQLite-Datei**, `/data` als **Bind-Mount** auf selbst gewählten Host-Pfad | Azure Table Storage (kein SQL/Joins/Volltext, Latenz, wäre trotzdem Betrieb); Docker-Volume (explizit nicht gewollt) |
| Backup | Nächtlicher **`VACUUM INTO`**-Snapshot nach `/data/backups/`, 14 Generationen; die vorhandene lokale Sicherung nimmt sie mit | Litestream → Cloudflare R2 — kein externer Dienst gewünscht |
| Stack | **TypeScript-Monorepo**, pnpm workspaces | Python/FastAPI — ein Sprachkontext ist bei geteiltem Schema wertvoller |
| AI | **Ausschließlich über n8n**, asynchron mit Callback | Direkter AI-Call aus der App (n8n ist gesetzt); synchroner Request (läuft in Timeouts) |
| Wetter | **Open-Meteo** (Geocoding + Prognose + Archiv), kein API-Key | Wettervorhersage aus Home Assistant — koppelt die Frostwarnung an HA-Verfügbarkeit und liefert keine historischen Daten |
| Home Assistant | **Nicht in dieser Roadmap**, eigener Meilenstein danach | — bewusste Vertagung; Vorbereitung steckt in M3 |
| Nutzer | Genau zwei, E-Mail + Passwort (argon2id), Langzeit-Session-Cookie | OAuth/SSO — Overkill für zwei Personen |
| Extras in Scope | Wetter/Frostwarnung | Foto-Erkennung, QR-Etiketten — abgewählt, siehe Backlog |

**Noch offen, wird zur Umsetzung gebraucht:**
Host-Pfad für den `/data`-Bind-Mount · Cloudflare-Tunnel-Token · n8n-Webhook-URL ·
GitHub-PAT mit Repo-Lesezugriff für Portainer · welches AI-Modell in n8n hängt.

---

## Wie die Roadmap entstanden ist (3 Iterationen)

Der Planungsauftrag war, dreimal zu iterieren. Die verworfenen Zwischenstände stehen hier
mit ihrer Kritik, weil sie begründen, warum Iteration 3 so aussieht, wie sie aussieht.

### Iteration 1 — naiver Feature-Schnitt

M1 Grundgerüst → M2 CRUD + Suche → M3 AI → M4 Kalender → M5 Push → M6 Wetter → M7 Politur.

**Verworfen, weil:**

1. **Die größten Risiken liegen ganz hinten.** Ob Web-Push auf Android durch einen Cloudflare
   Tunnel zuverlässig ankommt, zeigt sich erst in M5 — nach ~7 Wochen. Klemmt es dort, ist
   der halbe Produktwert (Erinnerungen) gefährdet und die Zeit ist weg.
2. **Das Datenmodell entsteht zu spät.** Das Pflegeprofil-Schema wird in M3 definiert, obwohl
   M2 (Datenmodell) und M4 (Kalender, Aufgabenregeln) darauf aufbauen. Garantiertes Rework in
   zwei bereits „fertigen" Meilensteinen.
3. **Nichts ist vor M7 benutzbar.** Bei einem Feierabendprojekt für die eigene Frau ist das
   der sicherste Weg, dass es nie fertig wird.

### Iteration 2 — risikogetrieben mit Spikes vorne

Neue Sortierung nach „was kann dieses Projekt töten": R1 Push durch den Tunnel · R2
schemakonformes JSON aus der AI · R3 Reichweite des Pflegeprofil-Schemas · R4
Offline-Schreibkonflikte. Dazu ein Meilenstein 0 „Walking Skeleton" in Woche 1.

**Verworfen, weil:**

1. **Spikes produzieren Wegwerfcode.** R1 und R2 lassen sich genauso gut mit echtem
   Produktivcode beweisen; ein separater Prototyp ist verschenkte Zeit.
2. **Immer noch nichts Benutzbares.** Vier technische Spikes hintereinander sind
   demotivierend, wenn abends nach der Arbeit gearbeitet wird.
3. **R3 ist gar kein Spike, sondern eine Design-Entscheidung.** Man beweist die
   Reichhaltigkeit des Schemas nicht durch Experimentieren, sondern indem man 50 echte
   Pflanzen dagegen validiert — und diesen Seed-Datensatz braucht man ohnehin.

### Iteration 3 — final

**Leitprinzip: Jeder Meilenstein endet mit etwas, das seine Frau auf dem Handy öffnen und
tatsächlich benutzen kann.** Die Risiken bleiben vorne, werden aber mit echtem Produktcode
bewiesen statt mit Prototypen.

Zeitangaben: Kalenderwochen bei ca. 8 h/Woche, mit Claude Code als Schreibkraft.

---

## Meilensteine

### M0 — Walking Skeleton + Push-Beweis (Woche 1)

Das riskanteste Stück zuerst, aber als echter Code.

- Monorepo (`pnpm` workspaces): `apps/web`, `apps/api`, `packages/shared`
- **`Dockerfile`** im Repo-Root, mehrstufig: pnpm-Install → PWA-Build → schlankes
  Node-Runtime-Image. Weil Portainer auf dem Host baut, braucht die VM nichts außer Docker —
  Node und pnpm leben nur in der Build-Stage.
- **`infra/stack.yaml`** — Services `plantapp` (mit `build: .`) und `cloudflared` (fertiges
  Image). Alle Secrets kommen als Stack-Umgebungsvariablen aus Portainer, nicht aus einer
  Datei auf dem Host.
- Cloudflare: proxied DNS-Record `plantsvsmella.inmc.info` → Tunnel → `plantapp:3000`.
  Tunnel-Token als Portainer-Env-Variable, kein offener Port am Router.
- SQLite in `/data/plantapp.db` (WAL-Modus), Drizzle-Migrationen beim Containerstart.
  `/data` ist ein **Bind-Mount** auf einen selbst gewählten Host-Pfad
  (`- /dein/pfad/plantapp:/data`), damit die Datei direkt in der Backup-Routine liegt.
- Login: E-Mail + Passwort (argon2id), HttpOnly-Session-Cookie mit langer Laufzeit (1 Jahr) —
  die installierte PWA soll sich nie ausloggen.
- PWA-Manifest, maskable Icons, `display: standalone`, Service Worker via `vite-plugin-pwa`
- Einstellungsseite mit genau einem Button: **„Benachrichtigungen aktivieren"** → VAPID-Abo →
  **„Testbenachrichtigung senden"**, die real auf dem Android ankommt.
  **Die VAPID-Keys erzeugt die App beim ersten Start selbst nach `/data`** — kein manuelles
  Key-Handling, und sie überleben jeden Redeploy.
- `/api/health`

**Definition of Done:** Beide Handys haben die App über den Tunnel installiert und empfangen
eine Testbenachrichtigung bei **geschlossener** App. Damit ist R1 erledigt. Kommt sie nicht
an, wird nichts weiter gebaut, bis sie ankommt.

> **Fallstrick:** Kein Cloudflare Access vor die App. Access beantwortet Service-Worker- und
> Push-Requests mit Login-Redirects und bricht damit Installation und Push. Absicherung
> stattdessen: app-eigener Login + Cloudflare-Rate-Limit auf `/api/auth/login`.

### M1 — Pflanzen erfassen und finden (Woche 2–3)

Der Katalog — nützlich, noch ganz ohne AI.

- **Contract-first:** Das Pflegeprofil-Schema wird hier festgelegt, in
  `packages/shared/src/care-profile.ts` als Zod-Schema, aus dem das JSON-Schema für n8n
  generiert wird. **Jedes Feld ist `nullable`** — „unbekannt" ist ein zulässiger Wert und
  besser als eine erfundene Angabe; der Prompt sagt das später explizit.
- **50 Seed-Pflanzen** als kuratiertes JSON, offline, ohne AI-Call. Grobe Aufteilung:
  - ~22 Zimmerpflanzen (Monstera, Efeutute, Bogenhanf, Phalaenopsis, Einblatt, Zamioculcas,
    Ficus, Aloe, Calathea, Drachenbaum, Grünlilie, Gummibaum, Alocasia, Philodendron …)
  - ~16 Garten/Balkon (Rose, Hortensie, Lavendel, Buchsbaum, Rhododendron, Oleander,
    Geranie, Clematis, Pfingstrose, Kirschlorbeer, Fuchsie, Flieder …)
  - ~12 Kräuter/Nutzpflanzen (Rosmarin, Thymian, Basilikum, Minze, Salbei, Petersilie,
    Schnittlauch, Tomate, Chili, Erdbeere, Zitrone, Olive)
- **Ein Test validiert alle 50 Seeds gegen das Zod-Schema.** Genau das beweist R3: Wenn das
  Schema 50 sehr verschiedene Pflanzen sauber abbildet, trägt es auch den Kalender.
- Standorte/Räume mit Himmelsrichtung und Lichteinschätzung
- Pflanzen-CRUD: Art aus dem Katalog wählen *oder* frei eintippen; Spitzname, Standort,
  Kaufdatum, Notizen, Foto direkt aus der Kamera
- **Suche:** SQLite **FTS5** über botanischen Namen, deutsche und englische Trivialnamen und
  Notizen; dazu Filter für Standort, Licht, Winterhärte, Giftigkeit für Haustiere
- Detailansicht mit allen Pflegedaten
- Offline-Lesen (Workbox: App-Shell precache, API stale-while-revalidate)

**DoD:** Die 50 Seeds sind durchsuchbar, eine eigene Pflanze lässt sich anlegen und
wiederfinden.

### M2 — AI-Anreicherung über n8n (Woche 4)

```
App ──POST /webhook/plant-enrich──► n8n ──► AI (Structured Output)
 ▲                                              │
 └──── POST /api/enrichment/callback ◄──────────┘
```

Bewusst **asynchron**: AI-Antworten brauchen 10–60 s, ein synchroner Request läuft in
Cloudflare- und Browser-Timeouts.

1. Neue Pflanze → Lookup in `species_cache` (Schlüssel: normalisierter botanischer Name +
   Schema-Version + Prompt-Version). Treffer → sofort fertig, **kein AI-Call, keine Kosten**.
2. Miss → Zeile in `enrichment_jobs` (`status=queued`), POST an den n8n-Webhook mit
   `{ jobId, query, locale: "de", hardinessZone, callbackUrl, schemaVersion }`. Signiert per
   **HMAC-SHA256** über den Body (`X-Plantapp-Signature`) plus Timestamp gegen Replay.
3. n8n: Normalisierung → AI-Node mit **Structured Output Parser** gegen unser JSON-Schema →
   optional Websuche zur Absicherung → Callback an die App, ebenfalls HMAC-signiert.
4. App validiert mit Zod, schreibt in `species_cache`, verknüpft die Pflanze und erzeugt
   daraus die Pflege-Regeln.
5. UI pollt den Job-Status. Timeout 120 s → `failed` mit Wiederholen-Button. n8n retryt
   max. 3× mit Backoff.
6. **Ist n8n aus, wird die Pflanze trotzdem angelegt** — Status „Profil ausstehend".
   Die AI darf nie ein Blocker sein.

Dazu im UI:

- **Review-Ansicht** mit Quellenangaben und Confidence pro Abschnitt
- **Manuelles Überschreiben mit Sperre:** jedes Feld editierbar; gesperrte Felder (`locked`)
  werden von einem späteren Re-Enrichment nicht überschrieben. Ohne das verliert man das
  Vertrauen in die App beim ersten Mal, wo die AI eine korrigierte Angabe wieder zerschießt.

**DoD:** „Hortensie" eintippen → wenige Sekunden später steht ein vollständiges, geprüftes
Pflegeprofil da. Damit ist R2 erledigt.

### M3 — Aufgaben und Kalender (Woche 5–6)

Der eigentliche Alltagsnutzen.

- **Regelgenerierung** aus dem Profil: Gießen, Düngen, Schnittfenster, Umtopfen,
  Winterschutz rein/raus, Ernte
- **Saisonale Intervalle:** Gießabstand je Jahreszeit (Sommer 4 Tage, Winter 12 Tage) statt
  einer starren Zahl
- `task_occurrences` werden rollierend 90 Tage im Voraus materialisiert (nächtlicher Job) —
  der Kalender liest dann nur noch, und „erledigt" hängt an der einzelnen Fälligkeit
- **„Erledigt" rechnet ab dem tatsächlichen Datum weiter**, nicht ab dem Plandatum — beim
  Gießen die einzig richtige Semantik
- **Heute-Ansicht** mit Quick-Actions: Erledigt / Später / Übersprungen
- **Kalender:** Monatsansicht (CSS-Grid + `date-fns`, bewusst kein schweres FullCalendar) und
  Agenda-Ansicht
- **Ebenen an-/abwählbar**, pro Nutzer gespeichert: Blütezeiten · Gießen · Düngen ·
  Schnittfenster · Umtopfen · Ernte · Winterschutz · Wetterwarnungen.
  Blütezeiten erscheinen als **Monatsbänder**, nicht als Einzeltermine.
- **ICS-Feed** unter `/api/calendar/feed.ics?token=…` — abonnierbar in Google Calendar;
  derselbe Feed ist später der billigste Weg, die Termine in Home Assistant zu spiegeln
- **Vorbereitung für HA:** Die Gieß-Fälligkeit wird so modelliert, dass ein externer Trigger
  (Bodenfeuchte-Sensor) sie vorziehen kann.

**DoD:** Der Kalender zeigt für die reale Sammlung sinnvolle Termine, Ebenen lassen sich
umschalten, Erledigen verschiebt korrekt.

### M4 — Erinnerungen scharf stellen (Woche 7)

- **Tägliche Zusammenfassung um 8:00** („3 Pflanzen brauchen heute Wasser") statt einer
  Benachrichtigung pro Aufgabe — Einzelspam killt die Akzeptanz binnen einer Woche
- Sofortige Benachrichtigungen nur bei echter Dringlichkeit (Frost)
- **Ruhezeiten** (nichts vor 8:00 / nach 21:00), pro Nutzer einstellbar
- **Notification-Actions** „Erledigt" und „Später" direkt aus der Benachrichtigung
- Abo-Hygiene: Subscriptions bei HTTP 404/410 automatisch entfernen
- Der Permission-Prompt erscheint **nur** nach explizitem Tap auf den Aktivieren-Button,
  nie beim ersten Laden
- Benachrichtigungseinstellungen pro Nutzer und Kategorie

### M5 — Wetter und Frostwarnung (Woche 8)

Open-Meteo, kein API-Key, kein Konto.

- **Standort einmalig im Setup:** Ortsname eintippen, Open-Meteo-Geocoding liefert die
  Koordinaten. Kein manuelles Nachschlagen von Lat/Lon.
- Nächtlicher Abruf der 7-Tage-Prognose, gecacht in `weather_cache`
- **Frostwarnung:** Tmin < 3 °C in den nächsten 48 h → Push mit konkreter Liste aller
  Pflanzen, deren `hardyToC` darüber liegt („Oleander, Zitrone und 2 weitere reinholen")
- **Regenregel:** > 5 mm in 24 h → Gießaufgaben an Außenstandorten automatisch verschoben,
  mit sichtbarer Begründung
- **Hitzewarnung:** Tmax > 30 °C → zusätzliche Gießerinnerung für Kübelpflanzen
- Historische Frostdaten (Open-Meteo-Archiv) → Fenster „Auspflanzen möglich ab"

> **Warum nicht die Wettervorhersage aus Home Assistant?** Technisch ginge das: Koordinaten
> aus `/api/config`, Prognose per Service-Call `weather.get_forecasts`. Dann hinge aber die
> nächtliche Frostwarnung — die Funktion, deren Ausfall echten Schaden anrichtet — daran,
> dass HA erreichbar ist und dort gerade eine Prognose-Integration mit den benötigten Feldern
> läuft. Historische Daten für „Auspflanzen ab" liefert HA ohnehin nicht. Das einzige echte
> Argument dafür war der vorgesetzte Standort, und den löst die Geocoding-Suche billiger.
> Bleibt sauber trennbar: Wenn HA später dazukommt, kann es die Koordinaten einmalig
> vorbefüllen.

### M6 — Härtung und Betrieb (Woche 9)

- **Offline-Schreiben:** IndexedDB-Outbox + Background Sync, serverseitige Idempotenz-Keys
  (R4)
- **Backup:** kein externer Dienst. Nächtlich schreibt der Scheduler einen konsistenten
  Snapshot per `VACUUM INTO` nach `/data/backups/plantapp-YYYY-MM-DD.db` und hält die letzten
  14 Stück. Weil `/data` ein Bind-Mount ist, nimmt die bestehende lokale Sicherung die
  Snapshots automatisch mit.
  Der `VACUUM INTO`-Weg ist wichtig: Eine laufende SQLite-Datei im WAL-Modus einfach zu
  kopieren kann einen inkonsistenten Stand ergeben, der Snapshot dagegen ist immer sauber.
  Der Restore wird einmal echt durchgespielt — ein ungetestetes Backup ist keins.
- Export/Import der kompletten Sammlung als JSON
- Rate-Limits, strukturiertes Logging
- **Update-Pfad:** `git push` → in Portainer „Pull and redeploy". Rollback durch Setzen des
  Git-Refs auf einen älteren Commit.
- **Urlaubsmodus:** druckbarer Pflegeplan (PDF) für den Nachbarn

---

## Architektur

```
Handy (Android, PWA installiert)
   │ HTTPS
   ▼
Cloudflare Edge — proxied DNS "plantsvsmella.inmc.info"
   │ Tunnel
   ▼
cloudflared (Container)
   │ docker-Netz
   ▼
plantapp (ein Node-Container)
├─ Fastify: API + statisches PWA-Build
├─ Scheduler (croner): Occurrences, Wetter, Push, Nacht-Snapshot
├─ web-push (VAPID)
└─ SQLite  /data/plantapp.db
      ▲
      └── Bind-Mount auf Host-Pfad (lokale Backup-Routine greift direkt darauf zu)

plantapp ──► n8n (lokal) ──► AI
        ──► Open-Meteo (Geocoding + Prognose + Archiv)
```

Kein Port-Forwarding, keine eingehende Firewall-Regel: `cloudflared` baut die Verbindung von
innen nach außen auf. TLS terminiert Cloudflare, die PWA sieht ein gültiges Zertifikat —
Voraussetzung für Installation und Web-Push.

### Warum SQLite und nicht Azure Table Storage

Der Wunsch war „keine DB betreiben, lokal, ohne Aufwand". Genau das ist SQLite: **eine
Datei** — kein Server, kein Port, kein Passwort, keine Schlüsselrotation. Dazu behält man
Joins, Transaktionen und mit FTS5 eine echte Volltextsuche, die für die Pflanzensuche
gebraucht wird.

Azure Table Storage wäre hier der teurere Weg: kein SQL, keine Joins, keine Volltextsuche,
Netzwerk-Latenz bei jedem Request — und man müsste doch etwas betreiben (Account, Keys,
Rotation, Kosten). Für zwei Nutzer und ein paar hundert Pflanzen ist SQLite um
Größenordnungen angemessener. Als Datei auf dem Bind-Mount liegt sie außerdem genau dort, wo
das bestehende Backup ohnehin hinschaut.

### Paketstruktur

```
packages/shared/     Zod-Schemas (Pflegeprofil, API-Verträge), aus denen das
                     JSON-Schema für n8n generiert wird — eine Quelle der Wahrheit
apps/api/            Fastify, Drizzle-Schema + Migrationen, Scheduler,
                     n8n-Client, Wetter-Client, web-push
apps/web/            React + Vite + vite-plugin-pwa, TanStack Query, Tailwind
data/seeds/          plants.seed.json (50 Pflanzen) + Validierungstest
docs/ROADMAP.md      dieses Dokument
Dockerfile           mehrstufig: pnpm-Build → Node-Runtime
infra/stack.yaml     Portainer-Stack (plantapp mit build:, cloudflared)
                     + n8n-Workflow-Export
```

### Build- und Deploy-Weg

```
git push  (Branch claude/plant-care-pwa-roadmap-8eyks5)
   ▼
Portainer, Stack "plantapp" (Typ: Repository) → "Pull and redeploy"
   │   klont das Repo auf den Docker-Host
   │   docker build gemäß infra/stack.yaml  (ca. 2–4 min)
   ▼
Container läuft, /data auf dem Bind-Mount, Migrationen beim Start
```

Kein externes CI, keine Registry, kein SSH auf die VM. Portainer braucht einmalig ein
GitHub-PAT mit Lesezugriff auf das Repo. Rollback = im Stack den Git-Ref auf einen älteren
Commit setzen und neu deployen.

Drei Dinge, die daraus folgen:

- **Dockerfile gut schichten**, damit der Rebuild auf der VM schnell bleibt: erst
  `pnpm-lock.yaml` + `package.json` kopieren und installieren, dann erst den Quellcode. Sonst
  dauert jeder Deploy mehrere Minuten.
- **Tests laufen nicht im Build.** Ohne CI wird lokal getestet; ein Deploy soll nicht an
  einem Testlauf auf dem Docker-Host hängen. Stattdessen ein **Git-Pre-Push-Hook**, der
  Typecheck und Tests ausführt, damit nichts Kaputtes auf den Branch kommt.
- **Healthcheck** im Stack auf `/api/health`, damit Portainer einen kaputten Start sichtbar
  macht statt einen scheinbar laufenden Container zu zeigen.

### Datenmodell (Kern)

- `users`, `sessions`, `push_subscriptions`
- `species` — Art + Pflegeprofil (Seeds und AI-Ergebnisse landen in derselben Tabelle)
- `species_cache` — AI-Ergebnis je (Name, Schema-Version, Prompt-Version) inkl. Quellen
- `plants` — die konkrete Pflanze: Spitzname, Standort, Foto, Notizen
- `plant_field_overrides` — manuelle Korrekturen mit `locked`-Flag
- `locations` — Raum/Beet, Himmelsrichtung, Innen/Außen, Lichteinschätzung
- `care_rules` → `task_occurrences` (materialisiert, 90 Tage rollierend)
- `enrichment_jobs`, `weather_cache`, `settings`

### Pflegeprofil-Schema (die zentrale Vertragsdefinition)

- `identity` — botanischer Name, Trivialnamen de/en, Familie, Sorte
- `placement` — Licht (`full_sun` | `partial_sun` | `bright_indirect` | `shade`),
  Innen/Außen, empfohlene Himmelsrichtung, Luftfeuchte min/max, Temperatur
  min/optimal/max, `hardy` (bool), `hardyToC`, Winterschutz
- `water` — Intervall je Jahreszeit, Menge, Methode, „oberste Schicht abtrocknen lassen"
- `soil` — Substrat, pH-Bereich, Drainage
- `fertilizer` — NPK, Rhythmus, Saisonfenster
- `pruning` — Zeitfenster mit Schnittart (Formschnitt, Auslichten, Verjüngung, Verblühtes)
- `repotting` — alle X Jahre, beste Monate
- `bloom` — Monate, Farbe, Duft, Verblühtes entfernen
- `harvest` — Monate (Nutzpflanzen)
- `propagation` — Methoden, beste Monate
- `toxicity` — für Haustiere und Kinder
- `size` — Höhe/Breite min/max, Wuchsgeschwindigkeit
- `problems` — Schädling/Krankheit, Symptome, Gegenmaßnahme
- `meta` — Confidence pro Abschnitt, Quellen, Modell, Schema- und Prompt-Version

---

## Risiken

| Risiko | Wo adressiert | Absicherung |
|---|---|---|
| Android-Push kommt nicht an | M0 | Echter Push-Test in Woche 1, bevor irgendwas anderes gebaut wird |
| Cloudflare Access bricht Service Worker | M0 | Access bewusst nicht davor; App-Login statt Edge-Auth |
| AI halluziniert / liefert unbrauchbares JSON | M2 | Structured Output + Zod-Validierung + `null` erlaubt + Quellen + manuelle Korrektur mit Sperre |
| AI-Kosten und Latenz | M2 | `species_cache` — jede Art wird genau einmal abgefragt |
| n8n nicht erreichbar | M2 | Async-Job, Pflanze wird trotzdem angelegt, Retry mit Backoff |
| Schema trägt Kalender nicht | M1 | 50 Seeds validieren das Schema, bevor Aufgaben-Code entsteht |
| Benachrichtigungs-Müdigkeit | M4 | Tagesbündelung + Ruhezeiten statt Push je Aufgabe |
| Datenverlust (eine Datei) | M6 | Nächtlicher `VACUUM INTO`-Snapshot, 14 Generationen, einmal echt getesteter Restore |
| Offline-Schreibkonflikte | M6 | Outbox + Idempotenz-Keys |
| Langsamer Rebuild auf der VM | M0 | Dockerfile-Layering, Tests außerhalb des Builds |

---

## Bewusst nicht in dieser Roadmap (Backlog)

Abgewählt oder zurückgestellt, damit die 9 Wochen halten:

- **Home Assistant** (bewusst später, als eigener Meilenstein danach): Bodenfeuchte-Entity
  pro Pflanze zuordenbar, Unterschreitung des Schwellwerts macht die Gießaufgabe sofort
  fällig statt nach Intervall — der Punkt, an dem die App vom Kalender zum Sensor wird. Dazu
  ICS-Feed als HA-Kalender und optional ein Webhook an HA bei Frostwarnung. Vorbereitet ist
  das schon: Der ICS-Feed entsteht in M3, und die Gieß-Fälligkeit wird dort so modelliert,
  dass ein externer Trigger sie vorziehen kann.
- Pflanzenerkennung und Krankheitsdiagnose per Foto (derselbe n8n-Webhook, Vision-Modell)
- QR-Etiketten für Töpfe, Scan öffnet die Pflanze
- Standort-Match-Score („passt diese Pflanze an dieses Fenster?") — die Daten dafür
  (Himmelsrichtung, Lichtbedarf) entstehen bereits in M1, nur die Bewertung fehlt
- Foto-Timeline zur Wachstumsdokumentation
- Aussaat- und Ernteplanung für Nutzpflanzen
- Mehr als zwei Nutzer, Rollen, Teilen

---

## Verifikation

Pro Meilenstein, nicht erst am Ende:

**M0** — In Portainer einen Repository-Stack auf `infra/stack.yaml` anlegen, Env-Variablen
setzen, deployen; Build läuft durch, Container ist gesund. `https://plantsvsmella.inmc.info`
**aus dem Mobilfunknetz** (nicht nur im WLAN) aufrufen; PWA auf beiden Handys installieren;
Testbenachrichtigung bei **geschlossener** App empfangen. Kommt sie nicht an, wird nichts
weiter gebaut, bis sie ankommt.

**M1** — `pnpm test` validiert alle 50 Seeds gegen das Zod-Schema; Suche nach „Monstera",
„Fensterblatt" und einem Tippfehler liefert Treffer; Flugmodus → App öffnen → Liste ist da.

**M2** — n8n-Workflow importieren, 10 reale Pflanzennamen durchschicken, Trefferquote und
Schema-Konformität protokollieren; n8n stoppen → Pflanze lässt sich trotzdem anlegen;
Callback mit falscher HMAC-Signatur wird abgelehnt.

**M3** — Systemzeit im Container vorspulen und prüfen, dass Occurrences korrekt erzeugt
werden; ICS-Feed in Google Calendar abonnieren; Ebenen-Toggles gegen die Anzeige prüfen.

**M4** — Testlauf der Tagesbündelung; Notification-Action „Erledigt" markiert die richtige
Aufgabe; Ruhezeit unterdrückt zuverlässig.

**M5** — Ortsname im Setup eingeben → Koordinaten stimmen; Wetter-Response mit Tmin −2 °C
mocken → Frostwarnung nennt genau die nicht winterharten Pflanzen; Regen-Mock verschiebt nur
Außenstandorte.

**M6** — Stack in Portainer entfernen und neu deployen, `plantapp.db` durch einen Snapshot
aus `/data/backups/` ersetzen, Datenbestand vergleichen. Offline zwei Aufgaben abhaken,
online gehen, Sync prüfen.

---

## Nächster Schritt

Umsetzung beginnt mit **M0** auf Branch `claude/plant-care-pwa-roadmap-8eyks5`.

Dafür gebraucht:

- der Host-Pfad für den `/data`-Bind-Mount
- Cloudflare-Tunnel-Token für `plantsvsmella.inmc.info`
- die n8n-Webhook-URL (bzw. deren Basis-URL im lokalen Netz)
- in Portainer einmalig ein GitHub-PAT mit Lesezugriff auf das Repo (für den
  Repository-Stack)

Der Standort für M5 wird in der App selbst per Ortsname gesetzt — dafür braucht es vorab
nichts.

**Arbeitsteilung:** Eine Claude-Code-Session in der Cloud hat keine Verbindung ins Heimnetz —
Portainer, n8n und die VM sind von dort nicht erreichbar. Sie kann Code schreiben und pushen;
Deploy und Verifikation der M0-Kette (Tunnel, Push aufs Handy) passieren auf der eigenen
Seite. Eine Session, die direkt auf der VM läuft (Claude Code als CLI im Repo-Verzeichnis),
hat Docker, Portainer und n8n im selben Netz und kann die Kette selbst schließen.
