// Pengaturan studio latihan per perangkat (kenyamanan saja; aman bila penyimpanan tidak tersedia).
import { z } from "zod";

const KUNCI = "ngigel.pengaturan.v1";

export const KECEPATAN_PUTAR = [0.5, 0.75, 1] as const;

const PengaturanSchema = z.object({
  /** Video guru ditampilkan seperti cermin (docs/04 bagian 3; hanya untuk berkas video, bukan pemutar YouTube). */
  cerminGuru: z.boolean(),
  kecepatan: z.union([z.literal(0.5), z.literal(0.75), z.literal(1)]),
  /** Holistic dengan GPU tanpa blendshape: lebih cepat, tetapi ekspresi wajah (tangkep) tidak dinilai. */
  modeCepat: z.boolean(),
  suara: z.boolean(),
  /** Petunjuk diucapkan (Web Speech API), bila peramban punya suara berbahasa Indonesia. */
  pelatihSuara: z.boolean().default(true),
});

export type Pengaturan = z.infer<typeof PengaturanSchema>;

export const PENGATURAN_BAWAAN: Pengaturan = { cerminGuru: true, kecepatan: 1, modeCepat: false, suara: true, pelatihSuara: true };

export function bacaPengaturan(): Pengaturan {
  try {
    const hasil = PengaturanSchema.safeParse(JSON.parse(localStorage.getItem(KUNCI) ?? "null"));
    return hasil.success ? hasil.data : PENGATURAN_BAWAAN;
  } catch {
    return PENGATURAN_BAWAAN;
  }
}

export function simpanPengaturan(p: Pengaturan): void {
  try {
    localStorage.setItem(KUNCI, JSON.stringify(p));
  } catch {
    // tidak apa-apa: pengaturan kembali ke bawaan di kunjungan berikutnya
  }
}
