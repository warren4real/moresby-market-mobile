const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const { createClient } = require("@supabase/supabase-js");
const { createHash } = require("node:crypto");
function load(file, deps = {}) {
  const m = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    { module: m, exports: m.exports, require: (id) => deps[id] },
  );
  return m.exports;
}
const { nativeFlowOptions, AUTH_STORAGE_KEY } = load(
  "src/services/nativeAuth.ts",
);
const { makeProtectedStorage } = load("src/services/sessionStorage.ts", {
  "expo-secure-store": {},
});
const { recoveryState } = load("src/live/recoveryState.ts");
function fixture() {
  const map = new Map();
  const store = makeProtectedStorage({
    getItemAsync: async (k) => map.get(k) ?? null,
    setItemAsync: async (k, v) => map.set(k, v),
    deleteItemAsync: async (k) => {
      map.delete(k);
    },
  });
  let challenge,
    method,
    exchanges = 0;
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.invalid",
    app_metadata: { provider: "email" },
    user_metadata: {},
  };
  const token =
    Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url") +
    "." +
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 3600,
        session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    ).toString("base64url") +
    "." +
    Buffer.from("test-signature").toString("base64url");
  const fetch = async (url, options) => {
    const body = options?.body ? JSON.parse(options.body) : {};
    if (/\/(signup|recover|resend)/.test(url)) {
      challenge = body.code_challenge;
      method = body.code_challenge_method;
      return new Response(JSON.stringify({ user }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("grant_type=pkce")) {
      exchanges++;
      const actual =
        method === "s256"
          ? createHash("sha256").update(body.code_verifier).digest("base64url")
          : body.code_verifier;
      assert.equal(actual, challenge);
      return new Response(
        JSON.stringify({
          access_token: token,
          refresh_token: "fixture-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.endsWith("/user"))
      return new Response(JSON.stringify(user), { status: 200 });
    throw Error("Unexpected test request");
  };
  const client = () =>
    createClient("https://example.supabase.co", "fixture-public-key", {
      global: { fetch },
      auth: {
        flowType: "pkce",
        storage: store,
        storageKey: AUTH_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  return {
    store,
    user,
    client,
    get exchanges() {
      return exchanges;
    },
  };
}
async function nativeDOM(fn) {
  const old = {
    window: global.window,
    document: global.document,
    BroadcastChannel: global.BroadcastChannel,
  };
  global.window = { addEventListener() {}, removeEventListener() {} };
  global.document = {
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
  };
  global.BroadcastChannel = undefined;
  try {
    await fn();
  } finally {
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete global[k];
      else global[k] = v;
    }
  }
}
test("installed SDK reproduces browser-location error before native code exchange", async () => {
  await nativeDOM(async () => {
    const f = fixture(),
      c = f.client();
    await assert.rejects(c.auth.exchangeCodeForSession("test"), /href/);
    assert.equal(f.exchanges, 0);
    c.auth.stopAutoRefresh();
  });
});
test("native confirmation uses persisted flow and real SDK exchange without browser location", async () => {
  await nativeDOM(async () => {
    const f = fixture(),
      c = f.client();
    await c.auth.signUp({
      email: "test@example.invalid",
      password: "test-fixture-password",
      options: { emailRedirectTo: "moresbymarket://auth/callback" },
    });
    const events = [];
    c.auth.onAuthStateChange((event) => events.push(event));
    const result = await c.auth.exchangeCodeForSession(
      "test",
      await nativeFlowOptions(f.store),
    );
    assert.equal(result.error, null);
    assert.equal(result.data.session.user.id, f.user.id);
    assert.equal(f.exchanges, 1);
    assert.ok(events.includes("SIGNED_IN"));
    const persisted = await c.auth.getSession();
    assert.equal(persisted.data.session.user.id, f.user.id);
    c.auth.stopAutoRefresh();
  });
});
test("native recovery retains recovery attribution through the SDK exchange", async () => {
  await nativeDOM(async () => {
    const f = fixture(),
      c = f.client();
    await c.auth.resetPasswordForEmail("test@example.invalid", {
      redirectTo: "moresbymarket://auth/callback",
    });
    const events = [];
    c.auth.onAuthStateChange((e) => events.push(e));
    const result = await c.auth.exchangeCodeForSession(
      "test",
      await nativeFlowOptions(f.store),
    );
    assert.equal(result.error, null);
    assert.ok(events.includes("PASSWORD_RECOVERY"));
    c.auth.stopAutoRefresh();
  });
});
test("resend creates a usable new native flow and missing verifier fails closed", async () => {
  const f = fixture(),
    c = f.client();
  await assert.rejects(
    nativeFlowOptions(f.store),
    (e) => e.code === "pkce_code_verifier_not_found",
  );
  await c.auth.resend({ type: "signup", email: "test@example.invalid" });
  const result = await c.auth.exchangeCodeForSession(
    "test",
    await nativeFlowOptions(f.store),
  );
  assert.equal(result.error, null);
  c.auth.stopAutoRefresh();
});
test("recovery screen marker survives restart, stays user-bound and clears after completion", async () => {
  const f = fixture(),
    first = recoveryState(f.store);
  await first.begin(f.user.id);
  const second = recoveryState(f.store);
  assert.equal(await second.pending(f.user.id), true);
  assert.equal(await second.pending("different-user"), false);
  await second.clear();
  assert.equal(await first.pending(f.user.id), false);
});
test("confirmation verifier survives a cold start before exchange", async () => {
  const f = fixture(),
    first = f.client();
  await first.auth.resend({ type: "signup", email: "test@example.invalid" });
  first.auth.stopAutoRefresh();
  const relaunched = f.client();
  await relaunched.auth.getSession();
  const result = await relaunched.auth.exchangeCodeForSession(
    "test",
    await nativeFlowOptions(f.store),
  );
  assert.equal(result.error, null);
  relaunched.auth.stopAutoRefresh();
});
test("explicit missing flow does not borrow another pending verifier", async () => {
  const f = fixture(),
    c = f.client();
  await c.auth.resend({ type: "signup", email: "test@example.invalid" });
  const result = await c.auth.exchangeCodeForSession(
    "test",
    await nativeFlowOptions(f.store, "missing-flow"),
  );
  assert.equal(result.error.code, "pkce_code_verifier_not_found");
  assert.equal(f.exchanges, 0);
  c.auth.stopAutoRefresh();
});
const { completeRecovery } = load("src/live/completeRecovery.ts");
test("failed password update cannot report success or revoke sessions", async () => {
  let revoked = false,
    finished = false;
  await assert.rejects(
    completeRecovery(
      {
        updateUser: async () => ({ error: Error("failure") }),
        signOut: async () => {
          revoked = true;
          return { error: null };
        },
      },
      "new",
      false,
      () => {},
      async () => {
        finished = true;
      },
    ),
  );
  assert.equal(revoked, false);
  assert.equal(finished, false);
});
test("failed revocation keeps recovery open and retry skips a second password change", async () => {
  let changes = 0,
    changed = false,
    finished = false,
    fail = true;
  const auth = {
    updateUser: async () => {
      changes++;
      return { error: null };
    },
    signOut: async () => ({ error: fail ? Error("network") : null }),
  };
  await assert.rejects(
    completeRecovery(
      auth,
      "new",
      false,
      () => (changed = true),
      async () => {
        finished = true;
      },
    ),
  );
  assert.equal(changed, true);
  assert.equal(finished, false);
  fail = false;
  await completeRecovery(
    auth,
    "",
    changed,
    () => {},
    async () => {
      finished = true;
    },
  );
  assert.equal(changes, 1);
  assert.equal(finished, true);
});
