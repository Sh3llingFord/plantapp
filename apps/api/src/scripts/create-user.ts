import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { hashPassword } from "../auth/password.js";
import { runMigrations } from "../db/migrate.js";

const [username, password] = process.argv.slice(2);

if (!username || !password) {
  console.error("Nutzung: node dist/scripts/create-user.js <username> <password>");
  process.exit(1);
}

runMigrations();

const existing = db.select().from(users).where(eq(users.username, username)).get();
if (existing) {
  console.error(`Nutzer ${username} existiert bereits.`);
  process.exit(1);
}

const passwordHash = await hashPassword(password);
db.insert(users)
  .values({ id: randomUUID(), username, passwordHash, createdAt: new Date() })
  .run();

console.log(`Nutzer ${username} angelegt.`);
