import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import KameraView from "../components/KameraView";
import IlustrasiPose from "../katalog/IlustrasiPose";
import { cariKelas, formatDurasi, materiLatihan, namaKategori, type KelasTari } from "../katalog/katalog";
import KreditVideo from "../katalog/KreditVideo";
import { KINERJA, KUALITAS, STUDIO } from "../config";
import CincinSkor from "../latihan/CincinSkor";
import GarisWaktuLatihan, { NAMA_SEGMEN, WARNA_SEGMEN } from "../latihan/GarisWaktuLatihan";
import { kartuDariFrame, PemantauKesalahan, type KartuKesalahan } from "../latihan/kesalahan";
import {
  keyakinanTubuh,
  masalahKualitas,
  PESAN_KUALITAS,
  ringkasKualitas,
  tahanMasalah,
  ukuranTubuh,
  type CatatanKualitas,
  type MasalahKualitas,
} from "../latihan/kualitas";
import { bacaPengaturan, KECEPATAN_PUTAR, simpanPengaturan, type Pengaturan } from "../latihan/pengaturan";
import { usePelatihSuara } from "../latihan/pelatihSuara";
import { umpanBalik, type Petunjuk, type UmpanBalik } from "../latihan/petunjuk";
import { buatIdSesi, simpanSesi, type SesiTersimpan } from "../latihan/riwayat";
import {
  akhirGerak,
  awalGerak,
  bagiBabak,
  garisWaktu,
  nilaiSesi,
  tanganDiAtasKepala,
  tubuhLengkap,
  tubuhTerpotong,
  type Rentang,
  type SampelKemiripan,
} from "../latihan/sesi";
import { FPS_BERKAS_PENGGUNA, useMateri, type MateriSiap, type StatusMateri } from "../latihan/useMateri";
import { hitungFiturFrame } from "../scoring/fitur";
import { median } from "../scoring/geometri";
import { KODE_WARNA } from "../scoring/realtime";
import { cariSeledet } from "../scoring/seledet";
import type { WarnaKemiripan } from "../scoring/types";
import type { WarnaBagian } from "../vision/gambarStickman";
import type { BagianGambar } from "../vision/garis";
import { PengukurFps } from "../vision/pengukurFps";
import type { HasilDeteksi } from "../vision/types";
import type { StatusVisi } from "../vision/useVisi";

// Studio latihan (docs/03 bagian C–E): video guru di kiri, kamera murid di kanan.
// Saat menari: garis tubuh hijau/kuning/merah, kemiripan 0–100, satu petunjuk perbaikan (juga
// diucapkan bila ada suara bahasa Indonesia), jeda otomatis bila tubuh keluar dari kamera.
// Mulai bisa dengan tombol atau gestur kedua tangan di atas kepala.
// Selesai: penilaian empat unsur dengan DTW, disimpan di peramban, lalu pindah ke halaman Hasil.

type Tahap = "persiapan" | "hitung" | "menari" | "jeda" | "menilai";

const CERMIN = { transform: "scaleX(-1)" } as const;

/** Selama ini sebelum dan sesudah kejadian seledet guru, panel guru menampilkan tanda "Seledet". */
const TANDA_SELEDET_DETIK = 0.35;

// Urutan = urutan di panel dua kolom: pasangan kiri–kanan sebaris, badan terakhir.
const NAMA_BAGIAN: Record<BagianGambar, string> = {
  lenganKiri: "Lengan kiri",
  lenganKanan: "Lengan kanan",
  tungkaiKiri: "Tungkai kiri",
  tungkaiKanan: "Tungkai kanan",
  tanganKiri: "Jari kiri",
  tanganKanan: "Jari kanan",
  badan: "Badan",
};

const KUNCI_PANDUAN = "ngigel.panduan.v1";

/** Warna garis saat gambar kamera kurang jelas: abu-abu, bukan merah, karena yang salah kameranya. */
const WARNA_KURANG_JELAS: WarnaBagian = Object.fromEntries((Object.keys(NAMA_BAGIAN) as BagianGambar[]).map((b) => [b, "#a8a29e"]));

export default function Latihan() {
  const { kelasId } = useParams();
  const kelas = cariKelas(kelasId);
  if (!kelas) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <IlustrasiPose pose="seledet" warna="#7a1416" sendi={false} className="mx-auto h-40" />
        <h1 className="mt-4 text-2xl font-extrabold">Kelas tidak ditemukan</h1>
        <p className="mt-2 text-stone-600">Kelas &ldquo;{kelasId}&rdquo; tidak ada di etalase.</p>
        <Link to="/" className="mt-6 inline-block rounded-xl bg-kunyit px-5 py-2.5 font-bold text-white hover:bg-kunyit-gelap">
          Kembali ke etalase
        </Link>
      </div>
    );
  }
  return <Studio key={kelas.id} kelas={kelas} />;
}

function Studio({ kelas }: { kelas: KelasTari }) {
  const { materi, contoh } = materiLatihan(kelas);
  const { status, siapkanDariBerkas } = useMateri(materi);
  return (
    <div className="mx-auto max-w-7xl px-4 pb-6 pt-5 sm:px-6">
      <KepalaStudio kelas={kelas} contoh={contoh} />
      {status.tahap === "siap" ? (
        <RuangLatihan key={status.data.urlVideo} kelas={kelas} contoh={contoh} data={status.data} />
      ) : (
        <PanelMateri status={status} siapkan={siapkanDariBerkas} />
      )}
    </div>
  );
}

function KepalaStudio({ kelas, contoh }: { kelas: KelasTari; contoh: boolean }) {
  return (
    <header className="mb-5">
      <nav aria-label="Jejak halaman" className="text-xs font-semibold text-stone-500">
        <Link to="/" className="hover:text-merah-tua">
          Etalase
        </Link>{" "}
        / {namaKategori(kelas.kategori)} / <span className="text-tinta">{kelas.nama}</span>
      </nav>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{kelas.nama}</h1>
          <p className="mt-0.5 text-sm text-stone-600">
            {kelas.tingkat} · {kelas.penari} · {kelas.ringkas}
          </p>
        </div>
      </div>
      {contoh && (
        <p className="mt-3 rounded-2xl bg-prada/25 px-4 py-3 text-sm text-tinta ring-1 ring-prada">
          <strong>Video kelas ini belum tersedia.</strong> Sementara Anda berlatih dengan video contoh <strong>Tari Kreasi Janger</strong>, dan nilai
          dihitung terhadap gerak Janger, bukan gerak {kelas.nama}.
        </p>
      )}
    </header>
  );
}

