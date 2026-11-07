import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { gambarStickman, type WarnaBagian } from "../vision/gambarStickman";
import { PESAN_KAMERA } from "../vision/kamera";
import { ketajaman, rataKecerahan } from "../vision/kecerahan";
import type { OpsiPendeteksi } from "../vision/landmarkers";
import type { HasilDeteksi } from "../vision/types";
import { useKamera } from "../vision/useKamera";
import { useVisi, type StatusVisi } from "../vision/useVisi";

type Props = {
  /**
   * Dipanggil untuk setiap hasil deteksi. Boleh mengembalikan warna per bagian tubuh
   * (hijau/kuning/merah saat latihan); tanpa warna, stickman digambar putih.
   */
  saatHasil?: (hasil: HasilDeteksi, lamaProsesMs: number) => WarnaBagian | void;
  saatStatusVisi?: (status: StatusVisi) => void;
  /**
   * Sekali per detik: rata-rata kecerahan kamera (0–255) untuk saran "tambah cahaya", dan ketajaman
   * (null bila gambar terlalu rata untuk dinilai) untuk saran "gambar buram".
   */
  saatKecerahan?: (nilai: number, tajam: number | null) => void;
  /** Pilihan pendeteksi (mis. mode cepat); kosong = bawaan config. */
  opsiVisi?: OpsiPendeteksi;
  /** Lapisan di atas kamera (skor, petunjuk). */
  children?: ReactNode;
  className?: string;
};

// Pencerminan hanya di tampilan; data titik tetap anatomis (docs/04 bagian 3).
const CERMIN = { transform: "scaleX(-1)" } as const;

/**
 * Lebar gambar untuk mengukur kecerahan dan ketajaman, sekali per detik. 320 px cukup untuk membedakan
 * gambar tajam dan buram (docs/09 bagian 12); tingginya mengikuti rasio kamera.
 */
const LEBAR_SAMPEL = 320;

function pesanStatus(kamera: ReturnType<typeof useKamera>, visi: StatusVisi): string | null {
  if (kamera !== "aktif") return PESAN_KAMERA[kamera];
  if (visi.tahap === "memuat") return "Memuat model AI… (±27 MB, hanya lama saat pertama kali)";
  if (visi.tahap === "galat") return `Model AI gagal dimuat atau berhenti. (${visi.pesan})`;
  return null;
}

export default function KameraView({ saatHasil, saatStatusVisi, saatKecerahan, opsiVisi, children, className = "rounded-xl" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const kanvasRef = useRef<HTMLCanvasElement>(null);
  const [rasio, setRasio] = useState(4 / 3);
  const [percobaan, setPercobaan] = useState(0);
  const statusKamera = useKamera(videoRef);

  const tanganiHasil = useCallback(
    (hasil: HasilDeteksi, lamaProsesMs: number) => {
      const warna = saatHasil?.(hasil, lamaProsesMs);
      const ctx = kanvasRef.current?.getContext("2d");
      if (ctx) gambarStickman(ctx, hasil, warna ?? {});
    },
    [saatHasil],
  );
  const { status: statusVisi, klienRef } = useVisi(tanganiHasil, opsiVisi, percobaan);

  useEffect(() => {
    saatStatusVisi?.(statusVisi);
  }, [statusVisi, saatStatusVisi]);

  // Ukuran kanvas mengikuti ukuran asli video supaya garis tepat di atas tubuh.
  const saatUkuranVideo = () => {
    const video = videoRef.current;
    const kanvas = kanvasRef.current;
    if (!video || !kanvas || video.videoWidth === 0) return;
    kanvas.width = video.videoWidth;
    kanvas.height = video.videoHeight;
    setRasio(video.videoWidth / video.videoHeight);
  };

  // AI: mengirim setiap frame kamera baru ke worker. Frame dilewati bila worker masih sibuk.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || statusKamera !== "aktif" || statusVisi.tahap !== "siap") return;
    let aktif = true;
    let id = 0;
    const pakaiFrameVideo = typeof video.requestVideoFrameCallback === "function";
    const langkah = () => {
      if (!aktif) return;
      void klienRef.current?.kirimFrame(video, performance.now());
      id = pakaiFrameVideo ? video.requestVideoFrameCallback(langkah) : requestAnimationFrame(langkah);
    };
    langkah();
    return () => {
      aktif = false;
      if (pakaiFrameVideo) video.cancelVideoFrameCallback(id);
      else cancelAnimationFrame(id);
    };
  }, [statusKamera, statusVisi.tahap, klienRef]);

  // Kecerahan dan ketajaman: gambar kamera diperkecil lalu diukur, sekali per detik. Tidak ada gambar yang disimpan.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !saatKecerahan || statusKamera !== "aktif") return;
    const kanvas = document.createElement("canvas");
    const ctx = kanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const id = window.setInterval(() => {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) return;
      const tinggi = Math.max(3, Math.round((LEBAR_SAMPEL * video.videoHeight) / video.videoWidth));
      if (kanvas.width !== LEBAR_SAMPEL || kanvas.height !== tinggi) {
        kanvas.width = LEBAR_SAMPEL;
        kanvas.height = tinggi;
      }
      ctx.drawImage(video, 0, 0, LEBAR_SAMPEL, tinggi);
      const data = ctx.getImageData(0, 0, LEBAR_SAMPEL, tinggi).data;
      const nilai = rataKecerahan(data);
      if (nilai !== null) saatKecerahan(nilai, ketajaman(data, LEBAR_SAMPEL, tinggi));
    }, 1000);
    return () => window.clearInterval(id);
  }, [statusKamera, saatKecerahan]);

  const pesan = pesanStatus(statusKamera, statusVisi);

  return (
    <div className={`relative w-full overflow-hidden bg-stone-900 ${className}`} style={{ aspectRatio: rasio }}>
      <video
        ref={videoRef}
        onLoadedMetadata={saatUkuranVideo}
        onResize={saatUkuranVideo}
        className="h-full w-full"
        style={CERMIN}
        playsInline
        muted
        aria-label="Kamera Anda, ditampilkan seperti cermin"
      />
      <canvas ref={kanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" style={CERMIN} aria-hidden="true" />
      {children}
      {pesan && (
        <div role="status" className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 bg-stone-900/85 px-4 py-3 text-sm text-white">
          <span>{pesan}</span>
          {statusVisi.tahap === "galat" && statusKamera === "aktif" && (
            <button type="button" onClick={() => setPercobaan((p) => p + 1)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-tinta hover:bg-pasir">
              Coba lagi
            </button>
          )}
        </div>
      )}
    </div>
  );
}
