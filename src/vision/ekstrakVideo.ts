// Mengekstrak deret hasil deteksi dari berkas video, frame demi frame dengan cap waktu video
// (docs/03 bagian F). Dipakai untuk membuat pelajaran dari video guru dan untuk alat uji.
import type { HasilDeteksi } from "./types";
import type { KlienVisi } from "./visionClient";

export type OpsiEkstrak = {
  fps: number;
  mulaiDetik?: number;
  lamaDetik?: number;
  /**
   * Hanya untuk pengujian: membalik gambar sebelum dideteksi, untuk membuktikan bahwa membalik
   * data menukar kiri–kanan (docs/04 bagian 3). Aplikasi sendiri tidak pernah membalik data.
   */
  balikGambar?: boolean;
  saatKemajuan?: (selesai: number, total: number) => void;
};

export type HasilEkstrak = { frame: HasilDeteksi[]; lamaProsesMs: number[]; lamaTotalMs: number };

function lompatKe(video: HTMLVideoElement, detik: number): Promise<void> {
  if (Math.abs(video.currentTime - detik) < 1e-6 && !video.seeking && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }
  return new Promise((selesai, gagal) => {
    const bersih = () => {
      video.removeEventListener("seeked", berhasil);
      video.removeEventListener("error", salah);
    };
    const berhasil = () => {
      bersih();
      selesai();
    };
    const salah = () => {
      bersih();
      gagal(new Error(`Video gagal dibaca di detik ${detik.toFixed(2)}.`));
    };
    video.addEventListener("seeked", berhasil);
    video.addEventListener("error", salah);
    video.currentTime = detik;
  });
}

export async function ekstrakDariVideo(video: HTMLVideoElement, klien: KlienVisi, opsi: OpsiEkstrak): Promise<HasilEkstrak> {
  const mulai = opsi.mulaiDetik ?? 0;
  const akhir = Math.min(video.duration, mulai + (opsi.lamaDetik ?? Number.POSITIVE_INFINITY));
  const total = Math.max(0, Math.floor((akhir - mulai) * opsi.fps));
  const kanvas = opsi.balikGambar ? new OffscreenCanvas(video.videoWidth, video.videoHeight) : null;
  const ctx = kanvas?.getContext("2d") ?? null;

  const frame: HasilDeteksi[] = [];
  const lamaProsesMs: number[] = [];
  const awal = performance.now();
  for (let k = 0; k < total; k++) {
    const detik = mulai + k / opsi.fps;
    await lompatKe(video, detik);
    let gambar: ImageBitmap;
    if (kanvas && ctx) {
      ctx.setTransform(-1, 0, 0, 1, kanvas.width, 0);
      ctx.drawImage(video, 0, 0);
      gambar = kanvas.transferToImageBitmap();
    } else {
      gambar = await createImageBitmap(video);
    }
    const waktuMs = Math.round((detik - mulai) * 1000);
    const { hasil, lamaProsesMs: lama } = await klien.deteksi(gambar, waktuMs);
    frame.push({ ...hasil, waktuMs });
    lamaProsesMs.push(lama);
    opsi.saatKemajuan?.(k + 1, total);
  }
  return { frame, lamaProsesMs, lamaTotalMs: performance.now() - awal };
}
