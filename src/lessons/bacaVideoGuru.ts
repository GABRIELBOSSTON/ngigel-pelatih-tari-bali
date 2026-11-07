// Membaca gerak dari berkas video di perangkat: video → titik → deret fitur → segmen
// (docs/03 bagian F). Dipakai halaman Untuk Guru dan cadangan halaman Latihan bila JSON pelajaran
// belum ada. Video tidak dikirim ke mana pun.
import { hitungDeretFitur, type FrameFitur } from "../scoring/fitur";
import { labelSegmen, type JenisSegmen } from "../scoring/segmentasi";
import { statistikDeteksi } from "../uji/analisis";
import { ekstrakDariVideo } from "../vision/ekstrakVideo";
import { KlienVisi } from "../vision/visionClient";

export type GerakDariVideo = {
  deret: FrameFitur[];
  label: JenisSegmen[];
  ringkas: ReturnType<typeof statistikDeteksi>;
  durasiDetik: number;
};

function muatVideo(alamat: string): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  video.src = alamat;
  return new Promise((selesai, gagal) => {
    video.addEventListener(
      "loadeddata",
      () => (video.videoWidth > 0 ? selesai(video) : gagal(new Error("Berkas ini tidak punya gambar (mungkin hanya suara). Pilih berkas video MP4 atau WebM."))),
      { once: true },
    );
    video.addEventListener("error", () => gagal(new Error("Video tidak bisa dibuka. Coba format MP4 atau WebM.")), { once: true });
  });
}

export async function bacaGerakDariBerkas(
  berkas: Blob,
  opsi: { fps: number; saatKemajuan?: (teks: string, porsi: number) => void },
): Promise<GerakDariVideo> {
  const alamat = URL.createObjectURL(berkas);
  const klien = new KlienVisi();
  try {
    opsi.saatKemajuan?.("Memuat model AI…", 0);
    const video = await muatVideo(alamat);
    await klien.mulai("holistic");
    const ekstrak = await ekstrakDariVideo(video, klien, {
      fps: opsi.fps,
      saatKemajuan: (n, total) => opsi.saatKemajuan?.(`Membaca gerak: ${n}/${total} frame`, n / Math.max(1, total)),
    });
    const deret = hitungDeretFitur(ekstrak.frame);
    return { deret, label: labelSegmen(deret), ringkas: statistikDeteksi(ekstrak.frame, ekstrak.lamaProsesMs), durasiDetik: video.duration };
  } finally {
    klien.tutup();
    URL.revokeObjectURL(alamat);
  }
}
