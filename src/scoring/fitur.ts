// Fitur gerak per frame untuk keempat unsur (docs/04 bagian 6). Fungsi murni.
// Sudut dan tinggi relatif dihitung dari koordinat dunia 3D (meter), supaya tidak terpengaruh
// perspektif, jarak ke kamera, atau rasio layar. Perpindahan pinggul memakai koordinat gambar
// yang dikoreksi rasio lebar/tinggi, karena koordinat dunia selalu berpusat di pinggul.
import { ALFA_PENGHALUSAN, FPS_ACUAN_PENGHALUSAN, TOLERANSI_FITUR, VISIBILITY_MIN } from "../config";
import { JARI, type NamaJari } from "../vision/handIndex";
import { POSE } from "../vision/poseIndex";
import type { HasilDeteksi, Titik } from "../vision/types";
import { hitungLirikan, hitungSenyum } from "./wajah";
import { kurang, median, panjang, sudutAntara, sudutTigaTitik, tengah, terlihat } from "./geometri";
import type { Unsur } from "./types";

type Sisi = "L" | "R";
type NomorJari = 1 | 2 | 3 | 4 | 5;

export type NamaFitur =
  | `siku_${Sisi}`
  | `bahu_${Sisi}`
  | `lutut_${Sisi}`
  | `pinggul_${Sisi}`
  | "miring_badan"
  | "arah_hadap"
  | `tinggi_siku_${Sisi}`
  | `tinggi_pergelangan_${Sisi}`
  | "bentang_lengan"
  | "arah_kepala"
  | "geser_x"
  | "geser_y"
  | `tekuk_jari_${NomorJari}_${Sisi}`
  | "lirikan"
  | "senyum";

/** sudutJari: sudut tekuk jari, toleransinya sendiri karena derau ukurnya jauh lebih besar (config). */
export type JenisFitur = "sudut" | "sudutJari" | "posisi" | "lirikan" | "senyum";

/** Jenis fitur yang nilainya dalam derajat (untuk kalimat koreksi "±…°"). */
export const JENIS_DERAJAT: ReadonlySet<JenisFitur> = new Set(["sudut", "sudutJari"]);

/** Satu frame deret fitur; sama bentuknya dengan FrameFiturSchema di JSON pelajaran. */
export type FrameFitur = { t: number; nilai: Partial<Record<NamaFitur, number | null>> };

const JARI_BERNOMOR: ReadonlyArray<[NomorJari, NamaJari]> = [
  [1, "jempol"],
  [2, "telunjuk"],
  [3, "tengah"],
  [4, "manis"],
  [5, "kelingking"],
];
const fiturJari = (s: Sisi) => JARI_BERNOMOR.map(([n]) => `tekuk_jari_${n}_${s}` as const);

export const JENIS_FITUR: Record<NamaFitur, JenisFitur> = {
  siku_L: "sudut", siku_R: "sudut",
  bahu_L: "sudut", bahu_R: "sudut",
  lutut_L: "sudut", lutut_R: "sudut",
  pinggul_L: "sudut", pinggul_R: "sudut",
  miring_badan: "sudut",
  arah_hadap: "sudut",
  tinggi_siku_L: "posisi", tinggi_siku_R: "posisi",
  tinggi_pergelangan_L: "posisi", tinggi_pergelangan_R: "posisi",
  bentang_lengan: "posisi",
  arah_kepala: "posisi",
  geser_x: "posisi", geser_y: "posisi",
  ...(Object.fromEntries([...fiturJari("L"), ...fiturJari("R")].map((n) => [n, "sudutJari"])) as Record<`tekuk_jari_${NomorJari}_${Sisi}`, "sudutJari">),
  lirikan: "lirikan",
  senyum: "senyum",
};

export const DAFTAR_FITUR = Object.keys(JENIS_FITUR) as NamaFitur[];

export const TOLERANSI_JENIS: Record<JenisFitur, number> = {
  sudut: TOLERANSI_FITUR.sudutDerajat,
  sudutJari: TOLERANSI_FITUR.sudutJariDerajat,
  posisi: TOLERANSI_FITUR.posisiPanjangBadan,
  lirikan: TOLERANSI_FITUR.lirikan,
  senyum: TOLERANSI_FITUR.senyum,
};

/**
 * Fitur yang dinilai untuk tiap unsur (docs/04 bagian 6), dikelompokkan per bagian tubuh.
 * geser_y (naik-turun pinggul) sengaja tidak dinilai: itu terjadi karena lutut ditekuk, dan
 * tekukan lutut sudah dinilai pada agem. Tandang adalah perpindahan mendatar (pola lantai).
 */
