// Membuat JSON pelajaran lewat halaman /guru yang asli (alur guru produksi), di Chrome tanpa layar.
// Hasilnya sama dengan guru yang mengisi formulir sendiri; yang disimpan hanya angka gerak.
// Pemakaian (sesudah `npm run build`):
//   node scripts/uji/buat-pelajaran.mjs --video <berkas.mp4> --isian scripts/uji/contoh-isian-pelajaran.json --keluar <folder>
// Pemrosesan ±0,2 detik per frame (15 fps): video 3 menit butuh ±9 menit.
import { mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { bacaArgumen, bukaChrome, lokasiChrome, nyalakanServer, tunggu } from "./cdp.mjs";

const arg = bacaArgumen();
if (!arg.video || !arg.isian || !arg.keluar) {
  console.error("Wajib: --video <berkas> --isian <isian.json> --keluar <folder>");
  process.exit(1);
}
const isian = JSON.parse(readFileSync(arg.isian, "utf8"));
const keluar = resolve(arg.keluar);
mkdirSync(keluar, { recursive: true });
const server = await nyalakanServer("preview", 4174);
const chrome = await bukaChrome({ chrome: lokasiChrome(arg), profil: join(tmpdir(), "ngigel-uji-guru"), port: 9335, unduhKe: keluar });
try {
  await chrome.kirim("DOM.enable");
  await chrome.kirim("Page.navigate", { url: "http://localhost:4174/guru" });
  await tunggu(3000);
  const dok = await chrome.kirim("DOM.getDocument", { depth: -1 });
  const masukan = await chrome.kirim("DOM.querySelector", { nodeId: dok.result.root.nodeId, selector: "input[type=file][name=video]" });
  await chrome.kirim("DOM.setFileInputFiles", { nodeId: masukan.result.nodeId, files: [resolve(arg.video)] });
  // Form guru = form yang memuat input video (header punya form cari sendiri).
  await chrome.nilai(`(() => { const f = document.querySelector('input[type=file][name=video]').form; const isi = ${JSON.stringify(isian)};
    for (const [k, v] of Object.entries(isi)) { const el = f.elements.namedItem(k); if (!el) continue; if (el.type === 'checkbox') el.checked = Boolean(v); else el.value = v; }
    f.requestSubmit(); return true; })()`);
  const mulai = Date.now();
  let terakhir = "";
  while (Date.now() - mulai < 60 * 60 * 1000) {
    await tunggu(10000);
    const status = await chrome.nilai("document.querySelector('[role=status]')?.innerText ?? ''");
    const galat = await chrome.nilai("document.querySelector('[role=alert]')?.innerText ?? ''");
    const siap = await chrome.nilai("[...document.querySelectorAll('button')].some(b => b.textContent.includes('Unduh pelajaran'))");
    if (status !== terakhir) {
      console.log(`${Math.round((Date.now() - mulai) / 1000)} dtk: ${status}`);
      terakhir = status;
    }
    if (galat) {
      console.log("GALAT HALAMAN:", galat);
      process.exitCode = 1;
      break;
    }
    if (siap) {
      console.log("Ringkasan:", await chrome.nilai("document.querySelector('h2')?.parentElement?.innerText ?? ''"));
      await chrome.nilai("[...document.querySelectorAll('button')].find(b => b.textContent.includes('Unduh pelajaran')).click()");
      await tunggu(4000);
      console.log("Diunduh ke", keluar);
      break;
    }
  }
} catch (g) {
  console.error("GAGAL:", g);
  process.exitCode = 1;
} finally {
  console.log("Log:\n" + (chrome.log.length ? [...new Set(chrome.log)].slice(0, 20).join("\n") : "(kosong)"));
  chrome.tutup();
  server.kill();
}
