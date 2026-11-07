// Membagikan hasil latihan tanpa server (mis. murid → guru). Sesi dikompres (deflate) lalu dikodekan
// base64url di bagian "#" tautan. Peramban tidak pernah mengirim bagian "#" ke server mana pun, dan
// isinya hanya angka hasil: tanpa video, gambar, titik tubuh, atau titik wajah (docs/05 bagian 5).
import { SesiSchema, type SesiTersimpan } from "./riwayat";

/** Awalan versi format, supaya tautan lama tetap bisa dikenali bila formatnya berubah. */
const VERSI = "1.";

function keBase64Url(byte: Uint8Array): string {
  let biner = "";
  for (let i = 0; i < byte.length; i += 0x8000) biner += String.fromCharCode(...byte.subarray(i, i + 0x8000));
  return btoa(biner).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function dariBase64Url(teks: string): Uint8Array<ArrayBuffer> {
  const biner = atob(teks.replace(/-/g, "+").replace(/_/g, "/"));
  const byte = new Uint8Array(new ArrayBuffer(biner.length));
  for (let i = 0; i < biner.length; i++) byte[i] = biner.charCodeAt(i);
  return byte;
}

async function alirkan(data: Blob, ubah: CompressionStream | DecompressionStream): Promise<ArrayBuffer> {
  return new Response(data.stream().pipeThrough(ubah)).arrayBuffer();
}

export async function kodekanSesi(sesi: SesiTersimpan): Promise<string> {
  const padat = await alirkan(new Blob([JSON.stringify(sesi)]), new CompressionStream("deflate-raw"));
  return VERSI + keBase64Url(new Uint8Array(padat));
}

/** Sesi dari kode tautan; null bila kode rusak, versinya tidak dikenal, atau isinya tidak lolos skema. */
export async function bacaKodeSesi(kode: string): Promise<SesiTersimpan | null> {
  if (!kode.startsWith(VERSI)) return null;
  try {
    const byte = dariBase64Url(kode.slice(VERSI.length));
    const teks = new TextDecoder().decode(await alirkan(new Blob([byte]), new DecompressionStream("deflate-raw")));
    const hasil = SesiSchema.safeParse(JSON.parse(teks));
    return hasil.success ? hasil.data : null;
  } catch {
    return null;
  }
}

/** Tautan lengkap ke halaman hasil yang dibagikan. */
export function tautanBagikan(asal: string, dasar: string, kode: string): string {
  return `${asal}${dasar}hasil/bagikan#d=${kode}`;
}
