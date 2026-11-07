// Menyusun JSON pelajaran dari hasil ekstraksi video guru (docs/03 bagian F). Fungsi murni.
// Yang disimpan hanya deret fitur (angka) dan segmen; tidak ada gambar, video, atau titik wajah.
import type { FrameFitur } from "../scoring/fitur";
import { keSegmen, type JenisSegmen } from "../scoring/segmentasi";
import type { Unsur } from "../scoring/types";
import { PelajaranSchema, type Pelajaran, type SumberVideo } from "./schema";

export type DataPelajaran = {
  judul: string;
  namaGerak: string;
  guru: { nama: string; sanggar?: string };
  sumberVideo: SumberVideo;
  guruMemperagakanCermin: boolean;
  modelVersi: string;
  fps: number;
};

/** Huruf kecil, angka, dan tanda hubung, sesuai aturan id di skema. */
export function keSlug(teks: string): string {
  const s = teks
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "pelajaran";
}

const bulat = (v: number | null | undefined) => (v === null || v === undefined ? null : Math.round(v * 1000) / 1000);

/** Unsur utama gerak menurut porsi segmen gurunya; tangkep selalu ikut (dinilai sepanjang gerak). */
function unsurUtama(label: readonly JenisSegmen[]): Unsur[] {
  const porsi = (j: JenisSegmen) => label.filter((l) => l === j).length / Math.max(1, label.length);
  const unsur: Unsur[] = [];
  if (porsi("pokok") >= 0.1) unsur.push("agem");
  if (porsi("peralihan") >= 0.1) unsur.push("tangkis");
  if (porsi("perpindahan") >= 0.1) unsur.push("tandang");
  unsur.push("tangkep");
  return unsur;
}

export function susunPelajaran(data: DataPelajaran, deret: readonly FrameFitur[], label: readonly JenisSegmen[]) {
  const frame = deret.map((f) => ({
    t: bulat(f.t) ?? 0,
    nilai: Object.fromEntries(Object.entries(f.nilai).map(([k, v]) => [k, bulat(v)])),
  }));
  const segmen = keSegmen(deret, label).map((s) => ({ ...s, mulaiDetik: bulat(s.mulaiDetik) ?? 0, selesaiDetik: bulat(s.selesaiDetik) ?? 0 }));
  const selesai = segmen[segmen.length - 1]?.selesaiDetik ?? 0;
  const pelajaran: Pelajaran = {
    id: keSlug(data.judul),
    judul: data.judul,
    guru: data.guru,
    sumberVideo: data.sumberVideo,
    guruMemperagakanCermin: data.guruMemperagakanCermin,
    modelVersi: data.modelVersi,
    fps: data.fps,
    gerak: [
      {
        id: keSlug(data.namaGerak),
        nama: data.namaGerak,
        unsurUtama: unsurUtama(label),
        mulaiDetik: 0,
        selesaiDetik: selesai,
        segmen,
        frame,
      },
    ],
  };
  return PelajaranSchema.safeParse(pelajaran);
}