export const KELOMPOK_UNSUR: Record<Unsur, Readonly<Record<string, readonly NamaFitur[]>>> = {
  agem: {
    lutut: ["lutut_L", "lutut_R"],
    pinggul: ["pinggul_L", "pinggul_R"],
    badan: ["miring_badan"],
    lengan: ["tinggi_siku_L", "tinggi_siku_R", "tinggi_pergelangan_L", "tinggi_pergelangan_R", "bentang_lengan"],
    jari: [...fiturJari("L"), ...fiturJari("R")],
  },
  tangkis: {
    siku: ["siku_L", "siku_R"],
    bahu: ["bahu_L", "bahu_R"],
    tangan: ["tinggi_pergelangan_L", "tinggi_pergelangan_R"],
    jari: [...fiturJari("L"), ...fiturJari("R")],
  },
  tandang: { langkah: ["geser_x"], arah: ["arah_hadap"], lutut: ["lutut_L", "lutut_R"] },
  tangkep: { mata: ["lirikan"], kepala: ["arah_kepala"], senyum: ["senyum"] },
};

const ratakan = (u: Unsur): readonly NamaFitur[] => Object.values(KELOMPOK_UNSUR[u]).flat();
export const FITUR_UNSUR: Record<Unsur, readonly NamaFitur[]> = {
  agem: ratakan("agem"),
  tandang: ratakan("tandang"),
  tangkis: ratakan("tangkis"),
  tangkep: ratakan("tangkep"),
};

const SISI_POSE = {
  L: { bahu: POSE.BAHU_KIRI, siku: POSE.SIKU_KIRI, pergelangan: POSE.PERGELANGAN_KIRI, pinggul: POSE.PINGGUL_KIRI, lutut: POSE.LUTUT_KIRI, kaki: POSE.PERGELANGAN_KAKI_KIRI },
  R: { bahu: POSE.BAHU_KANAN, siku: POSE.SIKU_KANAN, pergelangan: POSE.PERGELANGAN_KANAN, pinggul: POSE.PINGGUL_KANAN, lutut: POSE.LUTUT_KANAN, kaki: POSE.PERGELANGAN_KAKI_KANAN },
} as const;

/** Mengambil beberapa titik sekaligus; null bila ada yang tidak cukup terlihat. */
function ambil(titik: Titik[] | null, nomor: readonly number[]): Titik[] | null {
  if (!titik) return null;
  const hasil: Titik[] = [];
  for (const n of nomor) {
    const t = titik[n];
    if (!terlihat(t, VISIBILITY_MIN)) return null;
    hasil.push(t);
  }
  return hasil;
}

const sudutDari = (titik: Titik[] | null, a: number, b: number, c: number): number | null => {
  const p = ambil(titik, [a, b, c]);
  return p ? sudutTigaTitik(p[0]!, p[1]!, p[2]!) : null;
};

function fiturTangan(tangan: Titik[] | null, s: Sisi, nilai: FrameFitur["nilai"]): void {
  for (const [n, nama] of JARI_BERNOMOR) {
    const [pangkal, tengahJari, , ujung] = JARI[nama];
    nilai[`tekuk_jari_${n}_${s}`] = tangan ? sudutDari(tangan, pangkal, tengahJari, ujung) : null;
  }
}

