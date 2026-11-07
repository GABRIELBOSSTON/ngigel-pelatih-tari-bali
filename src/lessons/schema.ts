// Skema JSON pelajaran guru (docs/05_DATA_KONTEN_DAN_VIDEO_ACUAN.md bagian 1).
// Semua JSON pelajaran divalidasi dengan skema ini sebelum dipakai.
import { z } from "zod";
import { DAFTAR_UNSUR } from "../scoring/types";

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "gunakan huruf kecil, angka, dan tanda hubung");

/** Satu frame deret fitur. Nama fitur mengikuti docs/04 bagian 6; null = tidak terbaca. */
export const FrameFiturSchema = z.object({
  t: z.number().nonnegative(), // detik sejak awal gerak
  nilai: z.record(z.string(), z.number().nullable()),
});

/** Segmen gerak (docs/04 bagian 5): pokok → agem, peralihan → tangkis, perpindahan → tandang. */
export const SegmenSchema = z
  .object({
    jenis: z.enum(["pokok", "peralihan", "perpindahan"]),
    mulaiDetik: z.number().nonnegative(),
    selesaiDetik: z.number().positive(),
  })
  .refine((s) => s.selesaiDetik > s.mulaiDetik, {
    message: "segmen harus selesai setelah mulai",
    path: ["selesaiDetik"],
  });

export const SumberVideoSchema = z
  .object({
    jenis: z.enum(["youtube", "unggahan"]),
    youtubeId: z.string().min(1).optional(),
    url: z.url().optional(),
    // CC-BY-SA dan domain-publik untuk video berlisensi terbuka di Wikimedia Commons (docs/05 bagian 4.4).
    // izin-diminta: izin pemilik belum ada. Video Janger contoh memakai status ini dan, atas keputusan
    // ketua tim 7 Nov, tampil di situs publik untuk prototipe dengan keterangan hak cipta (docs/05 bagian 4.6).
    lisensi: z.enum(["CC-BY", "CC-BY-SA", "domain-publik", "izin-tertulis", "milik-guru", "izin-diminta"]),
    buktiIzin: z.string().optional(),
    kredit: z.string().min(1, "kredit wajib diisi"),
  })
  .refine((s) => s.jenis !== "youtube" || Boolean(s.youtubeId), {
    message: "video YouTube wajib punya youtubeId",
    path: ["youtubeId"],
  });

export const GerakSchema = z
  .object({
    id: slug,
    nama: z.string().min(1),
    unsurUtama: z.array(z.enum(DAFTAR_UNSUR)).min(1),
    mulaiDetik: z.number().nonnegative(),
    selesaiDetik: z.number().positive(),
    segmen: z.array(SegmenSchema).optional(),
    frame: z.array(FrameFiturSchema).min(1),
    keterangan: z.string().optional(),
  })
  .refine((g) => g.selesaiDetik > g.mulaiDetik, {
    message: "selesaiDetik harus lebih besar dari mulaiDetik",
    path: ["selesaiDetik"],
  })
  .refine(
    (g) =>
      (g.segmen ?? []).every(
        (s) => s.mulaiDetik >= g.mulaiDetik && s.selesaiDetik <= g.selesaiDetik,
      ),
    { message: "segmen keluar dari rentang gerak", path: ["segmen"] },
  );

export const PelajaranSchema = z.object({
  id: slug,
  judul: z.string().min(1),
  guru: z.object({
    nama: z.string().min(1),
    sanggar: z.string().optional(),
    tautan: z.url().optional(),
  }),
  sumberVideo: SumberVideoSchema,
  // docs/04 bagian 3: bila true, kiri–kanan guru ditukar sebelum dibandingkan.
  guruMemperagakanCermin: z.boolean().default(false),
  modelVersi: z.string().min(1),
  fps: z.number().positive(),
  gerak: z.array(GerakSchema).min(1),
});

export type FrameFitur = z.infer<typeof FrameFiturSchema>;
export type Segmen = z.infer<typeof SegmenSchema>;
export type SumberVideo = z.infer<typeof SumberVideoSchema>;
export type Gerak = z.infer<typeof GerakSchema>;
export type Pelajaran = z.infer<typeof PelajaranSchema>;
