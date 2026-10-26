import { createClient } from "npm:@supabase/supabase-js@2.118.0";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Content-Type": "application/json",
};
const reply = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply(405, "Use POST");
  const bearer = req.headers.get("Authorization") || "";
  if (!bearer.startsWith("Bearer "))
    return reply(401, "Sign in to delete your account.");
  const url = Deno.env.get("SUPABASE_URL")!,
    key = Deno.env.get("SUPABASE_ANON_KEY")!;
  const client = createClient(url, key, {
    global: { headers: { Authorization: bearer } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user?.email || user.is_anonymous || !user.email_confirmed_at)
    return reply(401, "Sign in again before deleting your account.");
  let body;
  try {
    body = await req.json();
  } catch {
    return reply(400, "Confirm deletion and enter your password.");
  }
  if (
    body?.confirmation !== "DELETE" ||
    typeof body.password !== "string" ||
    !body.password ||
    body.password.length > 1024
  )
    return reply(400, "Type DELETE and enter your current password.");
  // Isolated client: password verification never changes the app's session.
  const reauth = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verified = await reauth.auth.signInWithPassword({
    email: user.email,
    password: body.password,
  });
  if (verified.error || verified.data.user?.id !== user.id)
    return reply(403, "Password could not be verified. Check it and retry.");
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let started = false;
  try {
    const begun = await admin.rpc("begin_account_deletion", {
      target: user.id,
    });
    if (begun.error) throw Error("Could not start deletion.");
    started = true;
    // All active sessions, including the reauthentication session, were revoked
    // atomically with the private marker. RLS hides listings and rejects writes.
    const bucket = admin.storage.from("market-listing-images");
    const purge = async () => {
      for (let batch = 0; batch < 100; batch++) {
        const listed = await bucket.list(user.id, { limit: 100, offset: 0 });
        if (listed.error) throw Error("Photo cleanup failed.");
        if (!listed.data?.length) return;
        const paths = listed.data.map((file) => `${user.id}/${file.name}`);
        const removed = await bucket.remove(paths);
        if (removed.error) throw Error("Photo cleanup failed.");
      }
      throw Error("Photo cleanup requires another attempt.");
    };
    await purge();
    const deleted = await admin.auth.admin.deleteUser(user.id, false);
    if (deleted.error) throw Error("Account cleanup failed.");
    // Sweep again for uploads already in flight before the marker was written.
    await purge();
    const finished = await admin.rpc("finish_account_deletion", {
      target: user.id,
    });
    if (finished.error)
      throw Error("Deletion completion could not be recorded.");
    return new Response(JSON.stringify({ deleted: true }), { headers });
  } catch {
    return reply(
      503,
      started
        ? "Your account is hidden and its sessions are revoked, but cleanup could not finish. If you can still sign in, retry deletion. Otherwise contact the app operator to finish cleanup."
        : "Deletion could not start. Check your connection and retry.",
    );
  }
});
