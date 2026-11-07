// Mengunduh berkas model resmi MediaPipe ke public/models (sekali saja; berkasnya ikut di-commit).
// Dijalankan manual dengan `npm run setup:model` setelah ketua menyetujui unduhan.
// Ukuran setiap berkas dicocokkan dengan ukuran yang diperiksa lewat permintaan HEAD pada 1 Nov 2026.
// Pilihan utama Holistic; tiga model lain adalah cadangan (docs/04 bagian 2).
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DASAR = "https://storage.googleapis.com/mediapipe-models";
const MODEL = [
  { nama: "holistic_landmarker.task", jalur: "holistic_landmarker/holistic_landmarker/float16/1", ukuran: 13683609, wajib: true },
  { nama: "pose_landmarker_lite.task", jalur: "pose_landmarker/pose_landmarker_lite/float16/1", ukuran: 5777746, wajib: false },
  { nama: "hand_landmarker.task", jalur: "hand_landmarker/hand_landmarker/float16/1", ukuran: 7819105, wajib: false },
  { nama: "face_landmarker.task", jalur: "face_landmarker/face_landmarker/float16/1", ukuran: 3758596, wajib: false },
];

const semua = process.argv.includes("--semua");
const akar = dirname(dirname(fileURLToPath(import.meta.url)));
const tujuan = join(akar, "public", "models");
await mkdir(tujuan, { recursive: true });

for (const m of MODEL.filter((x) => x.wajib || semua)) {
  const ke = join(tujuan, m.nama);
  const ada = await stat(ke).catch(() => null);
  if (ada?.size === m.ukuran) {
    console.log(`✓ ${m.nama} sudah ada`);
    continue;
  }
  const res = await fetch(`${DASAR}/${m.jalur}/${m.nama}`);
  if (!res.ok) throw new Error(`${m.nama}: HTTP ${res.status}`);
  const isi = new Uint8Array(await res.arrayBuffer());
  if (isi.byteLength !== m.ukuran) {
    throw new Error(`${m.nama}: ukuran ${isi.byteLength} berbeda dari yang diharapkan ${m.ukuran}. Tidak disimpan.`);
  }
  await writeFile(ke, isi);
  console.log(`↓ ${m.nama} (${(m.ukuran / 1e6).toFixed(1)} MB)`);
}
console.log(semua ? "Semua model siap." : "Model utama siap. Tambahkan --semua untuk model cadangan.");
