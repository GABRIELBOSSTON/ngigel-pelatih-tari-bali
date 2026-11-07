// Benchmark AI dengan berkas video (docs/09 bagian 1–7): membuka /uji-video, memasukkan semua video
// .webm/.mp4 dari satu folder, menjalankan window.jalankanUji(konfig), lalu menyimpan window.__hasilUji.
// Pemakaian (sesudah `npm run build`):
//   node scripts/uji/jalankan-benchmark.mjs --video <folder> --keluar <hasil.json> [--konfig <konfig.json>]
// Konfig (opsional) sama dengan KonfigUji di src/pages/UjiVideo.tsx, mis. { "fps": 15, "simpanDeret": true }.
// Video uji di docs/09 berasal dari Wikimedia Commons (lisensi terbuka); tidak disimpan di repositori.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { bacaArgumen, bukaChrome, lokasiChrome, nyalakanServer, tunggu } from "./cdp.mjs";

const arg = bacaArgumen();
if (!arg.video || !arg.keluar) {
  console.error("Wajib: --video <folder> --keluar <hasil.json>");
  process.exit(1);
}
const folder = resolve(arg.video);
const berkas = readdirSync(folder).filter((n) => /\.(webm|mp4)$/i.test(n)).sort();
const konfig = arg.konfig ? JSON.parse(readFileSync(arg.konfig, "utf8")) : { fps: 15 };
const server = await nyalakanServer("preview", 4173);
const chrome = await bukaChrome({ chrome: lokasiChrome(arg), profil: join(tmpdir(), "ngigel-uji-benchmark"), port: 9333 });
try {
  await chrome.kirim("DOM.enable");
  await chrome.kirim("Page.navigate", { url: "http://localhost:4173/uji-video" });
  await tunggu(3000);
  const dok = await chrome.kirim("DOM.getDocument", { depth: -1 });
  const masukan = await chrome.kirim("DOM.querySelector", { nodeId: dok.result.root.nodeId, selector: "input[type=file]" });
  await chrome.kirim("DOM.setFileInputFiles", { nodeId: masukan.result.nodeId, files: berkas.map((n) => join(folder, n)) });
  console.log("Berkas dimasukkan:", await chrome.nilai("document.querySelector('input[type=file]').files.length"));
  await chrome.kirim("Runtime.evaluate", { expression: `window.jalankanUji(${JSON.stringify(konfig)})` });
  const mulai = Date.now();
  let terakhir = "";
  while (Date.now() - mulai < 60 * 60 * 1000) {
    await tunggu(10000);
    const status = await chrome.nilai("document.querySelector('[role=status]')?.innerText ?? ''");
    if (status !== terakhir) {
      console.log(`${Math.round((Date.now() - mulai) / 1000)} dtk: ${status}`);
      terakhir = status;
    }
    if (await chrome.nilai("window.__hasilUji?.selesai === true")) break;
  }
  const json = await chrome.nilai("JSON.stringify(window.__hasilUji)");
  writeFileSync(resolve(arg.keluar), json ?? "null");
  console.log("Hasil disimpan:", arg.keluar, `(${(json ?? "").length} karakter)`);
} catch (g) {
  console.error("GAGAL:", g);
  process.exitCode = 1;
} finally {
  console.log("Log galat/peringatan:\n" + (chrome.log.length ? [...new Set(chrome.log)].slice(0, 30).join("\n") : "(kosong)"));
  chrome.tutup();
  server.kill();
}
