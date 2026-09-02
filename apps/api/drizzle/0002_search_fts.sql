-- Volltextsuche über botanischen Namen, deutsche/englische Trivialnamen (species)
-- sowie Spitzname/freier Artname/Notizen (plants). Wird von der Anwendung gepflegt
-- (Insert/Update/Delete bei species- und plants-Schreibzugriffen), nicht per Trigger,
-- da die durchsuchbaren Texte aus JSON-Feldern (commonNames) zusammengesetzt werden.
CREATE VIRTUAL TABLE search_fts USING fts5(
  text,
  kind UNINDEXED,
  ref_id UNINDEXED
);
