import fs from "node:fs";
import path from "node:path";
import webpush from "web-push";
import { DATA_DIR } from "./db/paths.js";

const VAPID_PATH = path.join(DATA_DIR, "vapid.json");

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

function loadOrCreateVapidKeys(): VapidKeys {
  if (fs.existsSync(VAPID_PATH)) {
    return JSON.parse(fs.readFileSync(VAPID_PATH, "utf-8"));
  }

  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_PATH, JSON.stringify(keys, null, 2));
  return keys;
}

export const vapidKeys = loadOrCreateVapidKeys();

webpush.setVapidDetails(
  "mailto:plantapp@inmc.info",
  vapidKeys.publicKey,
  vapidKeys.privateKey,
);

export { webpush };
