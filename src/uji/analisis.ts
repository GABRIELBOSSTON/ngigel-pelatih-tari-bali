// Analisis benchmark: statistik deteksi, uji cermin, sebaran kecepatan, dan skenario penilaian.
// Fungsi murni; dipakai halaman /uji-video dan diuji di tests/analisis.test.ts.
import { DAFTAR_FITUR, JENIS_DERAJAT, JENIS_FITUR, tukarSisi, type FrameFitur, type NamaFitur } from "../scoring/fitur";
import { median, persentil } from "../scoring/geometri";
import { nilaiLatihan, type HasilPenilaian, type OpsiPenilaian } from "../scoring/penilaian";
import { kecepatanGerak, type JenisSegmen } from "../scoring/segmentasi";
import { hitungLirikan } from "../scoring/wajah";
import { POSE } from "../vision/poseIndex";
import type { HasilDeteksi, Titik } from "../vision/types";

const persen = (n: number, dari: number) => (dari > 0 ? Math.round((1000 * n) / dari) / 10 : 0);
const bulat = (v: number, angka = 1) => Math.round(v * 10 ** angka) / 10 ** angka;

export { persentil };

export function statistikDeteksi(frame: readonly HasilDeteksi[], lamaProsesMs: readonly number[]) {
  const n = frame.length;
  const rata = lamaProsesMs.length ? lamaProsesMs.reduce((a, b) => a + b, 0) / lamaProsesMs.length : 0;
  return {
    jumlahFrame: n,
    tubuhPersen: persen(frame.filter((f) => f.pose).length, n),
    tanganKiriPersen: persen(frame.filter((f) => f.tanganKiri).length, n),
    tanganKananPersen: persen(frame.filter((f) => f.tanganKanan).length, n),
    wajahPersen: persen(frame.filter((f) => f.wajah).length, n),
    prosesRataMs: bulat(rata),
    prosesP95Ms: bulat(persentil([...lamaProsesMs], 95) ?? 0),
    /** Batas atas deteksi per detik bila hanya dibatasi waktu proses model. */
    fpsMaksimum: rata > 0 ? bulat(1000 / rata) : 0,
  };
}

const PASANGAN_SENDI: ReadonlyArray<[number, number]> = [
  [POSE.BAHU_KIRI, POSE.BAHU_KANAN],
  [POSE.SIKU_KIRI, POSE.SIKU_KANAN],
  [POSE.PERGELANGAN_KIRI, POSE.PERGELANGAN_KANAN],
  [POSE.PINGGUL_KIRI, POSE.PINGGUL_KANAN],
  [POSE.LUTUT_KIRI, POSE.LUTUT_KANAN],
  [POSE.PERGELANGAN_KAKI_KIRI, POSE.PERGELANGAN_KAKI_KANAN],
];

/** Jarak titik asli dengan titik dari gambar terbalik yang dikembalikan ke posisi asli (x → 1 − x). */
const jarakCermin = (a: Titik | undefined, b: Titik | undefined) =>
  a && b ? Math.hypot(a.x - (1 - b.x), a.y - b.y) : null;

/**
 * Uji cermin (docs/04 bagian 3). Bila membalik gambar membuat model menukar label kiri–kanan,
 * maka titik KIRI di gambar asli berimpit dengan titik KANAN di gambar terbalik (setelah posisinya
 * dikembalikan), dan selisih "tertukar" jauh lebih kecil daripada selisih "sama".
 */
