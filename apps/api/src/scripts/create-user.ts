import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { hashPassword } from "../auth/password.js";
import { runMigrations } from "../db/migrate.js";

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("Nutzung: node dist/scripts/create-user.js <email> <password>");
  process.exit(1);
}

runMigrations();

const existing = db.select().from(users).where(eq(users.email, email)).get();
if (existing) {
  console.error(`Nutzer ${email} existiert bereits.`);
  process.exit(1);
}

const passwordHash = await hashPassword(password);
db.insert(users)
  .values({ id: randomUUID(), email, passwordHash, createdAt: new Date() })
  .run();

console.log(`Nutzer ${email} angelegt.`);
