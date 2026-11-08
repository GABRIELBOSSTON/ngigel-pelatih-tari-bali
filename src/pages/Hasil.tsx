import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { KUALITAS, SELEDET } from "../config";
import { cariKelas, formatDurasi, materiLatihan } from "../katalog/katalog";
import KreditVideo from "../katalog/KreditVideo";
import { bacaKodeSesi, kodekanSesi, tautanBagikan } from "../latihan/bagikan";
import CincinSkor, { warnaSkor } from "../latihan/CincinSkor";
import GarisWaktuLatihan from "../latihan/GarisWaktuLatihan";
import { buatKartuHasil } from "../latihan/kartuHasil";
import { PESAN_KUALITAS } from "../latihan/kualitas";
import { cariSesi, SesiSchema, type SesiTersimpan } from "../latihan/riwayat";
import { BATAS_PREDIKAT, bagianTersulit, predikat } from "../latihan/sesi";
import { DAFTAR_UNSUR, type Unsur } from "../scoring/types";

const WARNA_SELEDET = { tepat: "#16a34a", "arah-salah": "#eab308", terlewat: "#dc2626" } as const;
const NAMA_STATUS_SELEDET = { tepat: "Seledet tepat", "arah-salah": "Seledet arah berbeda", terlewat: "Seledet terlewat" } as const;

/** Ringkasan seledet untuk kartu tangkep. */
function kalimatSeledet(s: SesiTersimpan["seledet"]): string | null {
  if (!s) return null;
  if ("tidakTerbaca" in s) return `Seledet: ${s.jumlahGuru} pada guru; mata Anda terlalu jarang terbaca.`;
  return `Seledet: ${s.tepat} dari ${s.jumlahGuru} tepat${s.arahSalah > 0 ? `, ${s.arahSalah} arahnya berbeda` : ""}.`;
}

/** AI yang lambat melewatkan sebagian lirikan cepat (docs/09 bagian 11), jadi angka seledet diberi catatan. */
function catatanSeledet(s: SesiTersimpan["seledet"], fps: number): string | null {
  if (!s || "tidakTerbaca" in s || fps >= SELEDET.fpsAndal) return null;
  return `AI berjalan ${fps.toFixed(1).replace(".", ",")} deteksi/detik. Di bawah ${SELEDET.fpsAndal}, angka seledet kurang pasti karena sebagian lirikan cepat bisa tidak tertangkap.`;
}

const UNSUR: Record<Unsur, { nama: string; arti: string; segmen: string }> = {
  agem: { nama: "Agem", arti: "Sikap pokok", segmen: "sikap pokok" },
  tandang: { nama: "Tandang", arti: "Perpindahan", segmen: "perpindahan" },
  tangkis: { nama: "Tangkis", arti: "Peralihan", segmen: "peralihan" },
  tangkep: { nama: "Tangkep", arti: "Ekspresi", segmen: "" },
};

function alasanTanpaNilai(unsur: Unsur, alasan: string | undefined, modeAi: string): string {
  if (alasan === "tidak-ada-bagian") return `Rentang ini tidak memuat bagian ${UNSUR[unsur].segmen} pada gerak guru.`;
  if (unsur === "tangkep") {
    return modeAi.includes("tanpa ekspresi") ? "Mode cepat tidak membaca ekspresi wajah." : "Wajah dan mata terlalu jarang terbaca. Dekatkan wajah ke cahaya atau kurangi jarak.";
  }
  return "Bagian tubuh ini terlalu sering tidak terbaca kamera.";
}

const kapital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function kalimatKoreksi(p: SesiTersimpan["penyimpangan"][number]): string {
  const besar = p.selisihDerajat !== undefined ? `, rata-rata ±${p.selisihDerajat}°` : "";
  return `${kapital(p.bagian)} ${p.jenis}${besar}.`;
}

/**
 * Keterlambatan hanya bermakna bila geraknya memang cocok dengan guru. Bila tidak, DTW memasangkan
 * frame yang tidak berhubungan (uji gerak lain: "mendahului 3,71 detik"), jadi angkanya disembunyikan.
 */
