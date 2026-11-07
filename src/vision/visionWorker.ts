// AI: Web Worker yang menjalankan pendeteksi MediaPipe (docs/01 K2, docs/03 bagian D).
// Deteksi berjalan di sini supaya tampilan tidak membeku. Gambar kamera tidak pernah keluar dari
// perangkat; yang dikirim balik ke halaman hanya angka titik dan blendshape.
import { buatPendeteksi, type Pendeteksi } from "./landmarkers";
import type { PesanDariWorker, PesanKeWorker } from "./pesan";

// Tipe minimal konteks worker, supaya tidak perlu mencampur pustaka tipe DOM dan WebWorker.
type KonteksWorker = {
  postMessage(pesan: PesanDariWorker): void;
  onmessage: ((e: MessageEvent<PesanKeWorker>) => void) | null;
};
const konteks = self as unknown as KonteksWorker;

let pendeteksi: Pendeteksi | null = null;
let waktuTerakhirMs = 0; // uji jalan saat memuat memakai cap waktu 0

async function mulai(pesan: Extract<PesanKeWorker, { jenis: "mulai" }>): Promise<void> {
  const mulaiMs = performance.now();
  try {
    pendeteksi = await buatPendeteksi(pesan.jalur, pesan.dasarWasm, pesan.model, pesan.opsi);
    konteks.postMessage({ jenis: "siap", keterangan: pendeteksi.keterangan, lamaMemuatMs: performance.now() - mulaiMs });
  } catch (galat) {
    konteks.postMessage({ jenis: "galat", tahap: "memuat", pesan: String(galat) });
  }
}

function proses(gambar: ImageBitmap, waktuMs: number): void {
  try {
    if (!pendeteksi) return;
    // MediaPipe menolak cap waktu yang tidak naik; jaga supaya selalu bertambah.
    const t = Math.max(waktuMs, waktuTerakhirMs + 1);
    waktuTerakhirMs = t;
    const mulaiMs = performance.now();
    const hasil = pendeteksi.deteksi(gambar, t);
    konteks.postMessage({ jenis: "hasil", hasil, lamaProsesMs: performance.now() - mulaiMs });
  } catch (galat) {
    konteks.postMessage({ jenis: "galat", tahap: "deteksi", pesan: String(galat) });
  } finally {
    gambar.close();
  }
}

konteks.onmessage = (e) => {
  const pesan = e.data;
  if (pesan.jenis === "mulai") void mulai(pesan);
  else proses(pesan.gambar, pesan.waktuMs);
};
