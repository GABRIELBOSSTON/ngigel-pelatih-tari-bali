// Menyalakan webcam selama komponen terpasang. Aman untuk React StrictMode: efek yang dijalankan
// dua kali saat pengembangan selalu mematikan kameranya kembali (docs/08 bagian 4 butir 9).
import { useEffect, useState, type RefObject } from "react";
import { KAMERA } from "../config";
import { jenisGalatKamera, type StatusKamera } from "./kamera";

// navigator.mediaDevices tidak ada di halaman yang tidak aman (http selain localhost),
// walaupun tipe TypeScript menganggapnya selalu ada.
const kameraTersedia = () =>
  typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";

export function useKamera(videoRef: RefObject<HTMLVideoElement | null>): StatusKamera {
  const [status, setStatus] = useState<StatusKamera>(() => (kameraTersedia() ? "meminta" : "tidak-aman"));

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !kameraTersedia()) return;
    let batal = false;
    let aliran: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "user", width: { ideal: KAMERA.lebarIdeal }, height: { ideal: KAMERA.tinggiIdeal } },
        audio: false,
      })
      .then(async (s) => {
        aliran = s;
        if (batal) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = s;
        await video.play();
        if (!batal) setStatus("aktif");
      })
      .catch((galat: unknown) => {
        if (!batal) setStatus(jenisGalatKamera(galat));
      });

    return () => {
      batal = true;
      aliran?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }, [videoRef]);

  return status;
}
