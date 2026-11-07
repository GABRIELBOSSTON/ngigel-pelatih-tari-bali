import { HolisticLandmarker } from "@mediapipe/tasks-vision";
import { describe, expect, it } from "vitest";
import { JARI, JUMLAH_TITIK_TANGAN, SAMBUNGAN_TANGAN } from "../src/vision/handIndex";
import { BAGIAN_TUBUH, JUMLAH_TITIK_POSE, POSE } from "../src/vision/poseIndex";

// Peta titik kita harus cocok dengan konstanta resmi MediaPipe yang terpasang,
// supaya stickman dan fitur tidak membaca titik yang salah.
const kunci = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

describe("peta titik tubuh (pose)", () => {
  it("33 nama titik bernomor 0–32 tanpa duplikat", () => {
    const nomor = Object.values(POSE);
    expect(nomor).toHaveLength(JUMLAH_TITIK_POSE);
    expect(new Set(nomor).size).toBe(JUMLAH_TITIK_POSE);
    expect(Math.min(...nomor)).toBe(0);
    expect(Math.max(...nomor)).toBe(JUMLAH_TITIK_POSE - 1);
  });

  it("titik kiri bernomor ganjil dan kanan genap untuk bahu sampai ujung kaki (konvensi MediaPipe)", () => {
    expect(POSE.BAHU_KIRI % 2).toBe(1);
    expect(POSE.BAHU_KANAN % 2).toBe(0);
    expect(POSE.LUTUT_KIRI % 2).toBe(1);
    expect(POSE.UJUNG_KAKI_KANAN % 2).toBe(0);
  });

  it("setiap garis bagian tubuh ada di POSE_CONNECTIONS resmi", () => {
    const resmi = new Set(HolisticLandmarker.POSE_CONNECTIONS.map((c) => kunci(c.start, c.end)));
    for (const garis of Object.values(BAGIAN_TUBUH).flat()) {
      expect(resmi.has(kunci(garis[0], garis[1]))).toBe(true);
    }
  });
});

describe("peta titik tangan", () => {
  it("lima jari × 4 titik + pergelangan = 21 titik unik", () => {
    const semua = [0, ...Object.values(JARI).flat()];
    expect(new Set(semua).size).toBe(JUMLAH_TITIK_TANGAN);
  });

  it("SAMBUNGAN_TANGAN sama persis dengan HAND_CONNECTIONS resmi", () => {
    const resmi = new Set(HolisticLandmarker.HAND_CONNECTIONS.map((c) => kunci(c.start, c.end)));
    const milikKita = new Set(SAMBUNGAN_TANGAN.map(([a, b]) => kunci(a, b)));
    expect(milikKita).toEqual(resmi);
  });
});
