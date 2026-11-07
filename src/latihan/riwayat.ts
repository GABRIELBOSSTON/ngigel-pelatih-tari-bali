// Riwayat latihan di peramban murid (docs/05 bagian 2: MVP tanpa data murid di server).
// Yang disimpan hanya angka hasil: skor, koreksi, dan garis waktu kemiripan. Tanpa video, gambar,
// titik tubuh, atau titik wajah. Data dibaca ulang lewat skema, karena localStorage bisa diubah
// atau rusak; data yang tidak lolos skema dibuang, bukan membuat halaman galat.
import { z } from "zod";
import { DAFTAR_UNSUR } from "../scoring/types";

const KUNCI = "ngigel.riwayat.v1";
/** Batas jumlah sesi yang disimpan; yang paling lama dibuang. */
export const MAKS_SESI = 30;

const skorUnsur = z.object(Object.fromEntries(DAFTAR_UNSUR.map((u) => [u, z.number().nullable()])) as Record<(typeof DAFTAR_UNSUR)[number], z.ZodNullable<z.ZodNumber>>);

export const SesiSchema = z.object({
  id: z.string().min(1),
  kelasId: z.string().min(1),
  namaKelas: z.string(),
  /** true bila kelas ini memakai video contoh (materinya belum ada). */
  memakaiContoh: z.boolean(),
  /** true bila video guru dipilih pengguna dari perangkatnya (tidak bisa diputar ulang di halaman Hasil). */
  videoDariBerkas: z.boolean(),
  dibuat: z.string(), // ISO 8601
  mulai: z.number(),
  akhir: z.number(),
  skorTotal: z.number().nullable(),
  skor: skorUnsur,
  alasan: z.record(z.string(), z.string()),
  penyimpangan: z.array(
    z.object({
      unsur: z.enum(DAFTAR_UNSUR),
      fitur: z.string(),
      bagian: z.string(),
      jenis: z.string(),
      selisihToleransi: z.number(),
      selisihDerajat: z.number().optional(),
      waktuDetik: z.number().optional(),
    }),
  ),
  terlambatDetik: z.number().nullable(),
  /** Jarak RMS per kelompok bagian tubuh, dalam satuan toleransi (rincian teknis dan kalibrasi). */
  jarakKelompok: z.record(z.string(), z.record(z.string(), z.number())).optional(),
  /** Seledet sebagai kejadian (src/scoring/seledet.ts); null bila rentang guru tanpa seledet. */
  seledet: z
    .union([
      z.object({
        jumlahGuru: z.number(),
        tepat: z.number(),
        arahSalah: z.number(),
        kejadian: z.array(z.object({ t: z.number(), status: z.enum(["tepat", "arah-salah", "terlewat"]) })),
      }),
      z.object({ tidakTerbaca: z.literal(true), jumlahGuru: z.number() }),
    ])
    .nullable()
    .optional(),
  tubuhTerbacaPersen: z.number(),
  /** Kemiripan rata-rata per detik selama menari (0–100), dimulai dari `mulai`. */
  garisWaktu: z.array(z.number().nullable()),
  segmen: z.array(z.object({ jenis: z.enum(["pokok", "peralihan", "perpindahan"]), mulaiDetik: z.number(), selesaiDetik: z.number() })),
  fpsRata: z.number(),
  modeAi: z.string(),
  kecepatanPutar: z.number(),
  /** Gerbang kualitas kamera (sejak 7 Nov 2026; sesi lama tidak punya). */
  kualitas: z
    .object({
      ukuranTubuh: z.number().nullable(),
      keyakinan: z.number().nullable(),
      porsiKurangJelas: z.number(),
      masalahUtama: z.enum(["kecil", "gelap", "buram", "ragu"]).nullable(),
    })
    .optional(),
  /** Kartu kesalahan berulang yang muncul saat menari (sejak 7 Nov 2026). */
  kesalahanBerulang: z
    .array(
      z.object({
        judul: z.string(),
        guru: z.string().nullable(),
        anda: z.string().nullable(),
        saran: z.string(),
        kali: z.number(),
        detik: z.number(),
      }),
    )
    .max(5)
    .optional(),
});

export type SesiTersimpan = z.infer<typeof SesiSchema>;

type Penyimpanan = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** localStorage bisa tidak ada atau melempar galat (mode privat, situs diblokir). */
function penyimpananBawaan(): Penyimpanan | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function bacaRiwayat(penyimpanan: Penyimpanan | null = penyimpananBawaan()): SesiTersimpan[] {
  if (!penyimpanan) return [];
  try {
    const mentah: unknown = JSON.parse(penyimpanan.getItem(KUNCI) ?? "[]");
    if (!Array.isArray(mentah)) return [];
    return mentah.flatMap((s) => {
      const hasil = SesiSchema.safeParse(s);
      return hasil.success ? [hasil.data] : [];
    });
  } catch {
    return [];
  }
}

/** Menyimpan sesi di urutan terdepan. Mengembalikan false bila penyimpanan tidak bisa dipakai. */
export function simpanSesi(sesi: SesiTersimpan, penyimpanan: Penyimpanan | null = penyimpananBawaan()): boolean {
  if (!penyimpanan) return false;
  try {
    const daftar = [sesi, ...bacaRiwayat(penyimpanan).filter((s) => s.id !== sesi.id)].slice(0, MAKS_SESI);
    penyimpanan.setItem(KUNCI, JSON.stringify(daftar));
    return true;
  } catch {
    return false;
  }
}

export function cariSesi(id: string | undefined, penyimpanan: Penyimpanan | null = penyimpananBawaan()): SesiTersimpan | undefined {
  return bacaRiwayat(penyimpanan).find((s) => s.id === id);
}

export function hapusRiwayat(penyimpanan: Penyimpanan | null = penyimpananBawaan()): void {
  try {
    penyimpanan?.removeItem(KUNCI);
  } catch {
    // tidak ada yang bisa dihapus
  }
}

export type KemajuanKelas = { kelasId: string; namaKelas: string; data: { waktu: string; skor: number | null }[] };

/**
 * Riwayat dikelompokkan per kelas, urut waktu (lama → baru) di dalam kelas. Kelas yang paling baru
 * dilatih tampil lebih dulu. Hanya kelas dengan minimal `minLatihan` sesi (garis butuh dua titik).
 */
export function kemajuanPerKelas(riwayat: readonly SesiTersimpan[], minLatihan = 2): KemajuanKelas[] {
  const kelompok = new Map<string, SesiTersimpan[]>();
  for (const s of riwayat) kelompok.set(s.kelasId, [...(kelompok.get(s.kelasId) ?? []), s]);
  return [...kelompok.values()]
    .filter((daftar) => daftar.length >= minLatihan)
    .map((daftar) => [...daftar].sort((a, b) => a.dibuat.localeCompare(b.dibuat)))
    .sort((a, b) => b[b.length - 1]!.dibuat.localeCompare(a[a.length - 1]!.dibuat))
    .map((daftar) => ({ kelasId: daftar[0]!.kelasId, namaKelas: daftar[0]!.namaKelas, data: daftar.map((s) => ({ waktu: s.dibuat, skor: s.skorTotal })) }));
}

/** Id sesi pendek yang aman untuk URL, mis. "m3k9x2-4f7a". */
export function buatIdSesi(sekarang: number = Date.now(), acak: number = Math.random()): string {
  return `${sekarang.toString(36)}-${Math.floor(acak * 36 ** 4)
    .toString(36)
    .padStart(4, "0")}`;
}
