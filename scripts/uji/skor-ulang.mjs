// Menghitung ulang nilai sesi dari jarak kelompok yang tersimpan di riwayat, untuk beberapa pasangan
// (w, τ), tanpa mengulang uji. Rumusnya sama dengan penilaian.ts:
//   d² = (1 − w)·rata(d_k²) + w·maks(d_k)²;  skor = 100·exp(−d/τ);  total = rata-rata berbobot unsur.
// Pemakaian: node scripts/uji/skor-ulang.mjs A=hasil_uji/A/riwayat.json B=hasil_uji/B/riwayat.json
// (riwayat.json = isi localStorage "ngigel.riwayat.v1" yang disimpan uji-studio.mjs; sesi terbaru dipakai)
import { readFileSync } from "node:fs";

const BOBOT = { agem: 0.35, tandang: 0.2, tangkis: 0.3, tangkep: 0.15 };
const pasangan = [];
for (const w of [0.5, 0.75, 1]) for (const tau of [1.5, 2, 2.5]) pasangan.push({ w, tau });

for (const arg of process.argv.slice(2)) {
  const [label, berkas] = arg.split("=");
  const sesi = JSON.parse(readFileSync(berkas, "utf8"))[0];
  console.log(`\n== ${label}: nilai asli ${sesi.skorTotal} ${JSON.stringify(sesi.skor)} · terlambat ${sesi.terlambatDetik} dtk`);
  console.log("   jarak kelompok:", JSON.stringify(sesi.jarakKelompok));
  if (sesi.seledet) console.log("   seledet:", JSON.stringify("tidakTerbaca" in sesi.seledet ? sesi.seledet : { jumlahGuru: sesi.seledet.jumlahGuru, tepat: sesi.seledet.tepat, arahSalah: sesi.seledet.arahSalah }));
  for (const { w, tau } of pasangan) {
    let total = 0;
    let bobot = 0;
    const skor = {};
    for (const [u, kelompok] of Object.entries(sesi.jarakKelompok ?? {})) {
      const d = Object.values(kelompok);
      if (d.length === 0 || sesi.skor[u] === null) continue;
      const jarak = Math.sqrt((1 - w) * (d.reduce((a, x) => a + x * x, 0) / d.length) + w * Math.max(...d) ** 2);
      skor[u] = Math.round(100 * Math.exp(-jarak / tau));
      total += BOBOT[u] * skor[u];
      bobot += BOBOT[u];
    }
    console.log(`   w=${w} τ=${tau}: ${Math.round(total / bobot)} (${Object.entries(skor).map(([u, s]) => u.slice(0, 4) + s).join(" ")})`);
  }
}
