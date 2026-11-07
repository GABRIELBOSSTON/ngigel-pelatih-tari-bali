// Pembantu bersama alat uji: argumen baris perintah, server aplikasi, dan Chrome tanpa layar lewat
// Chrome DevTools Protocol (CDP). Tanpa pustaka tambahan; butuh Node ≥ 22 (fetch dan WebSocket bawaan).
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PROYEK = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

/** "--kunci nilai" → { kunci: "nilai" }; "--bendera" tanpa nilai → true. */
export function bacaArgumen(argv = process.argv.slice(2)) {
  const hasil = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const kunci = argv[i].slice(2);
    const nilai = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    hasil[kunci] = nilai;
  }
  return hasil;
}

/** Lokasi Chrome: --chrome, variabel CHROME, atau lokasi bawaan Windows. */
export const lokasiChrome = (arg) => arg.chrome ?? process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

/**
 * Menyalakan server aplikasi dari folder proyek:
 * - "preview": build produksi lewat `vite preview` (bawaan);
 * - "vercel-lokal": dist/ dengan header dan rewrite dari vercel.json (server-vercel-lokal.mjs);
 * - "dev": server pengembangan `vite` (StrictMode aktif).
 */
export async function nyalakanServer(jenis, port) {
  const vite = join(PROYEK, "node_modules/vite/bin/vite.js");
  const argumen = {
    preview: [vite, "preview", "--port", String(port), "--strictPort"],
    dev: [vite, "--port", String(port), "--strictPort"],
    "vercel-lokal": [join(PROYEK, "scripts/uji/server-vercel-lokal.mjs"), "--port", String(port)],
  }[jenis];
  if (!argumen) throw new Error(`jenis server tidak dikenal: ${jenis}`);
  const proses = spawn(process.execPath, argumen, { cwd: PROYEK, stdio: "ignore" });
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(`http://localhost:${port}/`)).ok) return proses;
    } catch {}
    await tunggu(500);
  }
  proses.kill();
  throw new Error(`server ${jenis} tidak menyala di port ${port}`);
}

/**
 * Chrome tanpa layar dengan kamera palsu. `kamera` = berkas MJPEG/Y4M untuk kamera palsu (opsional).
 * Mengembalikan fungsi kirim (CDP), nilai (Runtime.evaluate), dan log galat/peringatan konsol.
 */
export async function bukaChrome({ chrome, profil, port, kamera, unduhKe, bendera = [] }) {
  const daftar = ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, "--no-first-run", "--no-default-browser-check",
    "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required", "--hide-scrollbars", ...bendera];
  if (kamera) daftar.push(`--use-file-for-fake-video-capture=${kamera}`);
  const proses = spawn(chrome, [...daftar, "about:blank"], { stdio: "ignore" });
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch {}
    if (!target) await tunggu(500);
  }
  if (!target) { proses.kill(); throw new Error("Chrome tidak bisa dihubungi lewat CDP"); }
  if (unduhKe) {
    // Unduhan (mis. tombol "Unduh pelajaran") diizinkan dan disimpan ke folder ini.
    const versi = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const wsPeramban = new WebSocket(versi.webSocketDebuggerUrl);
    await new Promise((r) => wsPeramban.addEventListener("open", r, { once: true }));
    wsPeramban.send(JSON.stringify({ id: 1, method: "Browser.setDownloadBehavior", params: { behavior: "allow", downloadPath: unduhKe } }));
    await tunggu(300);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const tunggak = new Map();
  const log = [];
  const kirim = (method, params = {}) => new Promise((r) => { const i = ++id; tunggak.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && tunggak.has(m.id)) { tunggak.get(m.id)(m); tunggak.delete(m.id); return; }
    if (m.method === "Runtime.exceptionThrown") log.push("exception: " + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 300));
    if (m.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(m.params.type)) log.push(`${m.params.type}: ` + m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300));
    if (m.method === "Log.entryAdded" && ["error", "warning"].includes(m.params.entry.level)) log.push(`log ${m.params.entry.level}: ${m.params.entry.text.slice(0, 300)}`);
  });
  await kirim("Runtime.enable");
  await kirim("Page.enable");
  await kirim("Log.enable");
  const nilai = async (ekspresi) => (await kirim("Runtime.evaluate", { expression: ekspresi, returnByValue: true, awaitPromise: true })).result?.result?.value;
  const tutup = () => { try { ws.close(); } catch {} proses.kill(); };
  return { kirim, nilai, log, tutup };
}
