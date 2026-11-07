// Menyalakan worker visi selama komponen terpasang, lalu menutupnya (aman untuk StrictMode).
import { useEffect, useRef, useState } from "react";
import { BATAS_GAGAL_DETEKSI } from "../config";
import type { OpsiPendeteksi } from "./landmarkers";
import type { HasilDeteksi } from "./types";
import { KlienVisi } from "./visionClient";

export type StatusVisi =
  | { tahap: "memuat" }
  | { tahap: "siap"; keterangan: string }
  | { tahap: "galat"; pesan: string };

export type PenerimaHasil = (hasil: HasilDeteksi, lamaProsesMs: number) => void;

/**
 * `opsi` kosong = pengaturan bawaan config (Holistic CPU dengan blendshape). Bila delegasi atau
 * blendshape berubah, worker lama ditutup dan worker baru dimuat (mis. tombol "mode cepat").
 * `percobaan` dinaikkan untuk memuat ulang worker setelah galat (tombol "Coba lagi").
 */
export function useVisi(saatHasil: PenerimaHasil, opsi: OpsiPendeteksi = {}, percobaan = 0) {
  const [status, setStatus] = useState<StatusVisi>({ tahap: "memuat" });
  const klienRef = useRef<KlienVisi | null>(null);
  // Penerima terbaru disimpan di ref supaya worker tidak dibuat ulang setiap render.
  const saatHasilRef = useRef(saatHasil);
  useEffect(() => {
    saatHasilRef.current = saatHasil;
  }, [saatHasil]);
  const { delegasi, blendshape } = opsi;

  useEffect(() => {
    setStatus({ tahap: "memuat" });
    // Satu frame gagal masih wajar; gagal berturut-turut berarti AI rusak dan harus terlihat pengguna.
    let gagalBeruntun = 0;
    const klien = new KlienVisi({
      saatSiap: (keterangan) => setStatus({ tahap: "siap", keterangan }),
      saatHasil: (hasil, lama) => {
        gagalBeruntun = 0;
        saatHasilRef.current(hasil, lama);
      },
      saatGalat: (tahap, pesan) => {
        if (tahap === "memuat") {
          setStatus({ tahap: "galat", pesan });
          return;
        }
        gagalBeruntun += 1;
        if (gagalBeruntun === 1) console.warn("Deteksi satu frame gagal:", pesan);
        if (gagalBeruntun === BATAS_GAGAL_DETEKSI) {
          setStatus({ tahap: "galat", pesan: `deteksi gagal ${BATAS_GAGAL_DETEKSI}× berturut-turut: ${pesan.slice(0, 160)}` });
          klien.tutup();
        }
      },
    });
    klienRef.current = klien;
    const pilihan: OpsiPendeteksi = {
      ...(delegasi ? { delegasi } : {}),
      ...(blendshape !== undefined ? { blendshape } : {}),
    };
    void klien.mulai("holistic", Object.keys(pilihan).length > 0 ? pilihan : undefined);
    return () => {
      klien.tutup();
      klienRef.current = null;
    };
  }, [delegasi, blendshape, percobaan]);

  return { status, klienRef };
}
