// Jembatan halaman ↔ Web Worker visi (docs/03 bagian D).
// Dua cara pakai: kirimFrame() untuk kamera real-time (frame dilewati bila worker sibuk), dan
// deteksi() yang menunggu hasil satu gambar, untuk mengekstrak video guru frame demi frame.
import { ASET_AI } from "../config";
import type { AlamatModel, OpsiPendeteksi } from "./landmarkers";
import type { PesanDariWorker, PesanKeWorker, TahapGalat } from "./pesan";
import type { HasilDeteksi, JalurAi } from "./types";

export type PendengarVisi = {
  saatSiap(keterangan: string): void;
  saatHasil(hasil: HasilDeteksi, lamaProsesMs: number): void;
  saatGalat(tahap: TahapGalat, pesan: string): void;
};

export type HasilSatuGambar = { hasil: HasilDeteksi; lamaProsesMs: number };

/** Alamat absolut aset AI di server sendiri; worker tidak bisa memakai alamat relatif halaman. */
export function alamatAsetAi(): { dasarWasm: string; model: AlamatModel } {
  const dasar = new URL(import.meta.env.BASE_URL, window.location.href);
  const alamat = (jalur: string) => new URL(jalur, dasar).href;
  return {
    dasarWasm: alamat(ASET_AI.folderWasm),
    model: {
      holistic: alamat(ASET_AI.model),
      pose: alamat(ASET_AI.modelPose),
      tangan: alamat(ASET_AI.modelTangan),
      wajah: alamat(ASET_AI.modelWajah),
    },
  };
}

let sudahPrefetch = false;

/**
 * Mengunduh model Holistic dan WASM modul lebih dulu ke cache HTTP peramban (±27 MB), mis. saat murid
 * mengarahkan kursor ke kelas, supaya studio lebih cepat siap. Tidak dijalankan bila mode hemat data
 * aktif atau koneksi lebih lambat dari 4G. Worker kemudian meminta alamat yang sama.
 */
export function prefetchAsetAi(): void {
  if (sudahPrefetch || typeof navigator === "undefined") return;
  const koneksi = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (koneksi?.saveData || (koneksi?.effectiveType !== undefined && koneksi.effectiveType !== "4g")) return;
  sudahPrefetch = true;
  const { dasarWasm, model } = alamatAsetAi();
  // Nama berkas sesuai FilesetResolver.forVisionTasks(…, true) di landmarkers.ts (pemuat versi modul).
  for (const url of [model.holistic, `${dasarWasm}/vision_wasm_module_internal.js`, `${dasarWasm}/vision_wasm_module_internal.wasm`]) {
    void fetch(url, { priority: "low" }).catch(() => {});
  }
}

const PENDENGAR_KOSONG: PendengarVisi = { saatSiap: () => {}, saatHasil: () => {}, saatGalat: () => {} };

export class KlienVisi {
  private readonly worker: Worker;
  private readonly pendengar: PendengarVisi;
  private siap = false;
  // Hanya satu gambar diproses sekaligus. Frame kamera yang datang saat worker sibuk dilewati,
  // supaya antrean tidak menumpuk dan stickman tidak semakin tertinggal.
  private sibuk = false;
  private menunggu: { terima: (h: HasilSatuGambar) => void; tolak: (g: Error) => void } | null = null;
  private readonly siapJanji: Promise<{ keterangan: string; lamaMemuatMs: number }>;
  private selesaiSiap: (v: { keterangan: string; lamaMemuatMs: number }) => void = () => {};
  private gagalSiap: (g: Error) => void = () => {};

  constructor(pendengar: PendengarVisi = PENDENGAR_KOSONG) {
    this.pendengar = pendengar;
    this.siapJanji = new Promise((terima, tolak) => {
      this.selesaiSiap = terima;
      this.gagalSiap = tolak;
    });
    this.siapJanji.catch(() => {}); // galat juga dilaporkan lewat pendengar
    this.worker = new Worker(new URL("./visionWorker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent<PesanDariWorker>) => this.terima(e.data);
    this.worker.onerror = (e) => this.galatMemuat(e.message || "Worker AI gagal dijalankan.");
  }

  mulai(jalur: JalurAi = "holistic", opsi?: OpsiPendeteksi): Promise<{ keterangan: string; lamaMemuatMs: number }> {
    const { dasarWasm, model } = alamatAsetAi();
    this.kirim({ jenis: "mulai", jalur, dasarWasm, model, ...(opsi ? { opsi } : {}) });
    return this.siapJanji;
  }

  async kirimFrame(sumber: HTMLVideoElement, waktuMs: number): Promise<void> {
    if (!this.siap || this.sibuk || sumber.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    this.sibuk = true;
    try {
      const gambar = await createImageBitmap(sumber);
      this.kirim({ jenis: "frame", gambar, waktuMs }, [gambar]);
    } catch {
      this.sibuk = false; // frame ini dilewati, misalnya karena video sedang berganti ukuran
    }
  }

  /** Mendeteksi satu gambar dan menunggu hasilnya. Gambar dipindahkan ke worker (tidak bisa dipakai lagi). */
  deteksi(gambar: ImageBitmap, waktuMs: number): Promise<HasilSatuGambar> {
    if (!this.siap || this.sibuk) return Promise.reject(new Error("Worker AI belum siap atau masih sibuk."));
    this.sibuk = true;
    return new Promise((terima, tolak) => {
      this.menunggu = { terima, tolak };
      this.kirim({ jenis: "frame", gambar, waktuMs }, [gambar]);
    });
  }

  tutup(): void {
    this.siap = false;
    this.worker.terminate();
    this.menunggu?.tolak(new Error("Worker AI ditutup."));
    this.menunggu = null;
  }

  private galatMemuat(pesan: string): void {
    this.gagalSiap(new Error(pesan));
    this.pendengar.saatGalat("memuat", pesan);
  }

  private terima(pesan: PesanDariWorker): void {
    if (pesan.jenis === "siap") {
      this.siap = true;
      this.selesaiSiap({ keterangan: pesan.keterangan, lamaMemuatMs: pesan.lamaMemuatMs });
      this.pendengar.saatSiap(pesan.keterangan);
      return;
    }
    if (pesan.jenis === "galat" && pesan.tahap === "memuat") {
      this.galatMemuat(pesan.pesan);
      return;
    }
    this.sibuk = false;
    const menunggu = this.menunggu;
    this.menunggu = null;
    if (pesan.jenis === "hasil") {
      if (menunggu) menunggu.terima({ hasil: pesan.hasil, lamaProsesMs: pesan.lamaProsesMs });
      else this.pendengar.saatHasil(pesan.hasil, pesan.lamaProsesMs);
    } else if (menunggu) {
      menunggu.tolak(new Error(pesan.pesan));
    } else {
      this.pendengar.saatGalat(pesan.tahap, pesan.pesan);
    }
  }

  private kirim(pesan: PesanKeWorker, pindahkan: Transferable[] = []): void {
    this.worker.postMessage(pesan, pindahkan);
  }
}
