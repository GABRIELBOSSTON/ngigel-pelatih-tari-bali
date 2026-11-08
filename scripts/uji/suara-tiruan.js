// Mesin suara tiruan untuk menguji pelatih suara (src/latihan/pelatihSuara.ts) secara otomatis.
// Disisipkan sebelum skrip halaman lewat `uji-studio.mjs --sisip scripts/uji/suara-tiruan.js`.
//
// Chrome tanpa layar tidak punya suara berbahasa Indonesia, sehingga pelatih suara tidak aktif di sana.
// Tiruan ini menyediakan satu suara "id-ID" dan mencatat setiap kalimat yang diminta diucapkan ke
// window.__ucapan ({ ms, teks, volume, bahasa, suara }). Lama bicara ditiru sekitar 70 ms per huruf,
// supaya aturan "jangan memotong ucapan yang sedang berjalan" ikut teruji.
// Yang diuji: kalimat apa yang diucapkan dan kapan. Bunyi suara di perangkat sungguhan tidak ikut teruji.
(() => {
  const catatan = [];
  const suara = [{ name: "Suara uji (id-ID)", lang: "id-ID", localService: true, voiceURI: "uji-id", default: true }];

  class Ucapan extends EventTarget {
    constructor(teks = "") {
      super();
      this.text = teks;
      this.lang = "";
      this.voice = null;
      this.volume = 1;
      this.rate = 1;
      this.pitch = 1;
      this.onstart = null;
      this.onend = null;
      this.onerror = null;
    }
  }

  class Sintesis extends EventTarget {
    #antre = [];
    #sedang = null;
    #pewaktu = 0;
    get speaking() {
      return this.#sedang !== null;
    }
    get pending() {
      return this.#antre.length > 0;
    }
    get paused() {
      return false;
    }
    getVoices() {
      return suara;
    }
    speak(u) {
      catatan.push({ ms: Math.round(performance.now()), teks: u.text, volume: u.volume, bahasa: u.lang, suara: u.voice?.name ?? null });
      this.#antre.push(u);
      if (this.#sedang === null) this.#lanjut();
    }
    #lanjut() {
      const u = this.#antre.shift();
      if (!u) {
        this.#sedang = null;
        return;
      }
      this.#sedang = u;
      u.onstart?.({ type: "start" });
      const lama = Math.max(300, (u.text.trim().length * 70) / (u.rate || 1));
      this.#pewaktu = setTimeout(() => {
        this.#sedang = null;
        u.onend?.({ type: "end" });
        this.#lanjut();
      }, lama);
    }
    cancel() {
      clearTimeout(this.#pewaktu);
      const semua = [this.#sedang, ...this.#antre].filter(Boolean);
      this.#sedang = null;
      this.#antre = [];
      for (const u of semua) u.onerror?.({ type: "error", error: "interrupted" });
    }
    pause() {}
    resume() {}
  }

  Object.defineProperty(window, "speechSynthesis", { value: new Sintesis(), configurable: true });
  window.SpeechSynthesisUtterance = Ucapan;
  window.__ucapan = catatan;
})();
