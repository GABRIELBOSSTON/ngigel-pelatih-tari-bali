// Menyalin dokumentasi induk (../ngigel/docs) ke ./docs supaya repositori memuat docs terbaru.
// Dokumen induk tidak pernah disunting di sini; ubah di ../ngigel/docs lalu jalankan `npm run docs:sync`.
// Setiap salinan diberi penanda di baris pertama, dan salinan lama yang induknya sudah dihapus ikut dibuang.
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const akar = dirname(dirname(fileURLToPath(import.meta.url)));
const sumber = join(akar, "..", "ngigel", "docs");
const tujuan = join(akar, "docs");
const PENANDA =
  "<!-- SALINAN OTOMATIS dari ngigel/docs (npm run docs:sync). Jangan disunting di sini; ubah dokumen induknya. -->\n\n";

let berkas;
try {
  berkas = (await readdir(sumber)).filter((n) => n.endsWith(".md"));
} catch {
  console.error(`Folder dokumentasi induk tidak ditemukan: ${sumber}`);
  process.exit(1);
}

await mkdir(tujuan, { recursive: true });
for (const nama of berkas) {
  const isi = await readFile(join(sumber, nama), "utf8");
  await writeFile(join(tujuan, nama), PENANDA + isi, "utf8");
}

const basi = (await readdir(tujuan)).filter((n) => n.endsWith(".md") && !berkas.includes(n));
for (const nama of basi) await rm(join(tujuan, nama));

console.log(`${berkas.length} dokumen disalin ke docs/.` + (basi.length ? ` Salinan basi dihapus: ${basi.join(", ")}` : ""));
