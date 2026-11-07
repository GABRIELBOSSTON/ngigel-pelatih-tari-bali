// Umpan balik saat menari (docs/04 bagian 8). Fungsi murni.
// Frame murid dibandingkan dengan frame guru yang PALING MIRIP di jendela [t − mundur, t + maju],
// supaya murid yang sedikit terlambat tidak langsung disalahkan. Dari frame guru itu dihitung:
// kemiripan 0–100 dan satu petunjuk perbaikan yang paling penting, dalam kalimat perintah.
import { JENDELA_REALTIME_DETIK, TAU_UNSUR } from "../config";
import { JENIS_FITUR, TOLERANSI_JENIS, type FrameFitur, type NamaFitur } from "../scoring/fitur";
import { warnaRealtime } from "../scoring/realtime";
import type { WarnaKemiripan } from "../scoring/types";
import type { BagianGambar } from "../vision/garis";

/** Fitur tubuh untuk kemiripan saat menari: sudut sendi besar dan posisi tangan (tanpa jari dan wajah). */
export const FITUR_TUBUH: readonly NamaFitur[] = [
  "siku_L", "siku_R", "bahu_L", "bahu_R", "lutut_L", "lutut_R", "pinggul_L", "pinggul_R",
  "miring_badan", "tinggi_siku_L", "tinggi_siku_R", "tinggi_pergelangan_L", "tinggi_pergelangan_R", "bentang_lengan",
];

/** Minimal fitur bersama supaya kemiripan satu frame layak dihitung. */
const MIN_FITUR_BERSAMA = 4;

/** Petunjuk hanya muncul bila selisihnya minimal sekian kali toleransi (1 = 15° untuk sudut). */
export const AMBANG_PETUNJUK = 1;

type Nilai = FrameFitur["nilai"];

/** Indeks frame guru di dalam jendela waktu; deret guru terurut menurut t. */
export function jendelaGuru(guru: readonly FrameFitur[], t: number): readonly FrameFitur[] {
  const dari = t - JENDELA_REALTIME_DETIK.mundur;
  const sampai = t + JENDELA_REALTIME_DETIK.maju;
  let kiri = 0;
  let kanan = guru.length;
  while (kiri < kanan) {
    const tengah = (kiri + kanan) >> 1;
    if (guru[tengah]!.t < dari) kiri = tengah + 1;
    else kanan = tengah;
  }
  let akhir = kiri;
  while (akhir < guru.length && guru[akhir]!.t <= sampai) akhir += 1;
  return guru.slice(kiri, akhir);
}

const ada = (v: number | null | undefined): v is number => v !== null && v !== undefined;

/** Jarak RMS fitur tubuh dalam satuan toleransi; null bila fitur bersama terlalu sedikit. */
export function jarakTubuh(guru: Nilai, murid: Nilai): number | null {
  let jumlah = 0;
  let n = 0;
  for (const nama of FITUR_TUBUH) {
    const g = guru[nama];
    const m = murid[nama];
    if (!ada(g) || !ada(m)) continue;
    jumlah += ((m - g) / TOLERANSI_JENIS[JENIS_FITUR[nama]]) ** 2;
    n += 1;
  }
  return n >= MIN_FITUR_BERSAMA ? Math.sqrt(jumlah / n) : null;
}

/** Frame guru di dalam jendela yang paling mirip dengan murid. */
export function frameGuruTerdekat(guru: readonly FrameFitur[], murid: Nilai, t: number): { frame: FrameFitur; jarak: number } | null {
  let terbaik: { frame: FrameFitur; jarak: number } | null = null;
  for (const f of jendelaGuru(guru, t)) {
    const d = jarakTubuh(f.nilai, murid);
    if (d !== null && (terbaik === null || d < terbaik.jarak)) terbaik = { frame: f, jarak: d };
  }
  return terbaik;
}

/** Kemiripan 0–100 dengan rumus skor yang sama seperti penilaian akhir: 100 × exp(−jarak/τ). */
export const kemiripanDariJarak = (jarak: number): number => Math.round(100 * Math.exp(-jarak / TAU_UNSUR.agem));

export type Petunjuk = {
  teks: string;
  bagian: BagianGambar;
  fitur: NamaFitur;
  /** Nilai fitur guru dan murid pada frame yang dibandingkan (untuk kartu "Guru: … / Anda: …"). */
  nilaiGuru: number;
  nilaiMurid: number;
  /** Selisih dalam satuan asli: derajat untuk sudut, panjang badan untuk posisi. */
  selisih: number;
  /** Selisih dalam satuan toleransi (dasar urutan kepentingan). */
  selisihToleransi: number;
};