export function ujiCermin(asli: readonly HasilDeteksi[], balik: readonly HasilDeteksi[]) {
  const sama: number[] = [];
  const tukar: number[] = [];
  const tanganSama: number[] = [];
  const tanganTukar: number[] = [];
  const lirikanSama: number[] = [];
  const lirikanTukar: number[] = [];
  const n = Math.min(asli.length, balik.length);
  for (let i = 0; i < n; i++) {
    const a = asli[i]!;
    const b = balik[i]!;
    if (a.pose && b.pose) {
      for (const [kiri, kanan] of PASANGAN_SENDI) {
        const s = [jarakCermin(a.pose[kiri], b.pose[kiri]), jarakCermin(a.pose[kanan], b.pose[kanan])];
        const t = [jarakCermin(a.pose[kiri], b.pose[kanan]), jarakCermin(a.pose[kanan], b.pose[kiri])];
        for (const v of s) if (v !== null) sama.push(v);
        for (const v of t) if (v !== null) tukar.push(v);
      }
    }
    const ak = a.tanganKiri?.[0];
    const an = a.tanganKanan?.[0];
    const bk = b.tanganKiri?.[0];
    const bn = b.tanganKanan?.[0];
    const ts = [jarakCermin(ak, bk), jarakCermin(an, bn)];
    const tt = [jarakCermin(ak, bn), jarakCermin(an, bk)];
    for (const v of ts) if (v !== null) tanganSama.push(v);
    for (const v of tt) if (v !== null) tanganTukar.push(v);
    if (a.wajah && b.wajah) {
      const la = hitungLirikan(a.wajah);
      const lb = hitungLirikan(b.wajah);
      lirikanSama.push(Math.abs(la - lb));
      lirikanTukar.push(Math.abs(la + lb)); // tertukar: lirikan berbalik tanda
    }
  }
  const md = (v: number[]) => (v.length ? bulat(median(v)!, 3) : null);
  return {
    poseSelisihSama: md(sama),
    poseSelisihTukar: md(tukar),
    tanganSelisihSama: md(tanganSama),
    tanganSelisihTukar: md(tanganTukar),
    lirikanSelisihSama: md(lirikanSama),
    lirikanSelisihTukar: md(lirikanTukar),
    jumlahFrame: n,
  };
}

/** Sebaran kecepatan gerak (toleransi/detik) untuk mengkalibrasi ambang diam. */
export function sebaranKecepatan(deret: readonly FrameFitur[]) {
  const v = kecepatanGerak(deret).filter((x): x is number => x !== null);
  return { p10: persentil(v, 10), p25: persentil(v, 25), p50: persentil(v, 50), p75: persentil(v, 75), p90: persentil(v, 90) };
}

export function porsiSegmen(label: readonly JenisSegmen[]) {
  const n = label.length;
  return {
    pokok: persen(label.filter((l) => l === "pokok").length, n),
    peralihan: persen(label.filter((l) => l === "peralihan").length, n),
    perpindahan: persen(label.filter((l) => l === "perpindahan").length, n),
  };
}

/** Getaran: median perubahan sudut siku antar-frame pada frame pokok (derajat). Makin kecil makin stabil. */
export function getaranSiku(deret: readonly FrameFitur[], label: readonly JenisSegmen[]): number | null {
  const beda: number[] = [];
  for (let i = 1; i < deret.length; i++) {
    if (label[i] !== "pokok" || label[i - 1] !== "pokok") continue;
    for (const nama of ["siku_L", "siku_R"] as const) {
      const a = deret[i - 1]!.nilai[nama];
      const b = deret[i]!.nilai[nama];
      if (a !== null && a !== undefined && b !== null && b !== undefined) beda.push(Math.abs(b - a));
    }
  }
  return beda.length ? bulat(median(beda)!, 2) : null;
}

/** Mengubah tempo deret: faktor 1,25 = 25% lebih lambat. Nilai diinterpolasi linear. */
export function ubahTempo(deret: readonly FrameFitur[], faktor: number): FrameFitur[] {
  if (deret.length < 2) return [...deret];
  const dt = deret[1]!.t - deret[0]!.t;
  const lama = deret[deret.length - 1]!.t - deret[0]!.t;
  const jumlah = Math.round((lama * faktor) / dt) + 1;
  return Array.from({ length: jumlah }, (_, k) => {
    const posisi = (k / (jumlah - 1)) * (deret.length - 1);
    const i = Math.floor(posisi);
    const r = posisi - i;
    const a = deret[i]!;
    const b = deret[Math.min(deret.length - 1, i + 1)]!;
    const nilai: FrameFitur["nilai"] = {};
    for (const nama of DAFTAR_FITUR) {
      const x = a.nilai[nama];
      const y = b.nilai[nama];
      nilai[nama] = x === null || x === undefined ? (y ?? null) : y === null || y === undefined ? x : x + r * (y - x);
    }
    return { t: deret[0]!.t + k * dt, nilai };
  });
}