/** Saat data guru belum siap: memuat, tidak ada di server (pilih berkas sendiri), atau sedang dibaca. */
function PanelMateri({ status, siapkan }: { status: Exclude<StatusMateri, { tahap: "siap" }>; siapkan: (berkas: File, cermin: boolean) => Promise<void> }) {
  const [cermin, setCermin] = useState(false);
  if (status.tahap === "memuat") {
    return (
      <div className="grid gap-4 lg:grid-cols-2" aria-busy="true">
        <div className="aspect-[4/3] animate-pulse rounded-2xl bg-stone-200" />
        <div className="aspect-[4/3] animate-pulse rounded-2xl bg-stone-200" />
        <p role="status" className="sr-only">
          Memuat video dan data gerak guru…
        </p>
      </div>
    );
  }
  if (status.tahap === "menyiapkan") {
    return (
      <div className="rounded-2xl bg-white p-6 ring-1 ring-stone-200">
        <p className="font-bold">AI sedang membaca gerak guru dari video Anda</p>
        <p role="status" className="mt-1 text-sm text-stone-600">
          {status.teks}
        </p>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full rounded-full bg-kunyit transition-all" style={{ width: `${Math.round(status.porsi * 100)}%` }} />
        </div>
        <p className="mt-3 text-xs text-stone-500">Video diproses di perangkat ini, tidak dikirim ke server. Biarkan tab ini tetap terbuka.</p>
      </div>
    );
  }
  const pilih = (e: ChangeEvent<HTMLInputElement>) => {
    const berkas = e.target.files?.[0];
    if (berkas) void siapkan(berkas, cermin);
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl bg-white p-6 ring-1 ring-stone-200">
        <p className="text-xs font-bold uppercase tracking-wide text-emas">Video guru belum ada di server ini</p>
        <h2 className="mt-1 text-xl font-extrabold">Pakai video tari dari perangkat Anda</h2>
        {status.tahap === "galat" ? (
          <p role="alert" className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            Materi gagal dimuat: {status.pesan}
          </p>
        ) : (
          <p className="mt-2 text-sm text-stone-700">
            Berkas {status.alasan} untuk kelas ini tidak ditemukan di server, atau gagal dimuat.
          </p>
        )}
        <p className="mt-2 text-sm text-stone-700">
          Anda tetap bisa mencoba: pilih video tari dengan <strong>satu penari</strong> yang <strong>seluruh tubuhnya terlihat</strong>. AI membaca gerak guru
          lebih dulu (±2 menit untuk video 1 menit, {FPS_BERKAS_PENGGUNA} frame per detik), lalu Anda menari bersamanya.
        </p>
        <label className="mt-4 block">
          <span className="sr-only">Pilih berkas video guru</span>
          <input
            type="file"
            accept="video/*"
            onChange={pilih}
            className="block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-kunyit file:px-4 file:py-2.5 file:font-bold file:text-white hover:file:bg-kunyit-gelap"
          />
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cermin} onChange={(e) => setCermin(e.target.checked)} />
          Penari di video memperagakan secara cermin
        </label>
      </div>
      <div className="relative flex aspect-[4/3] items-end overflow-hidden rounded-2xl bg-hutan p-6 text-white">
        <IlustrasiPose pose="nyeregseg" className="absolute inset-x-0 top-4 mx-auto h-[70%] opacity-90" />
        <p className="relative text-sm text-white/85">Kamera menyala setelah video guru siap. Berkas tidak disimpan dan tidak dikirim ke mana pun.</p>
      </div>
    </div>
  );
}

type Layar = {
  waktu: number;
  kemiripan: number | null;
  petunjuk: Petunjuk | null;
  warna: Partial<Record<BagianGambar, WarnaKemiripan>>;
  tubuh: boolean;
  /** Saat menari: ada bagian tubuh yang keluar dari gambar (bukan sekadar tertutup gerak, mis. berlutut). */
  terpotong: boolean;
  /** AI menemukan orang (walau tubuhnya belum utuh). Tanpa orang sama sekali, bisa jadi terlalu jauh. */
  adaOrang: boolean;
  fps: number;
  garis: (number | null)[];
  /** Kemajuan gestur "mulai" (0–1). */
  gestur: number;
  /** Sedang dijeda otomatis karena tubuh tidak terlihat. */
  jedaOtomatis: boolean;
  gelap: boolean;
  /** Gambar kamera buram selama lamaGelapDetik (ketajaman di bawah KUALITAS.ketajamanMin). */
  buram: boolean;
  /** Ada kejadian seledet guru di sekitar waktu video sekarang. */
  seledetDekat: boolean;
  /** Gerbang kualitas: masalah kamera yang sedang aktif saat menari (garis abu-abu, frame tidak dinilai). */
  kurangJelas: MasalahKualitas | null;
  /** Tinggi tubuh di kamera (0–1), median beberapa frame terakhir; untuk daftar cek persiapan. */
  ukuranTubuh: number | null;
  /** Kartu kesalahan berulang yang sedang tampil (src/latihan/kesalahan.ts). */
  kartu: KartuKesalahan | null;
};

