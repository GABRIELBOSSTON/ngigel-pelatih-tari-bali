// Kalibrasi w (BOBOT_KELOMPOK_TERBURUK) dan τ (TAU_UNSUR) dengan skenario sintetis dari deret fitur
// hasil benchmark (docs/09 bagian 7). Bukan uji biasa: dilewati bila HASIL_UJI tidak diisi.
// Pemakaian:
//   HASIL_UJI=<hasil benchmark.json dengan simpanDeret> npx vitest run --config scripts/uji/vitest.config.ts
// Mencetak tabel per pasangan (w, τ) dan menandai baris konfigurasi sekarang beserta lulus/tidaknya
// terhadap KRITERIA_KALIBRASI (docs/04 bagian 10).
import { readFileSync } from "node:fs";
import { it } from "vitest";
import { BOBOT_KELOMPOK_TERBURUK, BOBOT_UNSUR, KRITERIA_KALIBRASI, TAU_UNSUR } from "../../src/config";
import type { FrameFitur } from "../../src/scoring/fitur";
import { nilaiLatihan, type HasilPenilaian } from "../../src/scoring/penilaian";
import type { JenisSegmen } from "../../src/scoring/segmentasi";
import { DAFTAR_UNSUR, type Unsur } from "../../src/scoring/types";
import { geserFitur, tambahDerau, ubahTempo } from "../../src/uji/analisis";

const BERKAS = process.env.HASIL_UJI ?? "";
type Video = { berkas: string; deret: FrameFitur[]; label: JenisSegmen[] };

function skorUlang(h: HasilPenilaian, w: number, tau: number) {
  const skor: Partial<Record<Unsur, number>> = {};
  let total = 0;
  let bobot = 0;
  for (const u of DAFTAR_UNSUR) {
    const d = Object.values(h.jarakKelompok[u] ?? {});
    if (h.jarak[u] === null || d.length === 0) continue;
    const jarak = Math.sqrt((1 - w) * (d.reduce((a, x) => a + x * x, 0) / d.length) + w * Math.max(...d) ** 2);
    skor[u] = 100 * Math.exp(-jarak / tau);
    total += BOBOT_UNSUR[u] * skor[u]!;
    bobot += BOBOT_UNSUR[u];
  }
  return { skor, total: bobot > 0 ? total / bobot : null };
}

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : NaN;
};

it.skipIf(!BERKAS)("kalibrasi w dan τ", () => {
  const video = (JSON.parse(readFileSync(BERKAS, "utf8")).video as Video[]).filter((v) => v.deret);
  const solo = video.filter((v) => !v.berkas.includes("1080p"));
  const kasus: Array<{ jenis: "mirip" | "salah" | "lain"; unsur?: Unsur[]; h: HasilPenilaian }> = [];
  for (const v of solo) {
    const nilai = (m: FrameFitur[]) => nilaiLatihan(v.deret, v.label, m);
    kasus.push({ jenis: "mirip", h: nilai(ubahTempo(v.deret, 1.25)) });
    kasus.push({ jenis: "mirip", h: nilai(ubahTempo(v.deret, 0.8)) });
    kasus.push({ jenis: "mirip", h: nilai(tambahDerau(v.deret, 5)) });
    kasus.push({ jenis: "salah", unsur: ["agem"], h: nilai(geserFitur(v.deret, { lutut_L: 25, lutut_R: 25 })) });
    kasus.push({ jenis: "salah", unsur: ["agem", "tangkis"], h: nilai(geserFitur(v.deret, { tinggi_pergelangan_L: -0.3, tinggi_pergelangan_R: -0.3 })) });
    kasus.push({ jenis: "salah", unsur: ["tangkis"], h: nilai(geserFitur(v.deret, { siku_L: -30, siku_R: -30 })) });
    kasus.push({ jenis: "salah", unsur: ["tangkep"], h: nilai(v.deret.map((f) => ({ t: f.t, nilai: { ...f.nilai, lirikan: f.nilai.lirikan == null ? null : 0 } }))) });
    for (const lain of solo) if (lain !== v) kasus.push({ jenis: "lain", h: nilai(lain.deret) });
    const hd = video.find((x) => x.berkas === v.berkas.replace(".webm", "_1080p.webm"));
    if (hd) kasus.push({ jenis: "mirip", h: nilai(hd.deret) });
  }

  const baris: string[] = [];
  for (const w of [0, 0.25, 0.5, 0.75, 1]) {
    for (const tau of [1, 1.5, 2, 2.5, 3]) {
      const mirip = kasus.filter((k) => k.jenis === "mirip").map((k) => skorUlang(k.h, w, tau).total ?? NaN);
      const salah = kasus.filter((k) => k.jenis === "salah").map((k) => {
        const s = skorUlang(k.h, w, tau).skor;
        return Math.min(...(k.unsur ?? []).map((u) => s[u] ?? 100));
      });
      const lain = kasus.filter((k) => k.jenis === "lain").map((k) => skorUlang(k.h, w, tau).total ?? NaN);
      const sekarang = w === BOBOT_KELOMPOK_TERBURUK && tau === TAU_UNSUR.agem;
      const lulus = Math.min(...mirip) >= KRITERIA_KALIBRASI.minSkorGerakBenar && median(salah) <= KRITERIA_KALIBRASI.maksSkorUnsurSalah;
      baris.push(
        `${sekarang ? "▶" : " "} w=${w} τ=${tau} | mirip median ${median(mirip).toFixed(0)} terendah ${Math.min(...mirip).toFixed(0)}` +
          ` | salah median ${median(salah).toFixed(0)} (≤50: ${salah.filter((x) => x <= 50).length}/${salah.length})` +
          ` | lain median ${median(lain).toFixed(0)} tertinggi ${Math.max(...lain).toFixed(0)}${lulus ? " | LULUS kriteria" : ""}`,
      );
    }
  }
  console.log(`kasus: ${kasus.length} (▶ = konfigurasi sekarang)\n` + baris.join("\n"));
});
