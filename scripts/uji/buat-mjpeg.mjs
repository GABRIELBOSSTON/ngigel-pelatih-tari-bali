// Membuat berkas MJPEG (JPEG bersambung, 30 fps) dari potongan video lokal, untuk kamera palsu Chrome
// (--use-file-for-fake-video-capture). Chrome memutar berkas MJPEG pada 30 fps dan mengulangnya.
// Pemakaian: node scripts/uji/buat-mjpeg.mjs --video <berkas.mp4> --keluar <berkas.mjpeg> --mulai 35 --lama 40 [--lebar 640]
// Kondisi kamera yang lebih buruk, untuk menguji gerbang kualitas (docs/09 bagian 12):
//   --skala 0.5             video diperkecil di tengah bingkai, seolah penari berdiri lebih jauh
//   --filter "brightness(0.3)" atau "blur(2px)"   filter kanvas: ruangan gelap atau kamera buram
//   --cermin                kiri–kanan dibalik, seolah murid meniru dengan sisi tertukar
import { closeSync, openSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { bacaArgumen, bukaChrome, lokasiChrome, tunggu } from "./cdp.mjs";

const FPS = 30;
const arg = bacaArgumen();
if (!arg.video || !arg.keluar || arg.mulai === undefined || !arg.lama) {
  console.error("Wajib: --video <berkas> --keluar <berkas.mjpeg> --mulai <detik> --lama <detik>");
  process.exit(1);
}
const mulai = Number(arg.mulai);
const lama = Number(arg.lama);
const lebar = Number(arg.lebar ?? 640);
const skala = Number(arg.skala ?? 1);
const filter = typeof arg.filter === "string" ? arg.filter : "none";
const cermin = arg.cermin !== undefined;
if (!(skala > 0 && skala <= 1)) {
  console.error("--skala harus di antara 0 dan 1");
  process.exit(1);
}
const chrome = await bukaChrome({ chrome: lokasiChrome(arg), profil: join(tmpdir(), "ngigel-uji-mjpeg"), port: 9337, bendera: ["--allow-file-access-from-files"] });
try {
  await chrome.kirim("Page.navigate", { url: pathToFileURL(resolve(arg.video)).href });
  await tunggu(2500);
  await chrome.nilai(`(async () => { const v = document.querySelector('video'); v.pause();
    if (v.readyState < 1) await new Promise(r => v.addEventListener('loadedmetadata', r, { once: true }));
    window.__k = document.createElement('canvas'); __k.width = ${lebar}; __k.height = Math.round(${lebar} * v.videoHeight / v.videoWidth / 2) * 2; return true; })()`);
  const total = Math.round(lama * FPS);
  const fd = openSync(resolve(arg.keluar), "w");
  let byte = 0;
  for (let awal = 0; awal < total; awal += 50) {
    const akhir = Math.min(total, awal + 50);
    const daftar = await chrome.nilai(`(async () => { const v = document.querySelector('video'); const hasil = [];
      for (let k = ${awal}; k < ${akhir}; k++) {
        await new Promise(r => { v.addEventListener('seeked', r, { once: true }); v.currentTime = ${mulai} + k / ${FPS}; });
        const c = __k.getContext('2d'); const w = __k.width * ${skala}, h = __k.height * ${skala};
        c.setTransform(1, 0, 0, 1, 0, 0); c.filter = 'none'; c.fillStyle = '#8c8a86'; c.fillRect(0, 0, __k.width, __k.height);
        if (${cermin}) c.setTransform(-1, 0, 0, 1, __k.width, 0);
        c.filter = ${JSON.stringify(filter)}; c.drawImage(v, (__k.width - w) / 2, (__k.height - h) / 2, w, h);
        hasil.push(__k.toDataURL('image/jpeg', 0.85).split(',')[1]);
      } return hasil; })()`);
    for (const b64 of daftar) {
      const buf = Buffer.from(b64, "base64");
      writeSync(fd, buf);
      byte += buf.length;
    }
    process.stdout.write(`\r${akhir}/${total} frame`);
  }
  closeSync(fd);
  console.log(`\nselesai: ${arg.keluar} (${(byte / 1e6).toFixed(1)} MB, ${total} frame, ${FPS} fps)`);
} catch (g) {
  console.error("GAGAL:", g);
  process.exitCode = 1;
} finally {
  chrome.tutup();
}
