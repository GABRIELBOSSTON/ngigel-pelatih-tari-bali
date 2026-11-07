// Uji ujung ke ujung dan potret halaman: menjalankan langkah-langkah (JSON) di Chrome tanpa layar,
// dengan kamera palsu bila perlu (docs/06 bagian 3.1, docs/09 bagian 10).
//
// Pemakaian (dari folder ngigel-web, sesudah `npm run build`):
//   node scripts/uji/uji-studio.mjs --langkah scripts/uji/langkah/halaman.json --keluar hasil_uji/halaman
//   node scripts/uji/uji-studio.mjs --langkah scripts/uji/langkah/e2e-benar.json --keluar hasil_uji/A --kamera hasil_uji/janger_35_75.mjpeg
// Pilihan: --server preview|vercel-lokal|dev (bawaan preview) · --chrome <lokasi> · --port 4175 · --portCdp 9336
//
// Bentuk satu langkah: { url?, lebar?, tinggi?, aksi?, tungguJs?, batasMs?, tunggu?, ambil?, simpanJs?, nama?, potret?, penuh? }
// - aksi/tungguJs/ambil: ekspresi JavaScript yang dijalankan di halaman;
// - nama: nama berkas potret (.jpg); potret: false = tanpa potret; penuh: potret seluruh halaman;
// - simpanJs: { berkas, ekspresi } → hasil ekspresi disimpan ke berkas di folder keluaran.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { bacaArgumen, bukaChrome, lokasiChrome, nyalakanServer, tunggu } from "./cdp.mjs";

const arg = bacaArgumen();
if (!arg.langkah || !arg.keluar) {
  console.error("Wajib: --langkah <berkas.json> --keluar <folder>");
  process.exit(1);
}
const langkah = JSON.parse(readFileSync(arg.langkah, "utf8"));
const keluar = resolve(arg.keluar);
mkdirSync(keluar, { recursive: true });
const portServer = Number(arg.port ?? 4175);
const portCdp = Number(arg.portCdp ?? 9336);
// Profil baru setiap kali: localStorage kosong, jadi riwayat yang disimpan hanya dari uji ini.
const profil = join(tmpdir(), `ngigel-uji-profil-${portCdp}`);
rmSync(profil, { recursive: true, force: true });

const server = await nyalakanServer(arg.server ?? "preview", portServer);
const chrome = await bukaChrome({ chrome: lokasiChrome(arg), profil, port: portCdp, kamera: arg.kamera ? resolve(arg.kamera) : undefined });
try {
  for (const l of langkah) {
    if (l.lebar) await chrome.kirim("Emulation.setDeviceMetricsOverride", { width: l.lebar, height: l.tinggi ?? 900, deviceScaleFactor: 1, mobile: l.lebar < 600 });
    if (l.url) {
      await chrome.kirim("Page.navigate", { url: `http://localhost:${portServer}${l.url}` });
      await tunggu(1500);
    }
    if (l.aksi) console.log("aksi:", l.nama ?? "", JSON.stringify(await chrome.nilai(l.aksi))?.slice(0, 300));
    if (l.tungguJs) {
      const mulai = Date.now();
      while (Date.now() - mulai < (l.batasMs ?? 60000)) {
        if (await chrome.nilai(l.tungguJs)) break;
        await tunggu(500);
      }
      console.log(`tunggu "${l.nama ?? ""}": ${Math.round((Date.now() - mulai) / 1000)} dtk, terpenuhi=${Boolean(await chrome.nilai(l.tungguJs))}`);
    }
    if (l.tunggu) await tunggu(l.tunggu);
    if (l.ambil) console.log("ambil:", l.nama ?? "", JSON.stringify(await chrome.nilai(l.ambil))?.slice(0, 4000));
    if (l.simpanJs) writeFileSync(join(keluar, l.simpanJs.berkas), String((await chrome.nilai(l.simpanJs.ekspresi)) ?? ""));
    if (l.nama && l.potret !== false) {
      let clip;
      if (l.penuh) {
        const m = await chrome.kirim("Page.getLayoutMetrics");
        const ukuran = m.result.cssContentSize ?? m.result.contentSize;
        clip = { x: 0, y: 0, width: l.lebar ?? 1440, height: Math.min(ukuran.height, 6000), scale: 1 };
      }
      const r = await chrome.kirim("Page.captureScreenshot", { format: "jpeg", quality: 72, captureBeyondViewport: Boolean(l.penuh), ...(clip ? { clip } : {}) });
      writeFileSync(join(keluar, `${l.nama}.jpg`), Buffer.from(r.result.data, "base64"));
      console.log("potret:", l.nama);
    }
  }
} catch (g) {
  console.error("GAGAL:", g);
  process.exitCode = 1;
} finally {
  console.log("Log galat/peringatan:\n" + (chrome.log.length ? [...new Set(chrome.log)].slice(0, 40).join("\n") : "(kosong)"));
  chrome.tutup();
  server.kill();
}
