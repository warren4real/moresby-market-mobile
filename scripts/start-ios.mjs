import { spawn, execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { readdirSync } from "node:fs";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}
let metro;
function stop(signal = "SIGTERM") {
  if (metro && metro.exitCode === null) metro.kill(signal);
}
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop());
try {
  const inventory = JSON.parse(
    execFileSync(
      "xcrun",
      ["simctl", "list", "devices", "available", "--json"],
      { encoding: "utf8" },
    ),
  );
  const phones = Object.values(inventory.devices)
    .flat()
    .filter((d) => d.name.startsWith("iPhone"));
  const device =
    phones.find((d) => d.udid === process.env.SIMULATOR_UDID) ||
    phones.find((d) => d.state === "Booted") ||
    phones.find((d) => d.name === "iPhone 17 Pro") ||
    phones[0];
  if (!device) throw new Error("No installed iPhone simulator was found.");
  console.log(`Preparing ${device.name}…`);
  if (device.state !== "Booted")
    await run("xcrun", ["simctl", "boot", device.udid]);
  await run("xcrun", ["simctl", "bootstatus", device.udid, "-b"]);
  // Xcode's Device Hub viewer does not use the legacy Simulator app launcher.
  await run("open", [
    "-a",
    "/Applications/Xcode.app/Contents/Applications/DeviceHub.app",
  ]);
  const statusURL = "http://127.0.0.1:8081/status";
  const running = async () => {
    try {
      const r = await fetch(statusURL, { signal: AbortSignal.timeout(1500) });
      return (await r.text()).includes("packager-status:running");
    } catch {
      return false;
    }
  };
  if (await running())
    throw new Error(
      "Port 8081 already has a development server. Stop it before running npm run ios.",
    );
  const cli = fileURLToPath(
    new URL("../node_modules/expo/bin/cli", import.meta.url),
  );
  metro = spawn(
    process.execPath,
    [
      "--dns-result-order=ipv4first",
      cli,
      "start",
      "--go",
      "--localhost",
      "--port",
      "8081",
    ],
    { cwd: root, stdio: "inherit" },
  );
  metro.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  const exited = new Promise((resolve) =>
    metro.on("exit", (code) => resolve(code)),
  );
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (metro.exitCode !== null)
      throw new Error("Expo stopped before it was ready.");
    if (await running()) {
      ready = true;
      break;
    }
    await delay(1000);
  }
  if (!ready) throw new Error("Expo did not become ready in time.");
  // Expo Go was installed during the initial setup. Open it directly, bypassing
  // Expo CLI's legacy Simulator window timeout.
  try {
    execFileSync(
      "xcrun",
      ["simctl", "get_app_container", device.udid, "host.exp.Exponent", "app"],
      { stdio: "ignore" },
    );
  } catch {
    const cache = path.join(homedir(), ".expo/ios-simulator-app-cache");
    const app = readdirSync(cache)
      .filter((name) => name.startsWith("Expo-Go-58.") && name.endsWith(".app"))
      .sort()
      .at(-1);
    if (!app)
      throw new Error(
        "Expo Go is not installed and no SDK 58 simulator download is cached.",
      );
    await run("xcrun", [
      "simctl",
      "install",
      device.udid,
      path.join(cache, app),
    ]);
  }
  await run("xcrun", [
    "simctl",
    "openurl",
    device.udid,
    "exp://127.0.0.1:8081",
  ]);
  console.log(
    "Moresby Market is opening. Save a file to refresh; press Ctrl+C to stop Expo.",
  );
  process.exitCode = (await exited) || 0;
} catch (error) {
  console.error(error.message);
  stop();
  process.exitCode = 1;
}
