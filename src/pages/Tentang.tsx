import { keteranganHakCipta, MATERI_CONTOH, SUMBER } from "../katalog/katalog";

// Status fitur ditulis apa adanya: yang sudah berfungsi dan yang belum (panduan lomba hlm. 10).
const SUDAH = [
  "Etalase kelas tari dengan pencarian dan saringan",
  "Latihan berdampingan: video guru di kiri, kamera Anda di kanan",
  "Garis tubuh hijau/kuning/merah, kemiripan 0–100, dan petunjuk perbaikan saat menari",
  "Nilai agem, tandang, tangkis, tangkep setelah tempo diselaraskan (DTW), tiga koreksi utama, dan bagian tersulit",
  "Mode guru: video gerak menjadi data pelajaran (JSON), diproses di perangkat",
  "Riwayat nilai di peramban, bisa dihapus kapan saja",
];

const BELUM = [
  "Video untuk kelas selain Tari Kreasi Janger (sementara memakai video contoh)",
  "Kalimat koreksi oleh model bahasa (LLM); sekarang kalimat disusun dari templat",
  "Kecepatan AI ±5 frame per detik dengan CPU; mode cepat (GPU) masih percobaan",
  "Kalibrasi nilai dengan penari dan guru sungguhan (docs/09)",
];

export default function Tentang() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 pt-8 sm:px-6">
      <header>
        <p className="text-sm font-semibold text-emas">Tentang</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Ngigel: pelatih tari Bali berbasis AI</h1>
        <p className="mt-2 text-stone-700">
          Prototipe untuk AI Web Innovation Challenge, Bali DigiFest 2026, oleh tim Sekaa Kode. Ngigel mengukur kemiripan gerak Anda dengan guru acuan yang
          dipilih, bukan menentukan pakem yang benar.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
          <h2 className="font-extrabold text-hutan">Sudah berfungsi</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-stone-700">
            {SUDAH.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="text-green-700" aria-hidden="true">
                  ✓
                </span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
          <h2 className="font-extrabold text-merah-bata">Belum, atau masih terbatas</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-stone-700">
            {BELUM.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="text-merah-bata" aria-hidden="true">
                  ○
                </span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-extrabold">Cara kerja</h2>
        <p className="text-stone-700">
          AI MediaPipe Holistic di peramban menemukan titik tubuh, jari, dan ekspresi wajah dari kamera Anda. Gerak guru sudah dibaca dengan cara yang sama
          lewat halaman Untuk Guru. Yang dibandingkan adalah sudut sendi 3D dan posisi tangan relatif terhadap panjang badan, sehingga tinggi badan dan jarak
          ke kamera tidak berpengaruh. Kiri dibandingkan dengan kiri: tampilan seperti cermin hanya untuk memudahkan mengikuti.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-extrabold">Privasi</h2>
        <p className="text-stone-700">
          Video kamera Anda diproses di perangkat ini dan tidak dikirim atau disimpan di server. Wajah hanya diproses sesaat untuk membaca lirikan dan senyum.
          Yang disimpan hanya angka nilai dan koreksi, di peramban Anda sendiri, dan bisa dihapus dari halaman Riwayat.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-extrabold">Menghormati budaya</h2>
        <p className="text-stone-700">
          Tari wali (sakral) tidak dimuat. Nama dan pembagian gerak bisa berbeda antarsanggar; deskripsi kelas di etalase mengikuti sumber tertulis di bawah.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold">Kredit</h2>
        <ul className="space-y-2 text-sm text-stone-700">
          <li>
            <strong>Video contoh:</strong> {MATERI_CONTOH.kanal}, &ldquo;{MATERI_CONTOH.judulAsli}&rdquo; ({MATERI_CONTOH.platform}). {keteranganHakCipta(MATERI_CONTOH)}{" "}
            Untuk versi produksi, video ini diganti video yang izinnya sudah ada.
          </li>
          <li>
            <strong>AI:</strong> MediaPipe Tasks Vision dan model Holistic Landmarker (Google, Apache-2.0), dijalankan di perangkat.
          </li>
          <li>
            <strong>Huruf:</strong> Plus Jakarta Sans (Tokotype, SIL Open Font License 1.1), disajikan dari server sendiri.
          </li>
          <li>
            <strong>Gambar penari di etalase:</strong> digambar sendiri dengan SVG, tanpa foto orang.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold">Sumber deskripsi tari</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-stone-700">
          {Object.values(SUMBER).map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold text-merah-bata underline">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="text-xs text-stone-500">Dibaca 3 November 2026. Jurnal IGEL dan Batarirupa adalah sumber utama untuk gerak dasar; sisanya ringkasan umum.</p>
      </section>
    </article>
  );
}