function kalimatTempo(detik: number | null, skorTotal: number | null): string {
  if (skorTotal !== null && skorTotal < BATAS_PREDIKAT.cukup) return "Tidak terukur: gerak belum cocok";
  if (detik === null) return "Tidak terukur";
  if (detik > 0.15) return `Terlambat ±${detik.toFixed(2).replace(".", ",")} detik`;
  if (detik < -0.15) return `Mendahului ±${Math.abs(detik).toFixed(2).replace(".", ",")} detik`;
  return "Tepat waktu";
}

const NAMA_KELOMPOK: Record<string, string> = {
  lutut: "Lutut",
  pinggul: "Pinggul",
  badan: "Badan",
  lengan: "Tinggi lengan",
  jari: "Jari",
  siku: "Siku",
  bahu: "Bahu",
  tangan: "Tinggi tangan",
  langkah: "Langkah ke samping",
  arah: "Arah hadap",
  mata: "Lirikan mata",
  kepala: "Arah kepala",
  senyum: "Senyum",
};

/** Jarak tiap kelompok bagian tubuh (satuan toleransi), untuk guru dan juri yang ingin menelusuri nilai. */
function RincianTeknis({ jarakKelompok }: { jarakKelompok: Record<string, Record<string, number>> }) {
  return (
    <details className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
      <summary className="cursor-pointer font-extrabold">Rincian teknis per bagian tubuh</summary>
      <p className="mt-2 text-xs text-stone-600">
        Jarak = akar rata-rata kuadrat selisih Anda dan guru, dalam satuan toleransi (1 = 15° untuk sudut tubuh, 25° untuk jari, 0,15 panjang badan untuk
        posisi). Di bawah 1 berarti rata-rata masih dalam toleransi.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {DAFTAR_UNSUR.map((u) => (
          <div key={u}>
            <p className="text-sm font-bold">{UNSUR[u].nama}</p>
            <ul className="mt-1 space-y-1 text-sm">
              {Object.entries(jarakKelompok[u] ?? {}).map(([k, d]) => (
                <li key={k} className="flex items-center justify-between gap-2">
                  <span className="text-stone-600">{NAMA_KELOMPOK[k] ?? k}</span>
                  <span className={`font-semibold tabular-nums ${d < 1 ? "text-green-700" : d < 2 ? "text-amber-700" : "text-red-700"}`}>{d.toFixed(2).replace(".", ",")}</span>
                </li>
              ))}
              {Object.keys(jarakKelompok[u] ?? {}).length === 0 && <li className="text-stone-500">tidak dinilai</li>}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

function TidakDitemukan({ dibagikan }: { dibagikan: boolean }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-2xl font-extrabold">{dibagikan ? "Tautan hasil tidak bisa dibaca" : "Hasil latihan tidak ditemukan"}</h1>
      <p className="mt-2 text-stone-600">
        {dibagikan
          ? "Tautannya mungkin terpotong saat disalin. Minta pengirim menyalin ulang tautan lengkapnya."
          : "Riwayat disimpan di peramban tempat Anda berlatih. Mungkin riwayatnya sudah dihapus atau Anda memakai peramban lain."}
      </p>
      <Link to="/" className="mt-6 inline-block rounded-xl bg-kunyit px-5 py-2.5 font-bold text-white hover:bg-kunyit-gelap">
        Ke etalase
      </Link>
    </div>
  );
}

/** Hasil yang dibagikan lewat tautan: dibaca dari bagian "#d=…", tidak disimpan di perangkat ini. */
function HasilDibagikan() {
  const lokasi = useLocation();
  const [sesi, setSesi] = useState<SesiTersimpan | null | "memuat">("memuat");
  useEffect(() => {
    const kode = new URLSearchParams(lokasi.hash.slice(1)).get("d");
    if (!kode) {
      setSesi(null);
      return;
    }
    let batal = false;
    void bacaKodeSesi(kode).then((s) => {
      if (!batal) setSesi(s);
    });
    return () => {
      batal = true;
    };
  }, [lokasi.hash]);
  if (sesi === "memuat") return <p className="px-4 py-16 text-center text-stone-600">Membaca hasil…</p>;
  if (!sesi) return <TidakDitemukan dibagikan />;
  return <KartuHasil sesi={sesi} dibagikan />;
}

export default function Hasil() {
  const { sesiId } = useParams();
  const lokasi = useLocation();
  if (sesiId === "bagikan") return <HasilDibagikan />;
  const state = lokasi.state as { sesi?: unknown; tersimpan?: unknown } | null;
  const dariStudio = SesiSchema.safeParse(state?.sesi);
  const sesi = dariStudio.success && dariStudio.data.id === sesiId ? dariStudio.data : cariSesi(sesiId);
  if (!sesi) return <TidakDitemukan dibagikan={false} />;
  return <KartuHasil sesi={sesi} tidakTersimpan={dariStudio.success && state?.tersimpan === false} />;
}

/** Tombol bagikan: kartu PNG dan tautan untuk guru. Keduanya hanya berisi angka hasil. */
function BagikanHasil({ sesi }: { sesi: SesiTersimpan }) {
  const [tautan, setTautan] = useState<string | null>(null);
  const [kabar, setKabar] = useState<string | null>(null);

  const unduhKartu = async () => {
    const blob = await buatKartuHasil(sesi);
    if (!blob) return setKabar("Kartu tidak bisa dibuat di peramban ini.");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ngigel-${sesi.kelasId}-${sesi.dibuat.slice(0, 10)}.png`;
    a.click();
    URL.revokeObjectURL(url);
    setKabar("Kartu hasil diunduh.");
  };

  const salinTautan = async () => {
    const t = tautanBagikan(window.location.origin, import.meta.env.BASE_URL, await kodekanSesi(sesi));
    setTautan(t);
    try {
      await navigator.clipboard.writeText(t);
      setKabar("Tautan disalin. Tempel di chat untuk guru Anda.");
    } catch {
      setKabar("Salin tautan di bawah ini secara manual.");
    }
  };

  return (
    <section aria-labelledby="judul-bagikan" className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
      <h2 id="judul-bagikan" className="text-xl font-extrabold">
        Bagikan ke guru
      </h2>
      <p className="mt-1 text-sm text-stone-600">Isinya hanya angka nilai dan koreksi, tanpa video atau gambar Anda. Tautan tidak melewati server Ngigel.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => void salinTautan()} className="rounded-xl bg-hutan px-4 py-2.5 text-sm font-bold text-white hover:bg-hutan-muda">
          Salin tautan hasil
        </button>
        <button type="button" onClick={() => void unduhKartu()} className="rounded-xl px-4 py-2.5 text-sm font-bold text-tinta ring-1 ring-stone-300 hover:bg-pasir">
          Unduh kartu hasil (PNG)
        </button>
      </div>
      {kabar && (
        <p role="status" className="mt-2 text-sm font-semibold text-hutan">
          {kabar}
        </p>
      )}
      {tautan && (
        <label className="mt-2 block">
          <span className="sr-only">Tautan hasil</span>
          <input readOnly value={tautan} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-xl border border-stone-300 bg-pasir/40 px-3 py-2 text-xs" />
        </label>
      )}
    </section>
  );
}

function KartuHasil({ sesi, dibagikan = false, tidakTersimpan = false }: { sesi: SesiTersimpan; dibagikan?: boolean; tidakTersimpan?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const kelas = cariKelas(sesi.kelasId);
  const urlVideo = kelas && !sesi.videoDariBerkas ? `${import.meta.env.BASE_URL}${materiLatihan(kelas).materi.video}` : null;
  const rentang = { mulai: sesi.mulai, akhir: sesi.akhir };
  const tersulit = bagianTersulit(sesi.garisWaktu, sesi.mulai);
  const keLatihan = (r?: { mulai: number; akhir: number }) =>
    `/latihan/${sesi.kelasId}${r ? `?mulai=${Math.floor(Math.max(0, r.mulai - 1))}&akhir=${Math.ceil(r.akhir + 1)}` : ""}`;

  const lihatGuru = (detik: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, detik - 1.5);
    v.scrollIntoView({ behavior: "smooth", block: "center" });
    void v.play().catch(() => {});
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pt-6 sm:px-6">
      <nav aria-label="Jejak halaman" className="text-xs font-semibold text-stone-500">
        <Link to="/riwayat" className="hover:text-merah-tua">
          Riwayat
        </Link>{" "}
        / <span className="text-tinta">{dibagikan ? "Hasil yang dibagikan" : "Hasil latihan"}</span>
      </nav>
      {dibagikan && (
        <p className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-950 ring-1 ring-sky-200">
          Ini hasil latihan yang dibagikan lewat tautan. Isinya hanya angka, dan tidak disimpan di perangkat ini.
        </p>
      )}
      {tidakTersimpan && (
        <p role="status" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-300">
          Riwayat tidak tersimpan karena penyimpanan peramban diblokir (mis. mode privat). Hasil ini hilang bila halaman ditutup; bagikan atau unduh kartunya
          bila perlu.
        </p>
      )}
      {sesi.kualitas && sesi.kualitas.porsiKurangJelas >= KUALITAS.porsiCatatan && sesi.kualitas.masalahUtama && (
        <p role="status" className="rounded-2xl bg-stone-100 px-4 py-3 text-sm text-stone-800 ring-1 ring-stone-300">
          <strong>{Math.round(sesi.kualitas.porsiKurangJelas * 100)}% latihan tidak dinilai</strong> karena gambar kamera kurang jelas. Saran untuk latihan
          berikutnya: {PESAN_KUALITAS[sesi.kualitas.masalahUtama].charAt(0).toLowerCase() + PESAN_KUALITAS[sesi.kualitas.masalahUtama].slice(1)}.
        </p>
      )}

      <section className="latar-hero relative overflow-hidden rounded-[28px] p-6 text-white sm:p-8">
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center">
          <CincinSkor skor={sesi.skorTotal} ukuran={132} tebal={11} terang />
          <div className="flex-1">
            <p className="text-sm font-semibold text-prada">{predikat(sesi.skorTotal)}</p>
            <h1 className="text-2xl font-extrabold sm:text-3xl">{sesi.namaKelas}</h1>
            <p className="mt-1 text-sm text-white/80">
              {new Date(sesi.dibuat).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })} · rentang {formatDurasi(sesi.mulai)}–{formatDurasi(sesi.akhir)}
              {sesi.kecepatanPutar !== 1 ? ` · video ${String(sesi.kecepatanPutar).replace(".", ",")}×` : ""}
            </p>
            {sesi.memakaiContoh && <p className="mt-2 text-xs text-white/75">Dinilai terhadap video contoh Tari Kreasi Janger, karena video kelas ini belum tersedia.</p>}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
            {tersulit && (
              <Link to={keLatihan(tersulit)} className="rounded-xl bg-kunyit px-5 py-3 text-center text-sm font-bold text-white shadow-lg hover:bg-kunyit-gelap">
                Latih bagian tersulit ({formatDurasi(tersulit.mulai)}–{formatDurasi(tersulit.akhir)})
              </Link>
            )}
            <Link to={keLatihan()} className="rounded-xl bg-white px-5 py-3 text-center text-sm font-bold text-tinta hover:bg-pasir">
              ↺ Ulangi kelas ini
            </Link>
            <Link to="/" className="rounded-xl px-5 py-2 text-center text-sm font-bold text-white/90 ring-1 ring-white/30 hover:bg-white/10">
              Pilih tarian lain
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="judul-unsur">
        <h2 id="judul-unsur" className="mb-3 text-xl font-extrabold">
          Nilai per unsur
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DAFTAR_UNSUR.map((u) => {
            const skor = sesi.skor[u];
            return (
              <li key={u} className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-extrabold">{UNSUR[u].nama}</p>
                    <p className="text-xs font-semibold text-emas">{UNSUR[u].arti}</p>
                  </div>
                  <span className="text-2xl font-extrabold tabular-nums" style={{ color: skor === null ? "#78716c" : warnaSkor(skor) }}>
                    {skor ?? "–"}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
                  <div className="h-full rounded-full" style={{ width: `${skor ?? 0}%`, backgroundColor: warnaSkor(skor) }} />
                </div>
                {skor === null && <p className="mt-2 text-xs text-stone-600">{alasanTanpaNilai(u, sesi.alasan[u], sesi.modeAi)}</p>}
                {u === "tangkep" && kalimatSeledet(sesi.seledet) && <p className="mt-2 text-xs font-semibold text-stone-700">{kalimatSeledet(sesi.seledet)}</p>}
                {u === "tangkep" && catatanSeledet(sesi.seledet, sesi.fpsRata) && <p className="mt-1 text-xs text-stone-600">{catatanSeledet(sesi.seledet, sesi.fpsRata)}</p>}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section aria-labelledby="judul-koreksi" className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
          <h2 id="judul-koreksi" className="text-xl font-extrabold">
            Koreksi utama
          </h2>
          {sesi.penyimpangan.length > 0 ? (
            <ol className="mt-3 space-y-3">
              {sesi.penyimpangan.map((p, i) => (
                <li key={p.fitur} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-merah-tua text-sm font-extrabold text-white">{i + 1}</span>
                  <div>
                    <p className="font-bold">{kalimatKoreksi(p)}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-stone-600">
                      <span className="rounded-full bg-pasir px-2 py-0.5 font-semibold">{UNSUR[p.unsur].nama}</span>
                      {p.waktuDetik !== undefined && urlVideo && (
                        <button type="button" onClick={() => lihatGuru(p.waktuDetik!)} className="font-bold text-kunyit hover:underline">
                          ▶ Lihat gerak guru di {formatDurasi(p.waktuDetik)}
                        </button>
                      )}
                      {p.waktuDetik !== undefined && !urlVideo && <span>paling jelas di {formatDurasi(p.waktuDetik)}</span>}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-stone-600">Tidak ada selisih yang cukup besar untuk dikoreksi. Pertahankan!</p>
          )}
          {sesi.kesalahanBerulang && sesi.kesalahanBerulang.length > 0 && (
            <div className="mt-5 border-t border-stone-100 pt-4">
              <h3 className="text-sm font-extrabold text-merah-tua">Kesalahan yang berulang saat menari</h3>
              <ul className="mt-2 space-y-2.5">
                {sesi.kesalahanBerulang.map((k) => (
                  <li key={`${k.judul}-${k.saran}`} className="rounded-xl bg-pasir/60 px-3 py-2.5 text-sm">
                    <p className="font-extrabold">{k.judul === "Kesalahan berulang" ? k.saran : k.judul}</p>
                    {k.guru && k.anda && (
                      <p className="mt-0.5 text-stone-700">
                        <span className="font-bold text-hutan">Guru:</span> {k.guru} · <span className="font-bold text-merah-tua">Anda:</span> {k.anda}
                      </p>
                    )}
                    {k.judul !== "Kesalahan berulang" && <p className="mt-0.5 font-semibold text-stone-800">→ {k.saran}</p>}
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-stone-600">
                      <span>Muncul {k.kali}× sejak {formatDurasi(k.detik)}</span>
                      {urlVideo && (
                        <button type="button" onClick={() => lihatGuru(k.detik)} className="font-bold text-kunyit hover:underline">
                          ▶ Lihat gerak guru
                        </button>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-4 text-xs text-stone-500">
            Koreksi diambil dari selisih rata-rata terbesar antara Anda dan guru setelah gerak diselaraskan (DTW). Sisi kiri dan kanan adalah sisi tubuh Anda sendiri.
          </p>
        </section>

        <section aria-labelledby="judul-video" className="rounded-2xl bg-stone-950 p-3 text-white">
          <h2 id="judul-video" className="px-2 pb-2 pt-1 text-sm font-bold text-white/85">
            Video guru
          </h2>
          {urlVideo && kelas ? (
            <>
              <video ref={videoRef} src={`${urlVideo}#t=${sesi.mulai}`} controls playsInline preload="metadata" className="aspect-video w-full rounded-xl bg-black" />
              <div className="mt-2">
                <KreditVideo materi={materiLatihan(kelas).materi} gelap />
              </div>
            </>
          ) : (
            <p className="px-2 pb-3 text-sm text-white/75">Video dipilih dari perangkat Anda dan tidak disimpan, jadi tidak bisa diputar ulang di sini.</p>
          )}
        </section>
      </div>

      <section aria-labelledby="judul-garis" className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 id="judul-garis" className="text-xl font-extrabold">
            Kemiripan sepanjang latihan
          </h2>
          {tersulit && (
            <p className="text-sm text-stone-600">
              Bagian tersulit (garis jingga): <strong>{formatDurasi(tersulit.mulai)}–{formatDurasi(tersulit.akhir)}</strong>
            </p>
          )}
        </div>
        <GarisWaktuLatihan
          segmen={sesi.segmen}
          rentang={rentang}
          garis={sesi.garisWaktu}
          waktu={sesi.mulai}
          sorot={tersulit}
          penanda={sesi.seledet && !("tidakTerbaca" in sesi.seledet) ? sesi.seledet.kejadian.map((k) => ({ t: k.t, warna: WARNA_SELEDET[k.status], label: NAMA_STATUS_SELEDET[k.status] })) : []}
        />
        {sesi.seledet && !("tidakTerbaca" in sesi.seledet) && (
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
            {(Object.keys(WARNA_SELEDET) as (keyof typeof WARNA_SELEDET)[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className="h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent" style={{ borderTopColor: WARNA_SELEDET[s] }} aria-hidden="true" />
                {NAMA_STATUS_SELEDET[s]}
              </span>
            ))}
          </p>
        )}
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-stone-100 pt-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs font-semibold text-stone-500">Ketepatan waktu</dt>
            <dd className="font-bold">{kalimatTempo(sesi.terlambatDetik, sesi.skorTotal)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-stone-500">Tubuh terbaca</dt>
            <dd className="font-bold">{sesi.tubuhTerbacaPersen}% frame</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-stone-500">Kecepatan AI</dt>
            <dd className="font-bold">{sesi.fpsRata.toFixed(1).replace(".", ",")} fps</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-stone-500">Mode AI</dt>
            <dd className="font-bold">{sesi.modeAi}</dd>
          </div>
          {sesi.kualitas?.ukuranTubuh != null && (
            <div>
              <dt className="text-xs font-semibold text-stone-500">Tinggi tubuh di kamera</dt>
              <dd className="font-bold">{Math.round(sesi.kualitas.ukuranTubuh * 100)}% layar</dd>
            </div>
          )}
        </dl>
      </section>

      {!dibagikan && <BagikanHasil sesi={sesi} />}

      {sesi.jarakKelompok && <RincianTeknis jarakKelompok={sesi.jarakKelompok} />}

      <p className="rounded-2xl bg-pasir/70 p-4 text-xs text-stone-700">
        <strong>Cara nilai dihitung.</strong> Sudut sendi dan posisi tangan Anda dibandingkan dengan guru setelah tempo diselaraskan. Setiap selisih dibagi
        toleransinya (15° untuk sudut tubuh, 25° untuk jari), lalu nilai = 100 × e<sup>−jarak/2</sup>. Nilai ini dari prototipe yang masih dikalibrasi; pakai sebagai
        panduan latihan, bukan pengganti guru. Hasil hanya tersimpan di peramban ini.
      </p>
    </div>
  );
}
