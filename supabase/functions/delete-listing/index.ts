import { createClient } from "npm:@supabase/supabase-js@2.118.0";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply(405, { error: "Use POST" });
  const bearer = req.headers.get("Authorization") || "";
  if (!bearer.startsWith("Bearer "))
    return reply(401, { error: "Sign in before deleting a listing." });
  let body;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: "Confirm listing deletion." });
  }
  if (
    body?.confirmation !== "DELETE" ||
    !/^\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      body?.id || "",
    )
  )
    return reply(400, { error: "Invalid listing or confirmation." });
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
  if (error || !user?.email_confirmed_at || user.is_anonymous)
    return reply(401, { error: "A verified account is required." });
  // RPC locks the row, checks the live session, ownership, removal status and
  // moderation flag before any service-privileged storage cleanup begins.
  const begun = await client.rpc("begin_listing_deletion", { target: body.id });
  if (begun.error)
    return reply(403, {
      error:
        "Deletion refused. Remove your own listing first; moderator-removed listings cannot be deleted. Refresh or sign in again.",
    });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const manifest = await admin.rpc("listing_cleanup_manifest", {
      target: body.id,
      account: user.id,
    });
    if (manifest.error || !manifest.data) throw Error();
    const protectedPaths = new Set<string>(manifest.data.protected_paths || []);
    const prefix = `${user.id}/${body.id}-`;
    const original = manifest.data.original_photo as string;
    if (!original.startsWith(user.id + "/")) throw Error();
    const bucket = admin.storage.from("market-listing-images");
    const purge = async () => {
      const candidates = new Set<string>();
      for (let batch = 0; batch < 100; batch++) {
        const found = await bucket.list(user.id, {
          limit: 100,
          offset: batch * 100,
          search: body.id + "-",
        });
        if (found.error) throw Error();
        for (const f of found.data || []) {
          const path = `${user.id}/${f.name}`;
          if (path.startsWith(prefix) && !protectedPaths.has(path))
            candidates.add(path);
        }
        if ((found.data?.length || 0) < 100) break;
        if (batch === 99) throw Error();
      }
      const paths = [...candidates];
      for (let i = 0; i < paths.length; i += 100) {
        const removed = await bucket.remove(paths.slice(i, i + 100));
        if (removed.error) throw Error();
      }
      if (!protectedPaths.has(original)) {
        const removed = await bucket.remove([original]);
        if (removed.error) throw Error();
      }
    };
    await purge();
    await purge();
    const finished = await admin.rpc("finish_listing_deletion", {
      target: body.id,
      account: user.id,
    });
    if (finished.error) throw Error();
    return reply(200, {
      id: body.id,
      deleted: true,
      retained_evidence: manifest.data.retained_evidence === true,
    });
  } catch {
    return reply(503, {
      error:
        "The listing is hidden, but photo cleanup was not confirmed. Retry Delete permanently for this listing. Contact support if retry is unavailable.",
    });
  }
});
