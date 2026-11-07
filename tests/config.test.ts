import { describe, expect, it } from "vitest";
import {
  AMBANG_WARNA_DERAJAT,
  BOBOT_UNSUR,
  JENDELA_REALTIME_DETIK,
  TAU_UNSUR,
  TOLERANSI_FITUR,
} from "../src/config";
import { DAFTAR_UNSUR } from "../src/scoring/types";

describe("config penilaian", () => {
  it("bobot keempat unsur berjumlah 100%", () => {
    const total = DAFTAR_UNSUR.reduce((jumlah, u) => jumlah + BOBOT_UNSUR[u], 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("setiap unsur punya bobot dan τ positif", () => {
    for (const u of DAFTAR_UNSUR) {
      expect(BOBOT_UNSUR[u]).toBeGreaterThan(0);
      expect(TAU_UNSUR[u]).toBeGreaterThan(0);
    }
  });

  it("ambang warna sama dengan 1× dan 2× toleransi sudut", () => {
    expect(AMBANG_WARNA_DERAJAT.hijau).toBe(TOLERANSI_FITUR.sudutDerajat);
    expect(AMBANG_WARNA_DERAJAT.kuning).toBe(TOLERANSI_FITUR.sudutDerajat * 2);
  });

  it("semua toleransi fitur positif", () => {
    for (const nilai of Object.values(TOLERANSI_FITUR)) {
      expect(nilai).toBeGreaterThan(0);
    }
  });

  it("jendela real-time lebih longgar ke belakang (murid biasanya terlambat)", () => {
    expect(JENDELA_REALTIME_DETIK.mundur).toBeGreaterThan(JENDELA_REALTIME_DETIK.maju);
    expect(JENDELA_REALTIME_DETIK.maju).toBeGreaterThanOrEqual(0);
  });

  it("rumus skor: selisih tepat 1 toleransi memberi skor sekitar 61 (docs/04 bagian 7)", () => {
    const skor = 100 * Math.exp(-1 / TAU_UNSUR.agem);
    expect(skor).toBeCloseTo(60.65, 1);
  });
});
