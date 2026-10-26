import { readFile } from "node:fs/promises";

// Load only the two public connection settings; never print key values.
try {
  const local = await readFile(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of local.split(/\r?\n/)) {
    const match = line.match(/^(EXPO_PUBLIC_SUPABASE_(?:URL|PUBLISHABLE_KEY))=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key?.startsWith("sb_publishable_")) throw new Error("Missing public backend configuration.");
const response = await fetch(new URL("/auth/v1/settings", url), {
  headers: { apikey: key }, signal: AbortSignal.timeout(15000),
});
if (!response.ok) throw new Error(`Supabase connection check failed (HTTP ${response.status}).`);
const settings = await response.json();
console.log("Supabase connection: OK");
console.log(`Email authentication: ${settings.external?.email ? "enabled" : "disabled"}`);
console.log(`Email confirmation: ${settings.mailer_autoconfirm ? "not required" : "required"}`);
