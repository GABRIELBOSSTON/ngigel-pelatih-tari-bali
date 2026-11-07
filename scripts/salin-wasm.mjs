// Menyalin berkas WASM MediaPipe dari node_modules ke public/mediapipe/wasm, supaya aplikasi
// memuatnya dari server sendiri, bukan dari CDN pihak ketiga (docs/04 bagian 2, docs/05 bagian 5).
// Dijalankan otomatis oleh `npm run dev` dan `npm run build`. Folder tujuan tidak masuk Git.
import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const akar = dirname(dirname(fileURLToPath(import.meta.url)));
const sumber = join(akar, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const tujuan = join(akar, "public", "mediapipe", "wasm");

let berkas;
try {
  berkas = await readdir(sumber);
} catch {
  console.error("WASM MediaPipe tidak ditemukan. Jalankan `npm install` terlebih dahulu.");
  process.exit(1);
}

await mkdir(tujuan, { recursive: true });
let disalin = 0;
for (const nama of berkas) {
  const asal = join(sumber, nama);
  const ke = join(tujuan, nama);
  const sudahAda = await stat(ke).catch(() => null);
  if (sudahAda && sudahAda.size === (await stat(asal)).size) continue;
  await copyFile(asal, ke);
  disalin++;
}
console.log(`WASM MediaPipe siap di public/mediapipe/wasm (${berkas.length} berkas, ${disalin} baru disalin).`);
