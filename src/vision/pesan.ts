// Bentuk pesan antara halaman dan Web Worker visi (docs/03 bagian D).
import type { AlamatModel, OpsiPendeteksi } from "./landmarkers";
import type { HasilDeteksi, JalurAi } from "./types";

export type PesanKeWorker =
  | { jenis: "mulai"; jalur: JalurAi; dasarWasm: string; model: AlamatModel; opsi?: OpsiPendeteksi }
  | { jenis: "frame"; gambar: ImageBitmap; waktuMs: number };

export type TahapGalat = "memuat" | "deteksi";

export type PesanDariWorker =
  | { jenis: "siap"; keterangan: string; lamaMemuatMs: number }
  | { jenis: "hasil"; hasil: HasilDeteksi; lamaProsesMs: number }
  | { jenis: "galat"; tahap: TahapGalat; pesan: string };
