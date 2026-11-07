import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import IlustrasiPose from "../katalog/IlustrasiPose";
import KartuKelas from "../katalog/KartuKelas";
import { DAFTAR_KELAS, KATEGORI, keteranganHakCipta, MATERI_CONTOH, saringKelas, type IdKategori, type IdPose, type KelasTari } from "../katalog/katalog";
import { bacaRiwayat } from "../latihan/riwayat";
import CincinSkor from "../latihan/CincinSkor";
import { prefetchAsetAi } from "../vision/visionClient";

// Arti unsur mengikuti Parasari dkk. (2023), IGEL 3(2), yang mengutip Kaler (docs/04 bagian 1).
const UNSUR: ReadonlyArray<{ nama: string; arti: string; isi: string; pose: IdPose; latar: string }> = [
  { nama: "Agem", arti: "Sikap pokok", pose: "agem", latar: "bg-kat-dasar", isi: "Sikap pokok yang menunjukkan ciri khas tarian. AI menilai tekukan lutut, kemiringan badan, tinggi lengan, dan bentuk jari." },
  { nama: "Tandang", arti: "Perpindahan", pose: "ngumbang", latar: "bg-kat-penyambutan", isi: "Perpindahan gerak mengikuti pola lantai. AI menilai langkah ke samping, arah hadap, dan tekukan lutut saat berpindah." },
  { nama: "Tangkis", arti: "Peralihan", pose: "nerudut", latar: "bg-kat-kreasi", isi: "Proses dari satu posisi ke posisi lain dengan gerak tangan. AI menilai siku, bahu, tinggi tangan, dan jari." },
  { nama: "Tangkep", arti: "Ekspresi", pose: "seledet", latar: "bg-kat-ekspresi", isi: "Ekspresi muka: seledet (lirikan mata), arah kepala, dan senyum, dibaca dari kamera di perangkat Anda." },
];

const LANGKAH = [
  { judul: "Pilih kelas", isi: "Pilih tarian atau gerak dasar di etalase, lalu izinkan kamera. Semua diproses di perangkat Anda." },
  { judul: "Menari bersama guru", isi: "Video guru di kiri, Anda di kanan. Garis tubuh berwarna hijau, kuning, atau merah, disertai petunjuk seperti “angkat lengan kanan”." },
  { judul: "Nilai dan koreksi", isi: "Selesai menari, AI menilai empat unsur, menunjukkan bagian tersulit, dan menyarankan bagian yang perlu dilatih ulang." },
] as const;

const POSE_KATEGORI: Record<IdKategori | "semua", IdPose> = {
  semua: "agem",
  kreasi: "janger",
  penyambutan: "bokor",
  klasik: "prajurit",
  dasar: "seledet",
};