const SISI: Record<"L" | "R", string> = { L: "kiri", R: "kanan" };

/**
 * Kalimat perintah dari selisih murid − guru. Sisi kiri/kanan adalah sisi tubuh murid sendiri.
 * Sudut lebih besar = sendi lebih lurus; bahu lebih besar = lengan lebih terangkat;
 * tinggi lebih besar = lebih tinggi (fitur.ts).
 */
export function kalimatPetunjuk(nama: NamaFitur, selisih: number): { teks: string; bagian: BagianGambar } | null {
  const lebih = selisih > 0;
  const cocok = /^(.*)_(L|R)$/.exec(nama);
  const dasar = cocok ? cocok[1]! : nama;
  const sisi = cocok ? (cocok[2] as "L" | "R") : null;
  const s = sisi ? SISI[sisi] : "";
  const lengan: BagianGambar = sisi === "L" ? "lenganKiri" : "lenganKanan";
  const tungkai: BagianGambar = sisi === "L" ? "tungkaiKiri" : "tungkaiKanan";
  switch (dasar) {
    case "siku":
      return { teks: lebih ? `Tekuk siku ${s} lebih banyak` : `Luruskan siku ${s}`, bagian: lengan };
    case "bahu":
      return { teks: lebih ? `Turunkan lengan ${s}` : `Angkat lengan ${s} lebih tinggi`, bagian: lengan };
    case "tinggi_siku":
      return { teks: lebih ? `Turunkan siku ${s}` : `Angkat siku ${s}`, bagian: lengan };
    case "tinggi_pergelangan":
      return { teks: lebih ? `Turunkan tangan ${s}` : `Angkat tangan ${s} lebih tinggi`, bagian: lengan };
    case "lutut":
      return { teks: lebih ? `Tekuk lutut ${s} lebih dalam` : `Kurangi tekukan lutut ${s}`, bagian: tungkai };
    case "pinggul":
      return { teks: lebih ? `Condongkan badan seperti guru` : `Tegakkan pinggul ${s}`, bagian: tungkai };
    case "miring_badan":
      return { teks: lebih ? "Tegakkan badan" : "Miringkan badan seperti guru", bagian: "badan" };
    case "bentang_lengan":
      return { teks: lebih ? "Rapatkan kedua tangan" : "Buka kedua lengan lebih lebar", bagian: "badan" };
    default:
      return null;
  }
}

export type UmpanBalik = {
  kemiripan: number | null;
  petunjuk: Petunjuk | null;
  warna: Partial<Record<BagianGambar, WarnaKemiripan>>;
  /** Nilai fitur frame guru yang paling mirip (null bila tidak ada pembanding). */
  guru: Nilai | null;
};

/** Umpan balik satu frame murid pada waktu video guru t (detik). */
export function umpanBalik(guru: readonly FrameFitur[], murid: Nilai, t: number): UmpanBalik {
  const jendela = jendelaGuru(guru, t);
  const warna = warnaRealtime(jendela, murid, t);
  const terdekat = frameGuruTerdekat(jendela, murid, t);
  if (!terdekat) return { kemiripan: null, petunjuk: null, warna, guru: null };

  let petunjuk: Petunjuk | null = null;
  for (const nama of FITUR_TUBUH) {
    const g = terdekat.frame.nilai[nama];
    const m = murid[nama];
    if (!ada(g) || !ada(m)) continue;
    const selisih = m - g;
    const selisihToleransi = Math.abs(selisih) / TOLERANSI_JENIS[JENIS_FITUR[nama]];
    if (selisihToleransi < AMBANG_PETUNJUK || (petunjuk && selisihToleransi <= petunjuk.selisihToleransi)) continue;
    const kalimat = kalimatPetunjuk(nama, selisih);
    // Bagian yang sudah hijau (cocok dengan salah satu frame guru di jendela) tidak diberi petunjuk,
    // supaya layar tidak menampilkan garis hijau sekaligus perintah untuk bagian yang sama.
    if (kalimat && warna[kalimat.bagian] !== "hijau") petunjuk = { ...kalimat, fitur: nama, nilaiGuru: g, nilaiMurid: m, selisih, selisihToleransi };
  }
  return { kemiripan: kemiripanDariJarak(terdekat.jarak), petunjuk, warna, guru: terdekat.frame.nilai };
}