/** Menggeser fitur tertentu (simulasi kesalahan murid). */
export function geserFitur(deret: readonly FrameFitur[], ubah: Partial<Record<NamaFitur, number | null>>): FrameFitur[] {
  return deret.map((f) => {
    const nilai = { ...f.nilai };
    for (const [nama, delta] of Object.entries(ubah) as [NamaFitur, number | null][]) {
      const v = nilai[nama];
      if (v === null || v === undefined) continue;
      nilai[nama] = delta === null ? null : v + delta;
    }
    return { t: f.t, nilai };
  });
}

/** Derau acak berulang-ulang (seed tetap) pada fitur sudut, untuk meniru ketidaktepatan alami. */
export function tambahDerau(deret: readonly FrameFitur[], derajat: number, seed = 7): FrameFitur[] {
  let s = seed;
  const acak = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  return deret.map((f) => {
    const nilai = { ...f.nilai };
    for (const nama of DAFTAR_FITUR) {
      const v = nilai[nama];
      if (JENIS_DERAJAT.has(JENIS_FITUR[nama]) && v !== null && v !== undefined) nilai[nama] = v + (acak() * 2 - 1) * derajat;
    }
    return { t: f.t, nilai };
  });
}

export type BarisSkenario = {
  skenario: string;
  harapan: string;
  total: number | null;
  agem: number | null;
  tandang: number | null;
  tangkis: number | null;
  tangkep: number | null;
  tempo: number;
  penyimpanganUtama: string;
};

export function barisSkenario(skenario: string, harapan: string, h: HasilPenilaian): BarisSkenario {
  const p = h.penyimpangan[0];
  return {
    skenario,
    harapan,
    total: h.skorTotal,
    agem: h.skor.agem,
    tandang: h.skor.tandang,
    tangkis: h.skor.tangkis,
    tangkep: h.skor.tangkep,
    tempo: bulat(h.rasioTempo, 2),
    penyimpanganUtama: p ? `${p.bagian}: ${p.jenis}${p.selisihDerajat !== undefined ? ` (±${p.selisihDerajat}°)` : ""}` : "—",
  };
}

/** Skenario terkendali dari satu video guru (docs/04 bagian 10). */
export function skenarioTerkendali(guru: readonly FrameFitur[], label: readonly JenisSegmen[], cermin?: readonly FrameFitur[]): BarisSkenario[] {
  const nilai = (murid: readonly FrameFitur[], opsi?: OpsiPenilaian) => nilaiLatihan(guru, label, murid, opsi);
  const baris: BarisSkenario[] = [
    barisSkenario("Identik dengan guru", "≈100", nilai(guru)),
    barisSkenario("Tempo 25% lebih lambat", "tinggi; tempo ≈1,25", nilai(ubahTempo(guru, 1.25))),
    barisSkenario("Tempo 20% lebih cepat", "tinggi; tempo ≈0,8", nilai(ubahTempo(guru, 0.8))),
    barisSkenario("Derau ±5° di semua sudut", "sedikit turun", nilai(tambahDerau(guru, 5))),
    barisSkenario("Lutut terlalu lurus (+25°)", "agem turun", nilai(geserFitur(guru, { lutut_L: 25, lutut_R: 25 }))),
    barisSkenario("Tangan kurang tinggi (−0,3 badan)", "agem/tangkis turun", nilai(geserFitur(guru, { tinggi_pergelangan_L: -0.3, tinggi_pergelangan_R: -0.3 }))),
    barisSkenario("Siku terlalu ditekuk (−30°)", "tangkis turun", nilai(geserFitur(guru, { siku_L: -30, siku_R: -30 }))),
    barisSkenario("Tanpa seledet (lirikan 0)", "tangkep turun", nilai(guru.map((f) => ({ t: f.t, nilai: { ...f.nilai, lirikan: f.nilai.lirikan === null || f.nilai.lirikan === undefined ? null : 0 } })))),
    barisSkenario("Sisi tertukar (data dibalik)", "turun jelas", nilai(guru.map((f) => ({ t: f.t, nilai: tukarSisi(f.nilai) })))),
  ];
  if (cermin) {
    baris.push(barisSkenario("Video dicerminkan, opsi cermin mati", "turun jelas", nilai(cermin)));
    baris.push(barisSkenario("Video dicerminkan, opsi cermin aktif", "kembali tinggi", nilai(cermin, { guruMemperagakanCermin: true })));
  }
  return baris;
}
