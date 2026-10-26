import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import jpeg from "npm:jpeg-js@0.4.4";
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
  if (!bearer.startsWith("Bearer ")) return reply(401, "Sign in to edit.");
  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: bearer } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();
  if (authError || !user || user.is_anonymous || !user.email_confirmed_at)
    return reply(401, "A verified account is required.");
  let imagePath: string | undefined;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  try {
    if (Number(req.headers.get("content-length") || 0) > 6 * 1024 * 1024)
      return reply(413, "Photo is too large.");
    const form = await req.formData();
    let fields;
    try {
      fields = JSON.parse(String(form.get("listing")));
    } catch {
      return reply(400, "Invalid listing details.");
    }
    if (
      !fields ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        fields.id || "",
      )
    )
      return reply(400, "Invalid listing ID.");
    if (
      typeof fields.title !== "string" ||
      !fields.title.trim() ||
      fields.title.trim().length > 100 ||
      typeof fields.description !== "string" ||
      !fields.description.trim() ||
      fields.description.trim().length > 2000 ||
      typeof fields.price !== "number" ||
      !Number.isFinite(fields.price) ||
      fields.price < 0 ||
      fields.price > 9999999999.99
    )
      return reply(400, "Check the title, description and price.");
    const before = fields.before;
    if (
      !before ||
      typeof before.title !== "string" ||
      typeof before.description !== "string" ||
      typeof before.image_path !== "string" ||
      typeof before.price !== "number"
    )
      return reply(400, "Reopen this listing and retry.");
    const { data: existing, error: readError } = await userClient
      .from("listings")
      .select("id,owner_id,status,title,description,price,image_path")
      .eq("id", fields.id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (readError || !existing || existing.status === "removed")
      return reply(404, "This listing is no longer available to edit.");
    if (
      existing.title !== before.title ||
      existing.description !== before.description ||
      Number(existing.price) !== before.price ||
      existing.image_path !== before.image_path
    )
      return reply(
        409,
        "This listing changed elsewhere. Close the editor, refresh listings and reopen it.",
      );
    const photo = form.get("photo");
    if (photo !== null) {
      if (
        !(photo instanceof File) ||
        photo.size > 5 * 1024 * 1024 ||
        photo.size < 4
      )
        return reply(400, "Choose a JPEG photo under 5 MB.");
      const { count } = await admin
        .from("listing_assets")
        .select("path", { count: "exact", head: true })
        .eq("owner_id", user.id)
        .gte("created_at", new Date(Date.now() - 86400000).toISOString());
      if (count === null || count >= 30)
        return reply(429, "Daily photo limit reached. Try again tomorrow.");
      const bytes = new Uint8Array(await photo.arrayBuffer());
      if (bytes[0] !== 255 || bytes[1] !== 216)
        return reply(400, "Choose a valid JPEG photo.");
      const decoded = jpeg.decode(bytes, {
        useTArray: true,
        maxResolutionInMP: 8,
        maxMemoryUsageInMB: 96,
      });
      // Publish pixels only; never EXIF or embedded location metadata.
      const clean = jpeg.encode(
        { data: decoded.data, width: decoded.width, height: decoded.height },
        70,
      ).data;
      if (clean.length > 1048576)
        return reply(400, "Photo is too detailed. Choose a smaller image.");
      imagePath = `${user.id}/${fields.id}-${crypto.randomUUID()}.jpg`;
      const upload = await admin.storage
        .from("market-listing-images")
        .upload(imagePath, clean, { contentType: "image/jpeg", upsert: false });
      if (upload.error) throw Error("Photo could not be saved.");
      const asset = await admin
        .from("listing_assets")
        .insert({ path: imagePath, owner_id: user.id });
      if (asset.error) throw Error("Photo record could not be saved.");
    }
    // All listing writes use the caller's RLS, never the service role.
    const patch = {
      title: fields.title.trim(),
      description: fields.description.trim(),
      price: fields.price,
      ...(imagePath ? { image_path: imagePath } : {}),
    };
    const result = await userClient
      .from("listings")
      .update(patch)
      .eq("id", fields.id)
      .eq("owner_id", user.id)
      .neq("status", "removed")
      .eq("title", before.title)
      .eq("description", before.description)
      .eq("price", before.price)
      .eq("image_path", before.image_path)
      .select("id")
      .maybeSingle();
    if (result.error)
      throw Error(
        "Changes could not be saved. Check your details and verified session.",
      );
    if (!result.data)
      throw Error(
        "Listing could not be updated because it changed or your session expired. Refresh and reopen it.",
      );
    // Keep the old asset private to its owner; do not break already-issued URLs.
    return new Response(JSON.stringify(result.data), { headers });
  } catch (error) {
    if (imagePath) {
      // A transport error can hide a committed update. Never delete a photo
      // until its asset row can be removed: the listing FK protects committed photos.
      const cleanup = await admin
        .from("listing_assets")
        .delete()
        .eq("path", imagePath);
      if (!cleanup.error)
        await admin.storage.from("market-listing-images").remove([imagePath]);
    }
    return reply(
      400,
      error instanceof Error && /could not/.test(error.message)
        ? error.message
        : "Could not process this photo or listing.",
    );
  }
});
