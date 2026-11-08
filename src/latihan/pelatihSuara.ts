// Pelatih suara: petunjuk diucapkan dengan Web Speech API (speechSynthesis) bawaan peramban, karena
// murid berdiri 2–3 meter dari layar. Tanpa server dan tanpa kunci API. Hanya aktif bila peramban
// punya suara berbahasa Indonesia; suara bahasa lain membaca kalimat Indonesia dengan salah.
import { useCallback, useEffect, useRef, useState } from "react";

type SuaraRingkas = Pick<SpeechSynthesisVoice, "lang" | "localService">;

/** Suara berbahasa Indonesia; suara lokal (tanpa internet) didahulukan. */
export function pilihSuaraIndonesia<T extends SuaraRingkas>(daftar: readonly T[]): T | null {
  const indonesia = daftar.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith("id"));
  return indonesia.find((v) => v.localService) ?? indonesia[0] ?? null;
}

const adaSintesis = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

export type OpsiUcap = {
  /** Potong ucapan yang sedang berjalan (mis. hitung mundur). Tanpa ini, ucapan baru dilewati bila masih bicara. */
  sela?: boolean;
  saatMulai?: () => void;
  saatSelesai?: () => void;
};

export function usePelatihSuara(aktif: boolean) {
  const [suara, setSuara] = useState<SpeechSynthesisVoice | null>(null);
  const aktifRef = useRef(aktif);
  useEffect(() => {
    aktifRef.current = aktif;
  }, [aktif]);

  useEffect(() => {
    if (!adaSintesis()) return;
    const muat = () => setSuara(pilihSuaraIndonesia(window.speechSynthesis.getVoices()));
    muat();
    window.speechSynthesis.addEventListener("voiceschanged", muat);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", muat);
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (!aktif && adaSintesis()) window.speechSynthesis.cancel();
  }, [aktif]);

  // Safari di iPhone baru mengizinkan suara sesudah ada sentuhan di halaman. Sentuhan atau tombol pertama
  // dipakai untuk "membuka" suara dengan ucapan kosong tanpa volume, supaya petunjuk berikutnya terdengar,
  // termasuk bila latihan dimulai dengan gestur (tanpa menyentuh layar).
  useEffect(() => {
    if (!adaSintesis()) return;
    const buka = () => {
      window.removeEventListener("pointerdown", buka);
      window.removeEventListener("keydown", buka);
      const kosong = new SpeechSynthesisUtterance(" ");
      kosong.volume = 0;
      window.speechSynthesis.speak(kosong);
    };
    window.addEventListener("pointerdown", buka);
    window.addEventListener("keydown", buka);
    return () => {
      window.removeEventListener("pointerdown", buka);
      window.removeEventListener("keydown", buka);
    };
  }, []);

  const ucapkan = useCallback(
    (teks: string, opsi: OpsiUcap = {}) => {
      if (!aktifRef.current || !suara || !adaSintesis()) return false;
      const sintesis = window.speechSynthesis;
      if (sintesis.speaking && !opsi.sela) return false;
      if (opsi.sela) sintesis.cancel();
      const ucapan = new SpeechSynthesisUtterance(teks);
      ucapan.voice = suara;
      ucapan.lang = suara.lang;
      ucapan.rate = 1.05;
      if (opsi.saatMulai) ucapan.onstart = opsi.saatMulai;
      if (opsi.saatSelesai) {
        ucapan.onend = opsi.saatSelesai;
        ucapan.onerror = opsi.saatSelesai;
      }
      sintesis.speak(ucapan);
      return true;
    },
    [suara],
  );

  // Suara daring (mis. "Google Bahasa Indonesia" di Chrome desktop) mengirim kalimat petunjuk ke layanan
  // suara peramban. Isinya hanya kalimat templat, bukan gambar atau data murid, tetapi tetap diberitahukan.
  return { tersedia: suara !== null, namaSuara: suara?.name ?? null, suaraDaring: suara !== null && !suara.localService, ucapkan };
}
