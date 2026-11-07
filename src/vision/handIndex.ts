// Nomor 21 titik tangan MediaPipe (Hand Landmarker dan bagian tangan Holistic Landmarker).

export const JUMLAH_TITIK_TANGAN = 21;

export const PERGELANGAN_TANGAN = 0;

/** Titik tiap jari dari pangkal ke ujung. */
export const JARI = {
  jempol: [1, 2, 3, 4],
  telunjuk: [5, 6, 7, 8],
  tengah: [9, 10, 11, 12],
  manis: [13, 14, 15, 16],
  kelingking: [17, 18, 19, 20],
} as const;

export type NamaJari = keyof typeof JARI;

/**
 * Pasangan titik yang disambung garis saat menggambar tangan.
 * Sama dengan HAND_CONNECTIONS resmi MediaPipe (21 sambungan): pergelangan hanya tersambung
 * ke pangkal jempol (1), telunjuk (5), dan kelingking (17); pangkal jari tengah dan manis
 * tersambung lewat telapak (5–9, 9–13, 13–17). Diuji di tests/indeksTitik.test.ts.
 */
export const SAMBUNGAN_TANGAN: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];