/** Fitur satu frame. geser_x/geser_y diisi belakangan oleh hitungDeretFitur. */
export function hitungFiturFrame(h: HasilDeteksi): FrameFitur["nilai"] {
  const nilai: FrameFitur["nilai"] = {};
  const dunia = h.poseDunia;
  const badan = ambil(dunia, [POSE.BAHU_KIRI, POSE.BAHU_KANAN, POSE.PINGGUL_KIRI, POSE.PINGGUL_KANAN]);
  const tengahBahu = badan ? tengah(badan[0]!, badan[1]!) : null;
  const tengahPinggul = badan ? tengah(badan[2]!, badan[3]!) : null;
  const panjangBadan = tengahBahu && tengahPinggul ? panjang(kurang(tengahBahu, tengahPinggul)) : 0;

  for (const s of ["L", "R"] as const) {
    const i = SISI_POSE[s];
    nilai[`siku_${s}`] = sudutDari(dunia, i.bahu, i.siku, i.pergelangan);
    nilai[`bahu_${s}`] = sudutDari(dunia, i.pinggul, i.bahu, i.siku);
    nilai[`lutut_${s}`] = sudutDari(dunia, i.pinggul, i.lutut, i.kaki);
    nilai[`pinggul_${s}`] = sudutDari(dunia, i.bahu, i.pinggul, i.lutut);
    // Sumbu y dunia mengarah ke bawah: nilai positif = titik di atas bahu (mis. miles-agem ≈ 0).
    const lengan = ambil(dunia, [i.bahu, i.siku, i.pergelangan]);
    nilai[`tinggi_siku_${s}`] = lengan && panjangBadan > 0 ? (lengan[0]!.y - lengan[1]!.y) / panjangBadan : null;
    nilai[`tinggi_pergelangan_${s}`] = lengan && panjangBadan > 0 ? (lengan[0]!.y - lengan[2]!.y) / panjangBadan : null;
  }

  // Kemiringan badan: sudut garis pinggul→bahu terhadap arah atas (−y).
  nilai.miring_badan = tengahBahu && tengahPinggul ? sudutAntara(kurang(tengahBahu, tengahPinggul), { x: 0, y: -1, z: 0 }) : null;
  // Arah hadap: putaran garis bahu di bidang datar (x–z); 0° = menghadap kamera.
  nilai.arah_hadap = badan ? (Math.atan2(badan[0]!.z - badan[1]!.z, badan[0]!.x - badan[1]!.x) * 180) / Math.PI : null;

  const pergelangan = ambil(dunia, [POSE.PERGELANGAN_KIRI, POSE.PERGELANGAN_KANAN]);
  nilai.bentang_lengan = pergelangan && panjangBadan > 0 ? panjang(kurang(pergelangan[0]!, pergelangan[1]!)) / panjangBadan : null;

  // Arah kepala (gerak muka pada seledet): posisi mendatar hidung relatif titik tengah kedua mata,
  // dibagi jarak 3D antarmata. Jarak 3D tidak menyusut saat kepala menoleh, berbeda dengan jarak
  // mendatar yang dipakai versi lama: uji Janger 3 Nov 2026 menunjukkan versi lama mencapai −47
  // saat kepala menoleh, sehingga satu frame bisa menenggelamkan nilai tangkep (docs/09).
  const kepala = ambil(dunia, [POSE.HIDUNG, POSE.MATA_KIRI, POSE.MATA_KANAN]);
  const jarakMata = kepala ? panjang(kurang(kepala[1]!, kepala[2]!)) : 0;
  nilai.arah_kepala =
    kepala && jarakMata > 0 ? Math.max(-BATAS_ARAH_KEPALA, Math.min(BATAS_ARAH_KEPALA, (kepala[0]!.x - (kepala[1]!.x + kepala[2]!.x) / 2) / jarakMata)) : null;

  fiturTangan(h.tanganKiriDunia, "L", nilai);
  fiturTangan(h.tanganKananDunia, "R", nilai);

  nilai.lirikan = h.wajah ? hitungLirikan(h.wajah) : null;
  nilai.senyum = h.wajah ? hitungSenyum(h.wajah) : null;
  return nilai;
}

/** Pusat pinggul dan panjang badan di bidang gambar, dengan x dikoreksi rasio lebar/tinggi. */
function pinggulGambar(h: HasilDeteksi): { x: number; y: number; badan: number } | null {
  const p = ambil(h.pose, [POSE.BAHU_KIRI, POSE.BAHU_KANAN, POSE.PINGGUL_KIRI, POSE.PINGGUL_KANAN]);
  if (!p) return null;
  const k = (t: Titik) => ({ x: t.x * h.rasioGambar, y: t.y, z: 0 });
  const bahu = tengah(k(p[0]!), k(p[1]!));
  const pinggul = tengah(k(p[2]!), k(p[3]!));
  return { x: pinggul.x, y: pinggul.y, badan: panjang(kurang(bahu, pinggul)) };
}

/**
 * Deret fitur dari deret hasil deteksi:
 * 1. fitur per frame;
 * 2. perpindahan pinggul relatif posisi awal, dalam satuan panjang badan (median);
 * 3. penghalusan rata-rata bergerak eksponensial (docs/04 bagian 4). Nilai kosong tidak diisi.
 */
export function hitungDeretFitur(frame: readonly HasilDeteksi[]): FrameFitur[] {
  const deret: FrameFitur[] = frame.map((h) => ({ t: h.waktuMs / 1000, nilai: hitungFiturFrame(h) }));

  const pinggul = frame.map(pinggulGambar);
  const skala = median(pinggul.flatMap((p) => (p ? [p.badan] : [])));
  const awal = pinggul.find((p) => p !== null);
  deret.forEach((f, i) => {
    const p = pinggul[i];
    f.nilai.geser_x = p && awal && skala ? (p.x - awal.x) / skala : null;
    f.nilai.geser_y = p && awal && skala ? (p.y - awal.y) / skala : null;
  });

  for (const nama of DAFTAR_FITUR) {
    let sebelumnya: number | null = null;
    let tSebelumnya = 0;
    for (const f of deret) {
      const v = f.nilai[nama];
      if (v === null || v === undefined) {
        sebelumnya = null;
        continue;
      }
      // Fitur melingkar dihaluskan lewat jalan terpendek: 179° dan −179° berselisih 2°, bukan 358°.
      sebelumnya = sebelumnya === null ? v : bungkus(nama, sebelumnya + alfaUntuk(f.t - tSebelumnya) * selisihFitur(nama, v, sebelumnya));
      tSebelumnya = f.t;
      f.nilai[nama] = sebelumnya;
    }
  }
  return deret;
}

