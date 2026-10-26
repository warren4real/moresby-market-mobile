import * as FileSystem from "expo-file-system/legacy";

function directory() {
  if (!FileSystem.documentDirectory) throw new Error("Photo storage unavailable");
  return `${FileSystem.documentDirectory}listing-photos/`;
}
// Rebase our own file paths when iOS changes the app sandbox after an update.
export function resolvePhoto(uri: string): string {
  const name = uri.match(/\/listing-photos\/([a-zA-Z0-9._-]+)$/)?.[1];
  return name ? directory() + name : uri;
}
export async function persistPhoto(uri: string): Promise<string> {
  if (/^https?:\/\//i.test(uri)) return uri;
  const rebased = resolvePhoto(uri);
  if (rebased !== uri || uri.startsWith(directory())) return rebased;
  await FileSystem.makeDirectoryAsync(directory(), { intermediates: true });
  const match = uri.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.*)$/s);
  const extension = match ? (match[1] === "png" ? "png" : "jpg") : (uri.match(/\.(png|jpe?g|heic|webp)(?:[?#]|$)/i)?.[1] || "jpg");
  const target = `${directory()}${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  if (match) await FileSystem.writeAsStringAsync(target, match[2], { encoding: "base64" });
  else if (/^(file|content):\/\//i.test(uri)) await FileSystem.copyAsync({ from: uri, to: target });
  else throw new Error("Unsupported photo source");
  return target;
}