function Hero() {
  return (
    <section className="latar-hero relative overflow-hidden rounded-[28px] px-6 py-10 text-white sm:px-10 lg:px-14 lg:py-14">
      {/* Hiasan patra: lengkung-lengkung bertingkat seperti ukiran Bali. */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-60" viewBox="0 0 900 420" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
        <path d="M380 -40 C420 90 320 220 450 440 L920 440 L920 -40 Z" fill="#650f11" />
        <path d="M520 440 C500 320 590 240 640 120 C680 40 780 90 730 190 C700 250 640 300 620 440 Z" fill="#560c0e" />
        <g stroke="#93201f" strokeWidth="10" strokeLinecap="round">
          <path d="M620 400 C600 330 660 300 700 320 C735 338 720 380 690 372" />
          <path d="M800 60 C760 90 770 150 820 150 C850 150 855 115 830 110" />
        </g>
      </svg>
      <div className="relative z-10 grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="animate-muncul">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-merah-pil py-1.5 pl-1.5 pr-4 text-xs font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-merah-tua" aria-hidden="true">
              ✦
            </span>
            AI menilai empat unsur tari Bali, langsung di perangkat Anda
          </p>
          <h1 className="text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl">
            Berlatih tari Bali di rumah, <span className="text-prada">dikoreksi seperti di sanggar.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
            Pilih kelas, menari bersama video guru, dan lihat garis tubuh Anda berubah hijau saat gerakannya mirip. Selesai menari, Ngigel memberi nilai agem,
            tandang, tangkis, dan tangkep beserta koreksinya.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              to="/latihan/tari-kreasi-janger"
              className="inline-flex items-center gap-2 rounded-xl bg-kunyit px-5 py-3 text-sm font-bold text-white shadow-lg shadow-black/20 transition hover:bg-kunyit-gelap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Mulai menari <span aria-hidden="true">→</span>
            </Link>
            <a href="#cara-kerja" className="rounded-xl px-5 py-3 text-sm font-bold text-white ring-1 ring-white/40 transition hover:bg-white/10">
              Cara kerjanya
            </a>
          </div>
          <dl className="mt-8 grid max-w-md grid-cols-3 gap-4 border-t border-white/15 pt-5">
            {[
              [String(DAFTAR_KELAS.length), "kelas di etalase"],
              ["4", "unsur dinilai"],
              ["0", "video dikirim ke server"],
            ].map(([angka, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd className="text-2xl font-extrabold text-prada">{angka}</dd>
                <dd className="text-xs text-white/75">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <IlustrasiHero />
      </div>
    </section>
  );
}

/** Pratinjau layar latihan: penari stickman dengan warna umpan balik dan kartu petunjuk (ilustrasi). */
function IlustrasiHero() {
  return (
    <div className="relative mx-auto w-full max-w-sm animate-muncul" aria-hidden="true">
      <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-gradient-to-b from-stone-800 to-stone-950 ring-1 ring-white/10">
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-merah-tua/40 to-transparent" />
        {/* Sudut bingkai pemindai */}
        {["left-4 top-4 border-l-2 border-t-2", "right-4 top-4 border-r-2 border-t-2", "bottom-4 left-4 border-b-2 border-l-2", "bottom-4 right-4 border-b-2 border-r-2"].map((k) => (
          <span key={k} className={`absolute h-6 w-6 rounded-sm border-prada/80 ${k}`} />
        ))}
        <IlustrasiPose
          pose="agem"
          kamen={false}
          warna="#e7e5e4"
          tebal={3.6}
          warnaBagian={{ lenganA: "#22c55e", lenganB: "#22c55e", tungkaiA: "#22c55e", tungkaiB: "#facc15", badan: "#22c55e" }}
          className="absolute inset-x-0 bottom-4 mx-auto h-[62%]"
        />
        <span className="absolute left-4 top-12 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white">ANDA</span>
      </div>
      {/* Kartu melayang ditaruh di ruang kosong di atas penari supaya tidak menutupi kepala atau lengan. */}
      <div className="absolute -right-6 top-8 flex items-center gap-3 rounded-2xl bg-white p-3 pr-4 text-tinta shadow-2xl sm:-right-10">
        <CincinSkor skor={86} ukuran={44} tebal={5} />
        <div>
          <p className="text-[11px] font-semibold text-stone-500">Kemiripan</p>
          <p className="text-sm font-extrabold">Bagus, pertahankan</p>
        </div>
      </div>
      <div className="absolute -left-6 top-28 max-w-[190px] rounded-2xl bg-white p-3 text-tinta shadow-2xl sm:-left-10">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-500">
          <span className="h-2 w-2 rounded-full bg-yellow-400" /> Petunjuk
        </p>
        <p className="text-sm font-bold leading-snug">Tekuk lutut kanan lebih dalam</p>
      </div>
      <div className="absolute -bottom-4 left-6 rounded-full bg-hutan px-3.5 py-1.5 text-xs font-bold text-white shadow-xl">Seledet terbaca ✓</div>
    </div>
  );
}

function KartuKategori({ id, nama, ringkas, latar, jumlah, aktif, pilih }: { id: IdKategori | "semua"; nama: string; ringkas: string; latar: string; jumlah: number; aktif: boolean; pilih: () => void }) {
  return (
    <button
      type="button"
      onClick={pilih}
      aria-pressed={aktif}
      className={`group relative flex min-h-[150px] flex-col overflow-hidden rounded-2xl p-4 text-left text-white transition duration-200 hover:-translate-y-1 ${latar} ${aktif ? "ring-4 ring-prada ring-offset-2 ring-offset-krem" : ""}`}
    >
      <span className="kubah" />
      <span className="relative z-10 text-base font-extrabold leading-tight">{nama}</span>
      <span className="relative z-10 mt-1 text-xs text-white/85">{ringkas}</span>
      <span className="relative z-10 mt-auto inline-flex w-fit rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-semibold">{jumlah} kelas</span>
      <IlustrasiPose pose={POSE_KATEGORI[id]} sendi={false} className="absolute -bottom-2 -right-3 h-24 opacity-90 transition duration-300 group-hover:scale-110" />
    </button>
  );
}

function LanjutkanLatihan() {
  const [riwayat] = useState(() => bacaRiwayat().slice(0, 6));
  if (riwayat.length === 0) return null;
  return (
    <section aria-labelledby="judul-lanjutkan">
      <div className="mb-4 flex items-end justify-between">
        <h2 id="judul-lanjutkan" className="text-xl font-extrabold sm:text-2xl">
          Lanjutkan latihan
        </h2>
        <Link to="/riwayat" className="text-sm font-bold text-kunyit hover:underline">
          Semua riwayat
        </Link>
      </div>
      <ul className="tanpa-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {riwayat.map((s) => (
          <li key={s.id} className="snap-start">
            <Link to={`/hasil/${s.id}`} className="flex w-64 items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-stone-200 transition hover:ring-stone-300 hover:shadow-md">
              <CincinSkor skor={s.skorTotal} ukuran={52} tebal={5} />
              <div className="min-w-0">
                <p className="truncate font-bold">{s.namaKelas}</p>
                <p className="text-xs text-stone-600">{new Date(s.dibuat).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const TINGKAT = ["semua", "Pemula", "Menengah", "Lanjut"] as const;

function DaftarKelas({ kategori, setKategori }: { kategori: IdKategori | "semua"; setKategori: (k: IdKategori | "semua") => void }) {
  const [param, setParam] = useSearchParams();
  const [tingkat, setTingkat] = useState<(typeof TINGKAT)[number]>("semua");
  const kata = param.get("cari") ?? "";
  const kelas: KelasTari[] = useMemo(() => saringKelas(DAFTAR_KELAS, { kata, kategori, tingkat }), [kata, kategori, tingkat]);

  return (
    <section id="kelas" aria-labelledby="judul-kelas" className="scroll-mt-28">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="judul-kelas" className="text-xl font-extrabold sm:text-2xl">
            Kelas tari
          </h2>
          <p className="text-sm text-stone-600" aria-live="polite">
            {kelas.length} kelas{kategori !== "semua" ? ` · ${KATEGORI.find((k) => k.id === kategori)?.nama}` : ""}
            {kata ? ` · cocok dengan “${kata}”` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Saring tingkat">
          {TINGKAT.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tingkat === t}
              onClick={() => setTingkat(t)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${tingkat === t ? "bg-tinta text-white" : "bg-white text-stone-700 ring-1 ring-stone-300 hover:ring-stone-400"}`}
            >
              {t === "semua" ? "Semua tingkat" : t}
            </button>
          ))}
          {(kata || kategori !== "semua") && (
            <button
              type="button"
              onClick={() => {
                setKategori("semua");
                setParam({}, { replace: true });
              }}
              className="rounded-full bg-merah-tua/10 px-3.5 py-1.5 text-xs font-bold text-merah-tua hover:bg-merah-tua/15"
            >
              Hapus saringan ✕
            </button>
          )}
        </div>
      </div>

      {kelas.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {kelas.map((k) => (
              <KartuKelas key={k.id} kelas={k} />
            ))}
          </div>
          <p className="mt-4 rounded-xl bg-white px-3 py-2.5 text-sm leading-snug text-stone-700 ring-1 ring-stone-200">
            <strong className="text-tinta">Tentang video:</strong> pratinjau dan latihan memakai video &ldquo;{MATERI_CONTOH.judulAsli}&rdquo; oleh{" "}
            {MATERI_CONTOH.kanal} ({MATERI_CONTOH.platform}). {keteranganHakCipta(MATERI_CONTOH)}
          </p>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
          <p className="font-bold">Belum ada kelas yang cocok.</p>
          <p className="mt-1 text-sm text-stone-600">Coba kata lain, misalnya &ldquo;pendet&rdquo;, &ldquo;seledet&rdquo;, atau &ldquo;tangkep&rdquo;.</p>
        </div>
      )}
    </section>
  );
}

export default function Beranda() {
  const [kategori, setKategori] = useState<IdKategori | "semua">("semua");
  const pilihKategori = (k: IdKategori | "semua") => {
    setKategori(k);
    document.getElementById("kelas")?.scrollIntoView({ behavior: "smooth" });
  };

  // Niat berlatih (kursor atau fokus di tautan latihan) → model AI mulai diunduh di latar.
  const mungkinPrefetch = (e: { target: EventTarget }) => {
    if (e.target instanceof Element && e.target.closest('a[href*="/latihan/"]')) prefetchAsetAi();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-14 px-4 pt-6 sm:px-6" onPointerOver={mungkinPrefetch} onFocusCapture={mungkinPrefetch}>
      <Hero />

      <section aria-labelledby="judul-kategori">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="judul-kategori" className="text-xl font-extrabold sm:text-2xl">
            Pilih berdasarkan jenis
          </h2>
          <button type="button" onClick={() => pilihKategori("semua")} className="text-sm font-bold text-kunyit hover:underline">
            Semua kelas
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KartuKategori id="semua" nama="Semua kelas" ringkas="Seluruh etalase" latar="bg-merah-tua" jumlah={DAFTAR_KELAS.length} aktif={kategori === "semua"} pilih={() => pilihKategori("semua")} />
          {KATEGORI.map((k) => (
            <KartuKategori
              key={k.id}
              id={k.id}
              nama={k.nama}
              ringkas={k.ringkas}
              latar={k.latar}
              jumlah={DAFTAR_KELAS.filter((x) => x.kategori === k.id).length}
              aktif={kategori === k.id}
              pilih={() => pilihKategori(k.id)}
            />
          ))}
        </div>
      </section>

      <LanjutkanLatihan />

      <DaftarKelas kategori={kategori} setKategori={setKategori} />

      <section id="cara-kerja" aria-labelledby="judul-cara" className="scroll-mt-28 overflow-hidden rounded-[28px] bg-hutan px-6 py-10 text-white sm:px-10">
        <p className="text-xs font-bold uppercase tracking-widest text-prada">Cara kerja</p>
        <h2 id="judul-cara" className="mt-1 text-2xl font-extrabold sm:text-3xl">
          Tiga langkah, tanpa memasang aplikasi
        </h2>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          {LANGKAH.map((l, i) => (
            <li key={l.judul} className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-prada text-lg font-extrabold text-tinta">{i + 1}</span>
              <h3 className="mt-4 text-lg font-bold">{l.judul}</h3>
              <p className="mt-1 text-sm text-white/80">{l.isi}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="judul-unsur">
        <h2 id="judul-unsur" className="text-xl font-extrabold sm:text-2xl">
          Empat unsur yang dinilai
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">Teknik dasar tari Bali menurut Kaler, seperti dikutip Parasari dkk. (2023) di jurnal IGEL.</p>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {UNSUR.map((u) => (
            <li key={u.nama} className="relative overflow-hidden rounded-2xl bg-white p-5 ring-1 ring-stone-200">
              <span className={`absolute right-0 top-0 h-20 w-20 rounded-bl-[2.5rem] ${u.latar}`} aria-hidden="true" />
              <IlustrasiPose pose={u.pose} sendi={false} kamen={false} warna="#f6c453" tebal={5} className="absolute right-1.5 top-1 h-16" />
              <div className="min-h-[4.5rem] pr-20">
                <p className="text-lg font-extrabold">{u.nama}</p>
                <p className="text-sm font-semibold text-emas">{u.arti}</p>
              </div>
              <p className="mt-1 text-sm text-stone-700">{u.isi}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-emas/30 bg-white p-5 sm:flex-row sm:items-center">
        <div className="poleng h-10 w-10 shrink-0 rounded-lg" aria-hidden="true" />
        <p className="text-sm text-stone-700">
          <strong>Catatan budaya.</strong> Tari wali (sakral) untuk upacara di pura sengaja tidak dimuat. Nama dan pembagian gerak bisa berbeda antarsanggar;
          deskripsi kelas mengikuti sumber tertulis yang tercantum di halaman{" "}
          <Link to="/tentang" className="font-bold text-merah-bata underline">
            Tentang
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