/** Konstanta waktu penghalusan (detik): alfa ALFA_PENGHALUSAN per frame pada FPS_ACUAN_PENGHALUSAN. */
export const TAU_PENGHALUSAN = -1 / FPS_ACUAN_PENGHALUSAN / Math.log(1 - ALFA_PENGHALUSAN);

/** Bobot nilai baru untuk jarak waktu dt: sama dengan ALFA_PENGHALUSAN bila dt = 1/FPS_ACUAN_PENGHALUSAN. */
export const alfaUntuk = (dt: number): number => (dt > 0 ? 1 - Math.exp(-dt / TAU_PENGHALUSAN) : 0);

/**
 * Perpindahan (geser_x, geser_y) relatif terhadap posisi tengah (median) deret itu sendiri.
 * Yang dinilai pada tandang adalah POLA perpindahan, bukan letak di ruangan. Tanpa ini, murid yang
 * mulai di titik lain dari tarian (mis. terlambat 1,5 detik) mendapat selisih langkah tetap di
 * seluruh latihan (uji ujung ke ujung 3 Nov 2026, docs/09 bagian 10).
 */
export function pusatkanGeser(deret: readonly FrameFitur[]): FrameFitur[] {
  const ada = (v: number | null | undefined): v is number => v !== null && v !== undefined;
  const tengahX = median(deret.flatMap((f) => (ada(f.nilai.geser_x) ? [f.nilai.geser_x] : [])));
  const tengahY = median(deret.flatMap((f) => (ada(f.nilai.geser_y) ? [f.nilai.geser_y] : [])));
  return deret.map((f) => {
    const nilai = { ...f.nilai };
    if (ada(nilai.geser_x) && tengahX !== null) nilai.geser_x = nilai.geser_x - tengahX;
    if (ada(nilai.geser_y) && tengahY !== null) nilai.geser_y = nilai.geser_y - tengahY;
    return { t: f.t, nilai };
  });
}

/** Batas nilai arah kepala (rasio hidung terhadap jarak antarmata); di luar ini dianggap derau. */
const BATAS_ARAH_KEPALA = 2;

/**
 * Fitur sudut melingkar, dalam derajat (−180°…180°). arah_hadap melompat dari +179° ke −179° saat
 * penari membelakangi kamera, padahal badannya hanya berputar 2°.
 */
export const FITUR_MELINGKAR: ReadonlySet<NamaFitur> = new Set(["arah_hadap"]);

/**
 * a − b untuk fitur `nama`. Untuk fitur melingkar, selisihnya dibungkus ke (−periode/2, periode/2].
 * `periode` dalam satuan nilainya: 360 untuk derajat, 360/15 = 24 bila nilai sudah dibagi toleransi.
 */
export function selisihFitur(nama: NamaFitur, a: number, b: number, periode = 360): number {
  const d = a - b;
  return FITUR_MELINGKAR.has(nama) ? d - periode * Math.round(d / periode) : d;
}

const bungkus = (nama: NamaFitur, v: number): number => (FITUR_MELINGKAR.has(nama) ? v - 360 * Math.round(v / 360) : v);

/** Arah mendatar yang berbalik bila kiri–kanan ditukar. */
const FITUR_BERARAH: readonly NamaFitur[] = ["geser_x", "arah_hadap", "arah_kepala", "lirikan"];

/**
 * Untuk guru yang memperagakan secara cermin (opsi guruMemperagakanCermin, docs/04 bagian 3):
 * fitur sisi kiri dan kanan ditukar, dan fitur berarah dibalik tandanya.
 */
export function tukarSisi(nilai: FrameFitur["nilai"]): FrameFitur["nilai"] {
  const hasil: FrameFitur["nilai"] = {};
  for (const [kunci, v] of Object.entries(nilai) as [NamaFitur, number | null][]) {
    const lawan = kunci.endsWith("_L") ? kunci.replace(/_L$/, "_R") : kunci.endsWith("_R") ? kunci.replace(/_R$/, "_L") : kunci;
    hasil[lawan as NamaFitur] = FITUR_BERARAH.includes(kunci) && v !== null ? -v : v;
  }
  return hasil;
}
