const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, dependencies, transform = (source) => source) {
  const module = { exports: {} };
  const code = ts.transpileModule(transform(fs.readFileSync(file, "utf8")), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (id) => dependencies[id],
    Error,
    setTimeout,
  });
  return module.exports;
}

function reactHarness() {
  const state = [];
  const effects = [];
  let cursor = 0;
  const react = {
    createContext: () => ({ Provider: "ContextProvider" }),
    createElement: (type, props, ...children) => ({
      type,
      props: { ...(props || {}), children },
    }),
    useContext: () => null,
    useEffect: (effect) => effects.push(effect),
    useRef: (initial) => {
      const index = cursor++;
      if (!(index in state)) state[index] = { current: initial };
      return state[index];
    },
    useState: (initial) => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [
        state[index],
        (value) => {
          state[index] =
            typeof value === "function" ? value(state[index]) : value;
        },
      ];
    },
  };
  react.default = react;
  return {
    react,
    render(component) {
      cursor = 0;
      return component();
    },
    flushEffects() {
      effects.splice(0).forEach((effect) => effect());
    },
  };
}

test("missing Supabase configuration becomes a recoverable auth state", () => {
  const harness = reactHarness();
  const message =
    "Supabase is not configured. Set the public project URL and publishable key in .env.local.";
  const { AuthProvider } = load("src/live/AuthProvider.tsx", {
    react: harness.react,
    "react-native": { Alert: {}, AppState: {}, Linking: {} },
    "../services/supabase": {
      getSupabaseClient: () => {
        throw new Error(message);
      },
    },
    "../services/sessionStorage": { protectedSessionStorage: {} },
    "../services/nativeAuth": { nativeFlowOptions: async () => ({}) },
    "./authLinks": { createAuthLinkHandler: () => async () => {} },
    "./recoveryState": {
      recoveryState: () => ({
        begin: async () => {},
        clear: async () => {},
        pending: async () => false,
      }),
    },
  });
  harness.render(() => AuthProvider({ children: "content" }));
  assert.doesNotThrow(() => harness.flushEffects());
  const tree = harness.render(() => AuthProvider({ children: "content" }));
  assert.equal(tree.props.value.ready, true);
  assert.equal(tree.props.value.error, message);
});

test("configuration error screen can enter the isolated offline demo", () => {
  const harness = reactHarness();
  const { Routes } = load(
    "src/live/BackendApp.tsx",
    {
      react: harness.react,
      "react-native": { Pressable: "Pressable", Text: "Text", View: "View" },
      "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
      "./AuthProvider": {
        AuthProvider: "AuthProvider",
        useAuth: () => ({
          session: null,
          ready: true,
          recovery: false,
          error: "Supabase is not configured.",
          retry: () => {},
        }),
      },
      "./AuthScreen": { AuthScreen: "AuthScreen" },
      "./LiveMarketplace": { LiveMarketplace: "LiveMarketplace" },
      "../state/MarketplaceProvider": { MarketplaceProvider: "MarketplaceProvider" },
      "../navigation/AppNavigator": { AppNavigator: "AppNavigator" },
      "../theme/marketplace": { ui: {} },
    },
    (source) => source.replace("function Routes()", "export function Routes()"),
  );
  const find = (node, predicate) => {
    if (!node || typeof node !== "object") return null;
    if (predicate(node)) return node;
    for (const child of node.props?.children || []) {
      const match = find(child, predicate);
      if (match) return match;
    }
    return null;
  };
  let tree = harness.render(Routes);
  const link = find(
    tree,
    (node) =>
      node.type === "Text" &&
      node.props.children.includes("Open the separate offline demo"),
  );
  assert.ok(link);
  find(tree, (node) => node.type === "Pressable" && node.props.children.includes(link))
    .props.onPress();
  tree = harness.render(Routes);
  assert.ok(find(tree, (node) => node.type === "AppNavigator"));
});

test("listing limit migration locks each owner before counting", () => {
  const sql = fs.readFileSync(
    "supabase/migrations/20261025164404_serialize_listing_limit.sql",
    "utf8",
  );
  const lock = sql.indexOf(
    "pg_advisory_xact_lock(hashtextextended(new.owner_id::text,5))",
  );
  const count = sql.indexOf("select count(*) from public.listings");
  assert.ok(lock >= 0);
  assert.ok(count > lock);
  assert.match(sql, /create or replace function private\.listing_limit\(\)/);
});