function RuangLatihan({ kelas, contoh, data }: { kelas: KelasTari; contoh: boolean; data: MateriSiap }) {
  const pindah = useNavigate();
  const [param] = useSearchParams();
  const [pengaturan, setPengaturan] = useState<Pengaturan>(bacaPengaturan);
  const ubah = (p: Partial<Pengaturan>) =>
    setPengaturan((lama) => {
      const baru = { ...lama, ...p };
      simpanPengaturan(baru);
      return baru;
    });

  const penuh = useMemo<Rentang>(() => ({ mulai: awalGerak(data.frame), akhir: akhirGerak(data.frame) }), [data.frame]);
  const babak = useMemo(() => bagiBabak(data.segmen, penuh), [data.segmen, penuh]);
  const rentangUrl = useMemo<Rentang | null>(() => {
    const m = Number(param.get("mulai"));
    const a = Number(param.get("akhir"));
    if (!param.has("mulai") || !param.has("akhir") || !Number.isFinite(m) || !Number.isFinite(a) || a - m < 2) return null;
    return { mulai: Math.max(0, m), akhir: Math.min(penuh.akhir, a) };
  }, [param, penuh.akhir]);
  const [rentang, setRentang] = useState<Rentang>(() => rentangUrl ?? penuh);
  const seledetGuru = useMemo(() => cariSeledet(data.frameBanding), [data.frameBanding]);
  const pelatih = usePelatihSuara(pengaturan.pelatihSuara);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [tahap, setTahapState] = useState<Tahap>("persiapan");
  const tahapRef = useRef<Tahap>("persiapan");
  const setTahap = useCallback((t: Tahap) => {
    tahapRef.current = t;
    setTahapState(t);
  }, []);
  const rekamanRef = useRef<HasilDeteksi[]>([]);
  const sampelRef = useRef<SampelKemiripan[]>([]);
  const umpanRef = useRef<UmpanBalik | null>(null);
  const tubuhRef = useRef(false);
  const terpotongRef = useRef(false);
  const adaOrangRef = useRef(false);
  const fpsSesiRef = useRef<number[]>([]);
  const petunjukRef = useRef<{ petunjuk: Petunjuk | null; sejak: number }>({ petunjuk: null, sejak: 0 });
  const pewaktuRef = useRef<number | null>(null);
  // Jeda otomatis: kapan tubuh terakhir terlihat, dan sejak kapan tubuh kembali utuh sesudah dijeda.
  const terlihatTerakhirRef = useRef(0);
  const jedaOtomatisRef = useRef(false);
  const tubuhKembaliSejakRef = useRef<number | null>(null);
  // Gestur mulai, kecerahan, dan kecepatan AI: sejak kapan kondisinya berlangsung.
  const gesturSejakRef = useRef<number | null>(null);
  const gelapSejakRef = useRef<number | null>(null);
  const buramSejakRef = useRef<number | null>(null);
  const lambatSejakRef = useRef<number | null>(null);
  const suaraTerakhirRef = useRef<{ teks: string; waktu: number }>({ teks: "", waktu: 0 });
  // Gerbang kualitas kamera: keadaan masalah, catatan per frame rekaman (sejajar rekamanRef), ukuran terakhir.
  const kualitasRef = useRef<{ masalah: MasalahKualitas | null; sejak: number }>({ masalah: null, sejak: 0 });
  const kurangJelasRef = useRef<MasalahKualitas | null>(null);
  const catatanKualitasRef = useRef<CatatanKualitas[]>([]);
  const ukuranTerakhirRef = useRef<number[]>([]);
  // Kartu kesalahan berulang: pemantau per sesi, kartu yang tampil, dan kartu baru yang belum diucapkan.
  const pemantauRef = useRef(new PemantauKesalahan());
  const kartuRef = useRef<KartuKesalahan | null>(null);
  const kartuBaruRef = useRef<KartuKesalahan | null>(null);
  const [pengukur] = useState(() => new PengukurFps(2000));
  const [statusVisi, setStatusVisi] = useState<StatusVisi>({ tahap: "memuat" });
  const statusVisiRef = useRef<StatusVisi["tahap"]>("memuat");
  useEffect(() => {
    statusVisiRef.current = statusVisi.tahap;
  }, [statusVisi.tahap]);
  const [hitung, setHitung] = useState<number | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  // Panduan 3 langkah untuk kunjungan pertama; ditutup sekali, diingat per perangkat.
  const [panduan, setPanduan] = useState(() => {
    try {
      return localStorage.getItem(KUNCI_PANDUAN) === null;
    } catch {
      return false;
    }
  });
  const tutupPanduan = () => {
    setPanduan(false);
    try {
      localStorage.setItem(KUNCI_PANDUAN, "1");
    } catch {
      // Penyimpanan diblokir (mode privat): panduan cukup ditutup untuk kunjungan ini.
    }
  };
  const [peringatanLambat, setPeringatanLambat] = useState<"tampil" | "ditutup" | null>(null);
  const [layar, setLayar] = useState<Layar>({
    waktu: rentang.mulai,
    kemiripan: null,
    petunjuk: null,
    warna: {},
    tubuh: false,
    fps: 0,
    garis: [],
    gestur: 0,
    jedaOtomatis: false,
    gelap: false,
    buram: false,
    seledetDekat: false,
    kurangJelas: null,
    ukuranTubuh: null,
    kartu: null,
    adaOrang: false,
    terpotong: false,
  });

  /** Suara video guru diredam selama pelatih bicara, lalu dipulihkan. */
  const redam = useCallback(() => {
    if (videoRef.current) videoRef.current.volume = 0.35;
  }, []);
  const pulih = useCallback(() => {
    if (videoRef.current) videoRef.current.volume = 1;
  }, []);
  const ucapkan = useCallback(
    (teks: string, sela = false) => {
      if (pelatih.ucapkan(teks, { sela, saatMulai: redam, saatSelesai: pulih })) suaraTerakhirRef.current = { teks, waktu: performance.now() };
    },
    [pelatih, redam, pulih],
  );

  const saatKecerahan = useCallback((nilai: number, tajam: number | null) => {
    const sekarang = performance.now();
    if (nilai < STUDIO.kecerahanMin) gelapSejakRef.current ??= sekarang;
    else gelapSejakRef.current = null;
    if (tajam !== null && tajam < KUALITAS.ketajamanMin) buramSejakRef.current ??= sekarang;
    else buramSejakRef.current = null;
  }, []);

  // Video guru berhenti di awal rentang selama persiapan.
  useEffect(() => {
    const v = videoRef.current;
    if (v && tahapRef.current === "persiapan" && v.readyState >= HTMLMediaElement.HAVE_METADATA) v.currentTime = rentang.mulai;
  }, [rentang]);
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = pengaturan.kecepatan;
  }, [pengaturan.kecepatan]);
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = !pengaturan.suara;
  }, [pengaturan.suara]);
  useEffect(() => () => window.clearTimeout(pewaktuRef.current ?? undefined), []);

  // Setiap hasil deteksi kamera: catat, bandingkan dengan guru pada detik video yang sama, warnai garis.
  const saatHasil = useCallback(
    (hasil: HasilDeteksi): WarnaBagian | void => {
      const sekarang = performance.now();
      pengukur.catat(sekarang);
      tubuhRef.current = tubuhLengkap(hasil.pose);
      terpotongRef.current = tubuhTerpotong(hasil.pose);
      adaOrangRef.current = hasil.pose !== null;
      if (hasil.poseDunia !== null) terlihatTerakhirRef.current = sekarang;
      // Gestur mulai hanya di layar persiapan: gerak tari juga bisa mengangkat kedua tangan.
      if (tahapRef.current === "persiapan" && tanganDiAtasKepala(hasil.pose)) gesturSejakRef.current ??= sekarang;
      else gesturSejakRef.current = null;
      // Gerbang kualitas kamera (docs/04 bagian 8): ruangan gelap, gambar buram, tubuh terlalu kecil, atau AI ragu.
      const ukuran = ukuranTubuh(hasil.pose);
      const keyakinan = keyakinanTubuh(hasil.pose);
      if (ukuran !== null) ukuranTerakhirRef.current = [...ukuranTerakhirRef.current.slice(-14), ukuran];
      const masalah = hasil.pose
        ? masalahKualitas({ ukuran, keyakinan, gelap: gelapSejakRef.current !== null, buram: buramSejakRef.current !== null })
        : null;
      const { keadaan, aktif } = tahanMasalah(kualitasRef.current, masalah, sekarang);
      kualitasRef.current = keadaan;
      kurangJelasRef.current = aktif;
      const video = videoRef.current;
      if (tahapRef.current !== "menari" || !video || video.paused) {
        umpanRef.current = null;
        kartuRef.current = null;
        return;
      }
      // Detik video guru saat frame kamera DIAMBIL (bukan saat AI selesai, ±0,2 detik kemudian).
      const t = Math.max(0, video.currentTime - ((performance.now() - hasil.waktuMs) / 1000) * video.playbackRate);
      rekamanRef.current.push({ ...hasil, waktuMs: Math.round(t * 1000) });
      catatanKualitasRef.current.push({ ukuran, keyakinan, kurangJelas: aktif });
      // Gambar kamera kurang jelas: jangan salahkan murid. Garis abu-abu, tanpa kemiripan dan petunjuk gerak.
      if (aktif) {
        umpanRef.current = null;
        kartuRef.current = null;
        return WARNA_KURANG_JELAS;
      }
      const fitur = hitungFiturFrame(hasil);
      const ub = umpanBalik(data.frameBanding, fitur, t);
      umpanRef.current = ub;
      // Kesalahan yang sama berulang-ulang (termasuk kiri–kanan kebalik) → kartu besar (src/latihan/kesalahan.ts).
      const pantau = pemantauRef.current.amati(sekarang, kartuDariFrame(data.frameBanding, t, fitur, ub.petunjuk), t);
      kartuRef.current = pantau.kartu;
      if (pantau.baru) kartuBaruRef.current = pantau.kartu;
      if (ub.kemiripan !== null) sampelRef.current.push({ t, kemiripan: ub.kemiripan });
      const warna: WarnaBagian = {};
      for (const [bagian, w] of Object.entries(ub.warna) as [BagianGambar, WarnaKemiripan][]) warna[bagian] = KODE_WARNA[w];
      return warna;
    },
    [data.frameBanding, pengukur],
  );

  // Tampilan diperbarui 5× per detik (deteksi sendiri berjalan secepat AI mampu). Di sini juga:
  // jeda/lanjut otomatis, gestur mulai, saran cahaya dan perangkat lambat, serta pelatih suara.
  useEffect(() => {
    const id = window.setInterval(() => {
      const sekarang = performance.now();
      const waktu = videoRef.current?.currentTime ?? rentang.mulai;
      const tahapIni = tahapRef.current;
      const menari = tahapIni === "menari";
      const aksi = aksiRef.current;

      // Jeda otomatis bila tubuh tidak terlihat (docs/03 bagian C); lanjut sendiri bila tubuh kembali utuh.
      if (menari && sekarang - terlihatTerakhirRef.current > STUDIO.jedaBilaTubuhHilangDetik * 1000) aksi.jedaOtomatis();
      if (tahapIni === "jeda" && jedaOtomatisRef.current) {
        if (tubuhRef.current) {
          tubuhKembaliSejakRef.current ??= sekarang;
          if (sekarang - tubuhKembaliSejakRef.current >= STUDIO.lanjutBilaTubuhKembaliDetik * 1000) aksi.lanjutOtomatis();
        } else {
          tubuhKembaliSejakRef.current = null;
        }
      }

      // Gestur mulai: kedua tangan di atas kepala selama gesturMulaiDetik, hanya di layar persiapan.
      const gesturSejak = gesturSejakRef.current;
      const gestur =
        tahapIni === "persiapan" && statusVisiRef.current === "siap" && gesturSejak !== null
          ? Math.min(1, (sekarang - gesturSejak) / (STUDIO.gesturMulaiDetik * 1000))
          : 0;
      if (gestur >= 1) {
        gesturSejakRef.current = null;
        aksi.mulai();
      }

      // Perangkat lambat: saran ditampilkan sekali dan bisa ditutup.
      const fps = pengukur.fps();
      if (statusVisiRef.current === "siap" && fps > 0 && fps < KINERJA.fpsPeringatan) {
        lambatSejakRef.current ??= sekarang;
        if (sekarang - lambatSejakRef.current >= KINERJA.lamaPeringatanDetik * 1000) setPeringatanLambat((p) => p ?? "tampil");
      } else {
        lambatSejakRef.current = null;
      }
      if (menari && fps > 0) fpsSesiRef.current.push(fps);

      const baru = sampelRef.current.filter((s) => s.t >= waktu - 2 && s.t <= waktu + 0.5);
      const kemiripan = baru.length > 0 ? Math.round(baru.reduce((a, s) => a + s.kemiripan, 0) / baru.length) : null;
      const kurangJelas = menari ? kurangJelasRef.current : null;
      const kandidat = menari && !kurangJelas ? (umpanRef.current?.petunjuk ?? null) : null;
      const tampil = petunjukRef.current;
      if (!menari || sekarang - tampil.sejak >= STUDIO.jedaGantiPetunjukMs || (tampil.petunjuk === null && kandidat !== null)) {
        petunjukRef.current = { petunjuk: kandidat, sejak: sekarang };
      }
      const petunjuk = petunjukRef.current.petunjuk;

      // Pelatih suara: petunjuk yang berubah (paling sering setiap jedaSuaraPetunjukMs) dan pujian sesekali.
      if (menari) {
        const terakhir = suaraTerakhirRef.current;
        const saranKamera = kurangJelas ? PESAN_KUALITAS[kurangJelas] : null;
        const kartuBaru = kartuBaruRef.current;
        if (saranKamera) {
          if (saranKamera !== terakhir.teks && sekarang - terakhir.waktu >= STUDIO.jedaSuaraPetunjukMs) aksi.ucapkan(saranKamera);
        } else if (kartuBaru) {
          // Kartu baru selalu diucapkan sekali, memotong petunjuk biasa yang mungkin sedang diucapkan.
          aksi.ucapkan(kartuBaru.ucapan, true);
          kartuBaruRef.current = null;
        } else if (petunjuk && petunjuk.teks !== terakhir.teks && sekarang - terakhir.waktu >= STUDIO.jedaSuaraPetunjukMs) aksi.ucapkan(petunjuk.teks);
        else if (!petunjuk && kemiripan !== null && kemiripan >= 80 && sekarang - terakhir.waktu >= 10000) aksi.ucapkan("Bagus, pertahankan");
      }

      const gelapSejak = gelapSejakRef.current;
      setLayar({
        waktu,
        kemiripan: menari || tahapIni === "jeda" ? kemiripan : null,
        petunjuk,
        warna: menari ? (umpanRef.current?.warna ?? {}) : {},
        tubuh: tubuhRef.current,
        terpotong: terpotongRef.current,
        adaOrang: adaOrangRef.current,
        fps,
        garis: garisWaktu(sampelRef.current, rentang),
        gestur,
        jedaOtomatis: tahapIni === "jeda" && jedaOtomatisRef.current,
        gelap: gelapSejak !== null && sekarang - gelapSejak >= STUDIO.lamaGelapDetik * 1000,
        buram: buramSejakRef.current !== null && sekarang - buramSejakRef.current >= STUDIO.lamaGelapDetik * 1000,
        seledetDekat: seledetGuru.some((k) => Math.abs(k.t - waktu) <= TANDA_SELEDET_DETIK),
        kurangJelas,
        ukuranTubuh: tubuhRef.current ? median(ukuranTerakhirRef.current) : null,
        kartu: menari && !kurangJelas ? kartuRef.current : null,
      });
    }, 200);
    return () => window.clearInterval(id);
  }, [rentang, pengukur, seledetGuru]);

  const mulai = () => {
    const video = videoRef.current;
    // Tombol dan gestur bisa memicu bersamaan; hanya yang pertama yang dipakai.
    if (!video || tahapRef.current !== "persiapan") return;
    rekamanRef.current = [];
    catatanKualitasRef.current = [];
    pemantauRef.current = new PemantauKesalahan();
    kartuRef.current = null;
    kartuBaruRef.current = null;
    sampelRef.current = [];
    fpsSesiRef.current = [];
    umpanRef.current = null;
    jedaOtomatisRef.current = false;
    tubuhKembaliSejakRef.current = null;
    video.pause();
    video.currentTime = rentang.mulai;
    video.playbackRate = pengaturan.kecepatan;
    video.muted = !pengaturan.suara;
    setPesan(null);
    setTahap("hitung");
    // Sudah mulai latihan sekali: panduan kunjungan pertama tidak perlu muncul lagi.
    if (panduan) tutupPanduan();
    ucapkan("Bersiap. Mundur ke posisi menari.", true);
    let n = STUDIO.hitungMundurDetik;
    setHitung(n);
    const langkah = () => {
      n -= 1;
      if (n > 0) {
        setHitung(n);
        if (n <= 3) ucapkan(String(n), true);
        pewaktuRef.current = window.setTimeout(langkah, 1000);
        return;
      }
      setHitung(null);
      terlihatTerakhirRef.current = performance.now();
      setTahap("menari");
      ucapkan("Mulai", true);
      video.play().catch(() => {
        // Peramban kadang menahan video bersuara; putar tanpa suara daripada tidak sama sekali.
        video.muted = true;
        void video.play().catch(() => setPesan("Video guru tidak bisa diputar. Muat ulang halaman."));
        setPesan("Peramban menahan suara video. Nyalakan lagi lewat tombol Suara.");
      });
    };
    pewaktuRef.current = window.setTimeout(langkah, 1000);
  };

  const batalkan = () => {
    window.clearTimeout(pewaktuRef.current ?? undefined);
    setHitung(null);
    jedaOtomatisRef.current = false;
    gesturSejakRef.current = null;
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.currentTime = rentang.mulai;
    }
    setTahap("persiapan");
  };

  const selesai = useCallback(() => {
    if (tahapRef.current !== "menari" && tahapRef.current !== "jeda") return;
    const video = videoRef.current;
    video?.pause();
    jedaOtomatisRef.current = false;
    setTahap("menilai");
    ucapkan("Selesai. Menghitung nilai.", true);
    const akhir = Math.min(rentang.akhir, video?.currentTime ?? rentang.akhir);
    const dipakai: Rentang = { mulai: rentang.mulai, akhir: Math.max(rentang.mulai + 1, akhir) };
    // Beri waktu layar menampilkan "menghitung nilai" sebelum perhitungan DTW.
    window.setTimeout(() => {
      // Frame saat gambar kamera kurang jelas tidak dinilai (gerbang kualitas, docs/04 bagian 8).
      const catatan = catatanKualitasRef.current;
      const kualitas = ringkasKualitas(catatan);
      // Separuh latihan atau lebih kurang jelas: sisa framenya juga diambil dalam kondisi itu, jadi tidak dinilai.
      if (kualitas.masalahUtama && kualitas.porsiKurangJelas >= KUALITAS.porsiTolak) {
        setTahap("persiapan");
        if (video) video.currentTime = rentang.mulai;
        setPesan(
          `Belum bisa dinilai: gambar kamera kurang jelas di ${Math.round(kualitas.porsiKurangJelas * 100)}% latihan. ${PESAN_KUALITAS[kualitas.masalahUtama]}, lalu coba lagi.`,
        );
        return;
      }
      const dinilai = rekamanRef.current.filter((_, i) => !catatan[i]?.kurangJelas);
      const hasil = nilaiSesi(data.frame, data.segmen, dinilai, dipakai, data.guruMemperagakanCermin);
      if (hasil.jenis === "kurang-data") {
        setTahap("persiapan");
        if (video) video.currentTime = rentang.mulai;
        setPesan(
          `Belum bisa dinilai: tubuh Anda hanya terbaca di ${hasil.tubuhTerbacaPersen}% dari ${hasil.jumlahFrame} frame. Mundur sampai kepala dan kaki terlihat, pastikan cahaya cukup, lalu coba lagi.`,
        );
        return;
      }
      const p = hasil.penilaian;
      const fps = fpsSesiRef.current;
      const sesi: SesiTersimpan = {
        id: buatIdSesi(),
        kelasId: kelas.id,
        namaKelas: kelas.nama,
        memakaiContoh: contoh,
        videoDariBerkas: data.dariBerkas,
        dibuat: new Date().toISOString(),
        mulai: dipakai.mulai,
        akhir: dipakai.akhir,
        skorTotal: p.skorTotal,
        skor: p.skor,
        alasan: { ...p.alasan },
        penyimpangan: p.penyimpangan,
        terlambatDetik: hasil.terlambatDetik,
        seledet: hasil.seledet,
        jarakKelompok: Object.fromEntries(
          Object.entries(p.jarakKelompok).map(([u, kelompok]) => [u, Object.fromEntries(Object.entries(kelompok).map(([k, d]) => [k, Math.round(d * 100) / 100]))]),
        ),
        tubuhTerbacaPersen: hasil.tubuhTerbacaPersen,
        garisWaktu: garisWaktu(sampelRef.current, dipakai),
        segmen: data.segmen
          .filter((s) => s.selesaiDetik > dipakai.mulai && s.mulaiDetik < dipakai.akhir)
          .map((s) => ({ ...s, mulaiDetik: Math.max(s.mulaiDetik, dipakai.mulai), selesaiDetik: Math.min(s.selesaiDetik, dipakai.akhir) })),
        fpsRata: fps.length > 0 ? Math.round((10 * fps.reduce((a, b) => a + b, 0)) / fps.length) / 10 : 0,
        modeAi: pengaturan.modeCepat ? "Holistic · GPU · tanpa ekspresi wajah" : "Holistic · CPU",
        kecepatanPutar: pengaturan.kecepatan,
        kualitas,
        kesalahanBerulang: [...pemantauRef.current.catatan.values()]
          .sort((a, b) => b.kali - a.kali)
          .slice(0, 5)
          .map((c) => ({
            judul: c.kartu.judul,
            guru: c.kartu.guru,
            anda: c.kartu.anda,
            saran: c.kartu.saran,
            kali: c.kali,
            detik: Math.round(c.detikVideo * 10) / 10,
          })),
      };
      // Penyimpanan bisa diblokir (mode privat); hasil tetap ditampilkan, dengan pemberitahuan.
      const tersimpan = simpanSesi(sesi);
      void pindah(`/hasil/${sesi.id}`, { state: { sesi, tersimpan } });
    }, 60);
  }, [contoh, data, kelas.id, kelas.nama, pengaturan.kecepatan, pengaturan.modeCepat, pindah, rentang, setTahap, ucapkan]);

  const jeda = () => {
    jedaOtomatisRef.current = false;
    videoRef.current?.pause();
    setTahap("jeda");
  };
  const lanjut = () => {
    jedaOtomatisRef.current = false;
    tubuhKembaliSejakRef.current = null;
    terlihatTerakhirRef.current = performance.now();
    setTahap("menari");
    void videoRef.current?.play().catch(() => {});
  };
  const jedaOtomatis = () => {
    if (tahapRef.current !== "menari") return;
    videoRef.current?.pause();
    jedaOtomatisRef.current = true;
    tubuhKembaliSejakRef.current = null;
    setTahap("jeda");
    ucapkan("Dijeda. Kembali ke depan kamera untuk melanjutkan.", true);
  };
  const lanjutOtomatis = () => {
    ucapkan("Lanjut", true);
    lanjut();
  };
  // Perulangan tampilan memanggil aksi lewat ref supaya selalu memakai versi terbaru (pengaturan, rentang).
  const aksiRef = useRef({ mulai, jedaOtomatis, lanjutOtomatis, ucapkan });
  useEffect(() => {
    aksiRef.current = { mulai, jedaOtomatis, lanjutOtomatis, ucapkan };
  });
  const saatWaktu = () => {
    const v = videoRef.current;
    if (v && tahapRef.current === "menari" && v.currentTime >= rentang.akhir) selesai();
  };

  const segmenSekarang = data.segmen.find((s) => layar.waktu >= s.mulaiDetik && layar.waktu < s.selesaiDetik);
  const sedangLatihan = tahap === "menari" || tahap === "jeda";
  const kemajuan = Math.min(1, Math.max(0, (layar.waktu - rentang.mulai) / Math.max(0.001, rentang.akhir - rentang.mulai)));
  const opsiVisi = useMemo(() => (pengaturan.modeCepat ? { delegasi: "GPU" as const, blendshape: false } : {}), [pengaturan.modeCepat]);
  const pilihanRentang = [
    { label: `Seluruh tarian · ${formatDurasi(penuh.akhir - penuh.mulai)}`, r: penuh },
    ...(babak.length > 1 ? babak.map((b, i) => ({ label: `Babak ${i + 1} · ${formatDurasi(b.mulai)}–${formatDurasi(b.akhir)}`, r: b })) : []),
    ...(rentangUrl ? [{ label: `Bagian pilihan · ${formatDurasi(rentangUrl.mulai)}–${formatDurasi(rentangUrl.akhir)}`, r: rentangUrl }] : []),
  ];
  return (
    <div className="space-y-4">
      {pesan && (
        <p role="alert" className="flex items-start justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-300">
          {pesan}
          <button type="button" onClick={() => setPesan(null)} className="font-bold" aria-label="Tutup pesan">
            ✕
          </button>
        </p>
      )}
      {panduan && tahap === "persiapan" && <PanduanAwal tutup={tutupPanduan} />}
      {peringatanLambat === "tampil" && (
        <p role="status" className="flex items-start justify-between gap-3 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-950 ring-1 ring-sky-200">
          <span>
            <strong>AI berjalan lambat</strong> ({layar.fps.toFixed(1).replace(".", ",")} deteksi per detik), jadi garis dan petunjuk tertinggal. Tutup tab atau
            aplikasi lain
            {pengaturan.modeCepat ? "; perangkat ini mungkin memang terlalu lambat untuk AI wajah dan tangan." : ", atau nyalakan Mode cepat (ekspresi wajah tidak dinilai)."}
          </span>
          <button type="button" onClick={() => setPeringatanLambat("ditutup")} className="font-bold" aria-label="Tutup saran">
            ✕
          </button>
        </p>
      )}

      <div className="relative grid gap-4 lg:grid-cols-2">
        {/* Panel guru */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-stone-950 lg:aspect-auto">
          <video
            ref={videoRef}
            src={data.urlVideo}
            playsInline
            preload="auto"
            onLoadedMetadata={(e) => {
              e.currentTarget.currentTime = rentang.mulai;
              e.currentTarget.playbackRate = pengaturan.kecepatan;
            }}
            onTimeUpdate={saatWaktu}
            onEnded={selesai}
            className="absolute inset-0 h-full w-full object-cover"
            style={pengaturan.cerminGuru ? CERMIN : undefined}
            aria-label={`Video guru: ${data.judul}${pengaturan.cerminGuru ? ", ditampilkan seperti cermin" : ""}`}
          />
          <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white">GURU</span>
          {layar.seledetDekat && sedangLatihan && (
            <span className="absolute left-1/2 top-12 -translate-x-1/2 animate-muncul rounded-full bg-prada px-3 py-1 text-xs font-extrabold text-tinta shadow-lg">
              👁 Seledet!
            </span>
          )}
          {segmenSekarang && sedangLatihan && (
            <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-tinta">
              <span className={`h-2 w-2 rounded-full ${WARNA_SEGMEN[segmenSekarang.jenis]}`} />
              {NAMA_SEGMEN[segmenSekarang.jenis]}
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2.5 pt-10">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-prada" style={{ width: `${kemajuan * 100}%` }} />
            </div>
            <p className="mt-1 flex justify-between text-[11px] font-semibold tabular-nums text-white/85">
              <span>{formatDurasi(layar.waktu)}</span>
              <span>
                {pengaturan.kecepatan !== 1 ? `${String(pengaturan.kecepatan).replace(".", ",")}× · ` : ""}
                {formatDurasi(rentang.akhir)}
              </span>
            </p>
          </div>
        </div>

        {/* Panel murid */}
        <KameraView saatHasil={saatHasil} saatStatusVisi={setStatusVisi} saatKecerahan={saatKecerahan} opsiVisi={opsiVisi} className="rounded-2xl">
          <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white">ANDA</span>
          {statusVisi.tahap === "siap" && tahap === "persiapan" && (
            <ul className="absolute left-3 top-11 space-y-1 rounded-xl bg-black/60 px-3 py-2 text-xs font-semibold text-white">
              <li>✓ Kamera dan AI siap{layar.fps > 0 ? ` (${layar.fps.toFixed(1).replace(".", ",")} fps)` : ""}</li>
              <li className={layar.tubuh ? "text-green-300" : "text-amber-200"}>
                {layar.tubuh
                  ? "✓ Seluruh tubuh terlihat"
                  : layar.adaOrang
                    ? "… Mundur sampai kepala dan kaki terlihat"
                    : "… Belum ada orang terbaca: berdiri di depan kamera, jangan terlalu jauh"}
              </li>
              {layar.tubuh && layar.ukuranTubuh !== null && (
                <li className={layar.ukuranTubuh >= KUALITAS.tubuhMin ? "text-green-300" : "text-amber-200"}>
                  {layar.ukuranTubuh >= KUALITAS.tubuhMin
                    ? `✓ Jarak pas (tubuh ${Math.round(layar.ukuranTubuh * 100)}% tinggi layar)`
                    : // Pada orang yang sangat kecil, titik AI bisa ngawur (kaki terbaca di atas kepala), jadi tanpa angka.
                      layar.ukuranTubuh < 0.05
                      ? "… Maju 1–2 langkah: tubuh terlalu kecil atau belum terbaca jelas"
                      : `… Maju 1–2 langkah: tubuh baru ${Math.round(layar.ukuranTubuh * 100)}% tinggi layar`}
                </li>
              )}
              {layar.gelap && <li className="text-amber-200">… Ruangan gelap: tambah cahaya dari depan</li>}
              {layar.buram && <li className="text-amber-200">… Gambar kamera buram: bersihkan lensa kamera</li>}
              {layar.tubuh && (
                <li className="pt-1 text-white/90">
                  🙌 Angkat kedua tangan di atas kepala untuk mulai
                  {layar.gestur > 0 && (
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/25" aria-hidden="true">
                      <span className="block h-full rounded-full bg-prada" style={{ width: `${Math.round(layar.gestur * 100)}%` }} />
                    </span>
                  )}
                </li>
              )}
            </ul>
          )}
          {layar.jedaOtomatis && (
            <div role="status" className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 px-6 text-center text-white">
              <p className="text-lg font-extrabold">Dijeda: tubuh Anda tidak terlihat</p>
              <p className="mt-1 text-sm text-white/85">
                Kembali ke depan kamera. Bila sudah di depan kamera, mungkin terlalu jauh: maju 1–2 langkah. Latihan lanjut sendiri saat kepala sampai kaki
                terlihat.
              </p>
            </div>
          )}
          {sedangLatihan && (
            <div className="absolute right-3 top-3 rounded-2xl bg-white/95 p-1.5 shadow-lg">
              <CincinSkor skor={layar.kemiripan} ukuran={56} tebal={6} label={layar.kemiripan === null ? "Kemiripan belum terbaca" : `Kemiripan ${layar.kemiripan}`} />
            </div>
          )}
          {tahap === "menari" && layar.kartu && <KartuSalah kartu={layar.kartu} />}
          {tahap === "menari" && !layar.kartu && (
            <BalonPetunjuk petunjuk={layar.petunjuk} kemiripan={layar.kemiripan} terpotong={layar.terpotong} kurangJelas={layar.kurangJelas} />
          )}
        </KameraView>

        {hitung !== null && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-black/55 text-white backdrop-blur-[2px]">
            <span key={hitung} className="animate-denyut text-8xl font-extrabold text-prada drop-shadow-lg">
              {hitung}
            </span>
            <p className="mt-2 text-lg font-bold">Mundur ke posisi menari</p>
            <p className={`mt-1 text-sm font-semibold ${layar.tubuh ? "text-green-300" : "text-amber-200"}`}>{layar.tubuh ? "✓ Seluruh tubuh terlihat" : "Kepala sampai kaki harus terlihat"}</p>
            <button type="button" onClick={batalkan} className="mt-5 rounded-full bg-white/15 px-4 py-1.5 text-sm font-bold hover:bg-white/25">
              Batal
            </button>
          </div>
        )}
        {tahap === "menilai" && (
          <div role="status" className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-hutan/85 text-white">
            <span className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-prada" aria-hidden="true" />
            <p className="mt-4 text-lg font-bold">Menghitung nilai…</p>
            <p className="text-sm text-white/80">Menyelaraskan gerak Anda dengan guru (DTW)</p>
          </div>
        )}
      </div>

      {data.dariBerkas ? <p className="text-xs text-stone-500">Video guru: {data.kredit}</p> : <KreditVideo materi={materiLatihan(kelas).materi} />}

      {/* Bilah kendali */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-stone-200">
        {tahap === "persiapan" || tahap === "hitung" ? (
          <button
            type="button"
            onClick={mulai}
            disabled={tahap === "hitung" || statusVisi.tahap !== "siap"}
            className="rounded-xl bg-kunyit px-6 py-3 font-bold text-white shadow-sm transition hover:bg-kunyit-gelap disabled:cursor-not-allowed disabled:opacity-50"
          >
            {statusVisi.tahap === "siap" ? "▶ Mulai menari" : "Menyiapkan AI…"}
          </button>
        ) : tahap === "menari" ? (
          <button type="button" onClick={jeda} className="rounded-xl bg-tinta px-6 py-3 font-bold text-white hover:bg-stone-700">
            ❚❚ Jeda
          </button>
        ) : (
          <button type="button" onClick={lanjut} disabled={tahap === "menilai"} className="rounded-xl bg-kunyit px-6 py-3 font-bold text-white hover:bg-kunyit-gelap disabled:opacity-50">
            ▶ Lanjutkan
          </button>
        )}
        <button
          type="button"
          onClick={selesai}
          disabled={!sedangLatihan}
          className="rounded-xl bg-hutan px-4 py-3 text-sm font-bold text-white hover:bg-hutan-muda disabled:cursor-not-allowed disabled:opacity-40"
        >
          Selesai &amp; nilai
        </button>
        <button type="button" onClick={batalkan} disabled={!sedangLatihan} className="rounded-xl px-4 py-3 text-sm font-bold text-stone-700 ring-1 ring-stone-300 hover:bg-pasir disabled:opacity-40">
          ↺ Ulang
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-pasir p-1" role="group" aria-label="Kecepatan video guru">
            {KECEPATAN_PUTAR.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={pengaturan.kecepatan === k}
                onClick={() => ubah({ kecepatan: k })}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold tabular-nums ${pengaturan.kecepatan === k ? "bg-white text-tinta shadow-sm" : "text-stone-600"}`}
              >
                {String(k).replace(".", ",")}×
              </button>
            ))}
          </div>
          <Saklar label="Suara" aktif={pengaturan.suara} ubah={(v) => ubah({ suara: v })} />
          <Saklar
            label="Pelatih suara"
            aktif={pengaturan.pelatihSuara && pelatih.tersedia}
            ubah={(v) => ubah({ pelatihSuara: v })}
            nonaktif={!pelatih.tersedia}
            keterangan={
              !pelatih.tersedia
                ? "Peramban ini tidak punya suara berbahasa Indonesia"
                : `Petunjuk diucapkan (${pelatih.namaSuara}${pelatih.suaraDaring ? "; suara daring: kalimat petunjuk diolah layanan suara peramban" : ""})`
            }
          />
          <Saklar label="Cermin guru" aktif={pengaturan.cerminGuru} ubah={(v) => ubah({ cerminGuru: v })} />
          <Saklar
            label="Mode cepat"
            aktif={pengaturan.modeCepat}
            ubah={(v) => ubah({ modeCepat: v })}
            nonaktif={tahap !== "persiapan"}
            keterangan="GPU tanpa ekspresi wajah: lebih lancar, tetapi tangkep tidak dinilai"
          />
        </div>
      </div>

      {/* minmax(0, 1fr): tanpa ini, deretan tombol babak yang bisa digeser melebarkan kolom melewati layar HP. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200" aria-labelledby="judul-rentang">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="judul-rentang" className="font-extrabold">
              Rentang latihan
            </h2>
            <div className="tanpa-scrollbar flex max-w-full gap-1.5 overflow-x-auto" role="group" aria-label="Pilih rentang latihan">
              {pilihanRentang.map(({ label, r }) => {
                const aktif = r.mulai === rentang.mulai && r.akhir === rentang.akhir;
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={tahap !== "persiapan"}
                    aria-pressed={aktif}
                    onClick={() => setRentang(r)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${aktif ? "bg-tinta text-white" : "bg-pasir text-stone-700 hover:bg-stone-200"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <GarisWaktuLatihan
            segmen={data.segmen}
            rentang={rentang}
            garis={layar.garis}
            waktu={layar.waktu}
            penanda={seledetGuru.map((k) => ({ t: k.t, warna: "#7a5a00", label: "Seledet guru" }))}
          />
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
            {(Object.keys(NAMA_SEGMEN) as (keyof typeof NAMA_SEGMEN)[]).map((j) => (
              <li key={j} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-sm ${WARNA_SEGMEN[j]}`} aria-hidden="true" />
                {NAMA_SEGMEN[j]}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-6 rounded-sm bg-gradient-to-r from-red-600 via-yellow-500 to-green-600" aria-hidden="true" />
              Kemiripan Anda per detik
            </li>
            {seledetGuru.length > 0 && (
              <li className="flex items-center gap-1.5">
                <span className="h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-emas" aria-hidden="true" />
                Seledet guru ({seledetGuru.filter((k) => k.t >= rentang.mulai && k.t <= rentang.akhir).length} di rentang ini)
              </li>
            )}
          </ul>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200" aria-labelledby="judul-bagian">
          <h2 id="judul-bagian" className="font-extrabold">
            Bagian tubuh
          </h2>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
            {(Object.keys(NAMA_BAGIAN) as BagianGambar[]).map((b) => {
              const w = layar.warna[b];
              return (
                <li key={b} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ backgroundColor: w ? KODE_WARNA[w] : "#e7e5e4" }} aria-hidden="true" />
                  <span className={w ? "font-semibold" : "text-stone-500"}>{NAMA_BAGIAN[b]}</span>
                  <span className="sr-only">{w ? `: ${w}` : ": belum terbaca"}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-stone-600">
            Hijau: selisih sudut di bawah 15° (jari: 25°). Kuning: sampai 2× batas itu. Merah: lebih dari itu. Gerak Anda dibandingkan dengan gerak guru yang
            paling mirip dalam 0,6 detik terakhir, jadi sedikit terlambat tidak langsung merah.
          </p>
        </section>
      </div>

      {tahap === "persiapan" && (
        <section className="grid gap-3 rounded-2xl bg-hutan p-5 text-white sm:grid-cols-4" aria-label="Tips sebelum menari">
          {[
            ["Mundur 2–3 langkah", "Kepala sampai kaki harus terlihat di kamera."],
            ["Cahaya dari depan", "Jangan membelakangi jendela atau lampu terang."],
            ["Satu orang saja", "AI mengikuti satu penari; orang lain membuat nilai kacau."],
            ["Tanpa menyentuh laptop", `Angkat kedua tangan di atas kepala ${String(STUDIO.gesturMulaiDetik).replace(".", ",")} detik untuk mulai. Keluar dari kamera untuk jeda; kembali untuk lanjut.`],
          ].map(([judul, isi]) => (
            <div key={judul}>
              <p className="font-bold text-prada">{judul}</p>
              <p className="text-sm text-white/80">{isi}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

/** Panduan kunjungan pertama: tiga hal yang paling menentukan apakah AI bisa membaca murid dengan benar. */
function PanduanAwal({ tutup }: { tutup: () => void }) {
  const langkah = [
    ["Letakkan laptop", "Setinggi pinggang atau dada, kamera menghadap Anda. Bersihkan lensa kamera."],
    ["Mundur 2–3 langkah", `Kepala sampai kaki terlihat, tubuh minimal ${Math.round(KUALITAS.tubuhMin * 100)}% tinggi layar. Daftar cek di kamera memberi tahu bila sudah pas.`],
    ["Cahaya dari depan", "Nyalakan lampu di depan Anda; jangan membelakangi jendela atau lampu terang."],
  ] as const;
  return (
    <section aria-labelledby="judul-panduan" className="rounded-2xl bg-white p-4 ring-2 ring-kunyit/40 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="judul-panduan" className="text-lg font-extrabold">
          Pertama kali? Siapkan 3 hal ini
        </h2>
        <button type="button" onClick={tutup} className="rounded-full bg-kunyit px-4 py-1.5 text-sm font-bold text-white hover:bg-kunyit-gelap">
          Mengerti
        </button>
      </div>
      <ol className="mt-3 grid gap-3 sm:grid-cols-3">
        {langkah.map(([judul, isi], i) => (
          <li key={judul} className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-merah-tua text-sm font-extrabold text-white">{i + 1}</span>
            <div>
              <p className="font-bold">{judul}</p>
              <p className="text-sm text-stone-600">{isi}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-stone-700">
        Lalu tekan <strong>Mulai menari</strong>, atau angkat kedua tangan di atas kepala {String(STUDIO.gesturMulaiDetik).replace(".", ",")} detik. Bila gerak yang
        sama salah berulang kali, kartu besar di kamera menunjukkan bedanya dengan guru.
      </p>
    </section>
  );
}

/**
 * Kartu kesalahan berulang: guru dan murid dibandingkan dalam bahasa sederhana, lalu satu perintah besar.
 * Menggantikan balon petunjuk selama tampil; video tetap berjalan (keputusan ketua 6 Nov).
 */
function KartuSalah({ kartu }: { kartu: KartuKesalahan }) {
  return (
    <div
      role="alert"
      key={kartu.kunci}
      className="absolute inset-x-2 bottom-2 animate-muncul rounded-2xl bg-white/95 p-3 text-tinta shadow-2xl ring-2 ring-merah-tua sm:inset-x-3 sm:bottom-3 sm:p-4"
    >
      <p className="text-xs font-extrabold uppercase tracking-wide text-merah-tua sm:text-sm">⚠ {kartu.judul}</p>
      {kartu.guru && kartu.anda && (
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 text-sm font-semibold leading-snug sm:text-base">
          <dt className="font-extrabold text-hutan">Guru:</dt>
          <dd>{kartu.guru}</dd>
          <dt className="font-extrabold text-merah-tua">Anda:</dt>
          <dd>{kartu.anda}</dd>
        </dl>
      )}
      <p className="mt-2 rounded-xl bg-pasir px-3 py-1.5 text-base font-extrabold sm:text-lg">→ {kartu.saran}</p>
    </div>
  );
}

function BalonPetunjuk({
  petunjuk,
  kemiripan,
  terpotong,
  kurangJelas,
}: {
  petunjuk: Petunjuk | null;
  kemiripan: number | null;
  /** Ada bagian tubuh di luar gambar. Kaki yang tertutup gerak (mis. berlutut) tidak dihitung. */
  terpotong: boolean;
  kurangJelas: MasalahKualitas | null;
}) {
  let warna = "bg-green-500";
  let teks = "Bagus, pertahankan!";
  if (terpotong) {
    warna = "bg-amber-400";
    teks = "Mundur sedikit: kepala sampai kaki harus terlihat";
  } else if (kurangJelas) {
    // Abu-abu, sama dengan garis: yang perlu diperbaiki kameranya, bukan gerak murid.
    warna = "bg-stone-400";
    teks = PESAN_KUALITAS[kurangJelas];
  } else if (petunjuk) {
    warna = petunjuk.selisihToleransi >= 2 ? "bg-red-500" : "bg-yellow-400";
    teks = petunjuk.teks;
  } else if (kemiripan === null) {
    warna = "bg-stone-400";
    teks = "Ikuti gerak guru…";
  }
  return (
    <p aria-live="polite" className="absolute inset-x-3 bottom-3 flex items-center gap-2.5 rounded-2xl bg-white/95 px-4 py-3 text-base font-extrabold text-tinta shadow-xl animate-muncul" key={teks}>
      <span className={`h-3 w-3 shrink-0 rounded-full ${warna}`} aria-hidden="true" />
      {teks}
    </p>
  );
}

function Saklar({ label, aktif, ubah, nonaktif = false, keterangan }: { label: string; aktif: boolean; ubah: (v: boolean) => void; nonaktif?: boolean; keterangan?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={aktif}
      disabled={nonaktif}
      onClick={() => ubah(!aktif)}
      title={keterangan}
      className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-bold text-stone-700 hover:bg-pasir disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className={`relative h-5 w-9 rounded-full transition ${aktif ? "bg-hutan" : "bg-stone-300"}`} aria-hidden="true">
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${aktif ? "left-[18px]" : "left-0.5"}`} />
      </span>
      {label}
    </button>
  );
}
