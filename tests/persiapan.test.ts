import { describe, expect, it } from "vitest";
import { KUALITAS } from "../src/config";
import { LANGKAH_SIAP, langkahPersiapan, perluDiucapkan, type KeadaanPersiapan } from "../src/latihan/persiapan";

const siap: KeadaanPersiapan = { adaOrang: true, tubuh: true, ukuranTubuh: 0.7, gelap: false, buram: false };
const jeda = { gantiMs: 4000, ulangMs: 15000 };

describe("langkahPersiapan", () => {
  it("meminta murid berdiri di depan kamera bila belum ada orang", () => {
    expect(langkahPersiapan({ ...siap, adaOrang: false, tubuh: false }).teks).toContain("Berdiri di depan kamera");
  });

  it("meminta mundur bila tubuh belum utuh", () => {
    expect(langkahPersiapan({ ...siap, tubuh: false })).toMatchObject({ teks: "Mundur sampai kepala dan kaki terlihat", siap: false });
  });

  it("meminta maju bila tubuh terlalu kecil", () => {
    expect(langkahPersiapan({ ...siap, ukuranTubuh: KUALITAS.tubuhMin - 0.05 }).teks).toBe("Maju 1–2 langkah");
  });

  it("mendahulukan jarak sebelum cahaya dan lensa", () => {
    expect(langkahPersiapan({ ...siap, ukuranTubuh: 0.2, gelap: true, buram: true }).teks).toBe("Maju 1–2 langkah");
    expect(langkahPersiapan({ ...siap, gelap: true, buram: true }).teks).toBe("Tambah cahaya dari depan");
    expect(langkahPersiapan({ ...siap, buram: true }).teks).toBe("Bersihkan lensa kamera");
  });

  it("meminta gestur mulai bila semua syarat terpenuhi, termasuk ukuran yang belum terukur", () => {
    expect(langkahPersiapan(siap)).toMatchObject({ teks: LANGKAH_SIAP, siap: true, ikon: "🙌" });
    expect(langkahPersiapan({ ...siap, ukuranTubuh: null }).siap).toBe(true);
  });
});

describe("perluDiucapkan", () => {
  const langkah = { teks: LANGKAH_SIAP, siap: true, ikon: "🙌" };

  it("tidak berbicara bila tidak ada orang di depan kamera", () => {
    expect(perluDiucapkan(langkah, false, { teks: "", waktu: 0 }, 60000, jeda)).toBe(false);
  });

  it("mengucapkan perintah baru sesudah jeda ganti", () => {
    expect(perluDiucapkan(langkah, true, { teks: "Maju 1–2 langkah", waktu: 10000 }, 12000, jeda)).toBe(false);
    expect(perluDiucapkan(langkah, true, { teks: "Maju 1–2 langkah", waktu: 10000 }, 14000, jeda)).toBe(true);
  });

  it("mengulang perintah yang sama hanya sesudah jeda ulang", () => {
    expect(perluDiucapkan(langkah, true, { teks: LANGKAH_SIAP, waktu: 10000 }, 20000, jeda)).toBe(false);
    expect(perluDiucapkan(langkah, true, { teks: LANGKAH_SIAP, waktu: 10000 }, 25000, jeda)).toBe(true);
  });
});
