// Etalase kelas tari di Beranda. Data statis.
// Setiap deskripsi mengikuti sumber di SUMBER (dibaca 3 Nov 2026), supaya bisa ditelusuri auditor.
// Tari wali (sakral) sengaja tidak dimuat (docs/05 bagian 3).
import type { SumberVideo } from "../lessons/schema";
import type { Unsur } from "../scoring/types";

export const SUMBER = {
  igel2023: {
    label: "Parasari, Sariada, & Suryani (2023), IGEL: Journal of Dance 3(2), 131–137",
    url: "https://jurnal2.isi-dps.ac.id/index.php/igel/article/download/2885/1096",
  },
  batarirupa2022: {
    label: "Wibawa, Sugama, & Gunawan (2022), Batarirupa 2(1), 110–126",
    url: "https://ojs.mahadewa.ac.id/index.php/batarirupa/article/view/2321",
  },
  unesco2015: {
    label: "The Jakarta Post (3 Des 2015), UNESCO recognizes nine Balinese dances",
    url: "https://www.thejakartapost.com/news/2015/12/03/unesco-recognizes-nine-balinese-dances.html",
  },
  janger: { label: "Wikipedia, Janger dance", url: "https://en.wikipedia.org/wiki/Janger_dance" },
  pendet: { label: "Wikipedia, Pendet dance", url: "https://en.wikipedia.org/wiki/Pendet_dance" },
  panyembrama: { label: "Kamus BASAbali, Panyembrama", url: "https://dictionary.basabali.org/Panyembrama" },
  puspanjali: { label: "Incite Arts, Episode 20 – Tari Puspanjali", url: "https://www.incitearts.org.au/?p=1782" },
  sekarJagat: { label: "Miami University Libraries, Sekar Jagat", url: "https://albinwml.lib.miamioh.edu/collections/show/6" },
  kebyarDuduk: { label: "Wikipedia, Kebyar duduk", url: "https://en.wikipedia.org/wiki/Kebyar_duduk" },
  oleg: { label: "Wikipedia, Oleg dance", url: "https://en.wikipedia.org/wiki/Oleg_dance" },
  cendrawasih: { label: "Wikipedia, Cendrawasih dance", url: "https://en.wikipedia.org/wiki/Cendrawasih_dance" },
  margapati: { label: "Bali Taksu, Tari Marga Pati", url: "https://balitaksu.com/?p=11010" },
} as const satisfies Record<string, { label: string; url: string }>;

export type IdSumber = keyof typeof SUMBER;

export type IdKategori = "kreasi" | "penyambutan" | "klasik" | "dasar";

export type Kategori = {
  id: IdKategori;
  nama: string;
  ringkas: string;
  /** Kelas Tailwind latar kartu (warna gelap, teks putih). */
  latar: string;
};

export const KATEGORI: readonly Kategori[] = [
  { id: "kreasi", nama: "Tari Kreasi", ringkas: "Garapan baru dari pakem tradisi", latar: "bg-kat-kreasi" },
  { id: "penyambutan", nama: "Tari Penyambutan", ringkas: "Pembuka acara, penyambut tamu", latar: "bg-kat-penyambutan" },
  { id: "klasik", nama: "Tari Pertunjukan", ringkas: "Balih-balihan dan tari putra", latar: "bg-kat-klasik" },
  { id: "dasar", nama: "Gerak Dasar", ringkas: "Agem, tandang, tangkis, tangkep", latar: "bg-kat-dasar" },
];

/** Gaya gambar sampul kelas (lihat IlustrasiPose). */
export type IdPose =
  | "janger"
  | "sayap"
  | "berpasangan"
  | "gagah"
  | "bokor"
  | "anjali"
  | "kipas"
  | "goyang"
  | "prajurit"
  | "duduk"
  | "agem"
  | "miles"
  | "ngumbang"
  | "nyeregseg"
  | "seledet"
  | "nerudut";

export type MateriKelas = {
  /** Video guru, relatif terhadap BASE_URL. */
  video: string;
  /** JSON pelajaran (deret fitur guru) buatan halaman Untuk Guru, relatif terhadap BASE_URL. */
  pelajaran: string;
  durasiDetik: number;
  judulAsli: string;
  kanal: string;
  /** Tempat video aslinya diterbitkan, mis. "YouTube". */
  platform: string;
  /** Tautan video asli; ditampilkan di kredit bila sudah diisi. */
  tautanAsli?: string;
  lisensi: SumberVideo["lisensi"];
};

export type KelasTari = {
  id: string;
  nama: string;
  kategori: IdKategori;
  tingkat: "Pemula" | "Menengah" | "Lanjut";
  penari: "Putri" | "Putra" | "Putra & putri";
  ringkas: string;
  sumber: readonly IdSumber[];
  /** Unsur yang paling ditonjolkan kelas ini. */
  unsur: readonly Unsur[];
  pose: IdPose;
  /** Busana kamen pada gambar sampul. */
  kamen: boolean;
  /** Materi milik kelas ini; null = belum ada, latihan memakai MATERI_CONTOH. */
  materi: MateriKelas | null;
};

/**
 * Satu-satunya materi yang ada sekarang. Keputusan ketua tim 7 Nov 2026: video YouTube ini dipakai di
 * situs publik sebagai contoh untuk prototipe MVP lomba, dengan keterangan hak cipta di bawah video;
 * untuk produksi diganti video berizin. Izin pemilik masih diminta (docs/05 bagian 4.6).
 */
export const MATERI_CONTOH: MateriKelas = {
  video: "video/tari-kreasi-janger.mp4",
  pelajaran: "lessons/tari-kreasi-janger.json",
  durasiDetik: 172.5,
  judulAsli: "Tari Kreasi JANGER Bali | Tari Kreasi Bali gerakan mudah",
  kanal: "Puputdhe",
  platform: "YouTube",
  // tautanAsli: diisi ketua tim; tidak ditebak.
  lisensi: "izin-diminta",
};

/** Kalimat hak cipta di bawah video guru, sesuai status lisensinya (docs/05 bagian 4.6). */
export function keteranganHakCipta(m: MateriKelas): string {
  switch (m.lisensi) {
    case "izin-diminta":
      return `Video ini milik ${m.kanal} dan diambil dari ${m.platform}. Ngigel memakainya sebagai contoh gerak untuk prototipe MVP lomba, bukan untuk tujuan komersial. Hak cipta tetap milik pemiliknya; izin sedang kami minta, dan video akan dihapus bila pemilik keberatan.`;
    case "izin-tertulis":
      return `Video milik ${m.kanal}, dipakai dengan izin tertulis pemiliknya.`;
    case "milik-guru":
      return `Video milik ${m.kanal}.`;
    default:
      return `Video oleh ${m.kanal}, lisensi ${m.lisensi}.`;
  }
}

export const DAFTAR_KELAS: readonly KelasTari[] = [
  {
    id: "tari-kreasi-janger",
    nama: "Tari Kreasi Janger",
    kategori: "kreasi",
    tingkat: "Pemula",
    penari: "Putri",
    ringkas:
      "Janger adalah tari pergaulan muda-mudi Bali yang dibawakan sambil bernyanyi bersahutan. Kelas ini memakai versi kreasi dengan gerakan mudah.",
    sumber: ["janger"],
    unsur: ["agem", "tangkis", "tandang", "tangkep"],
    pose: "janger",
    kamen: true,
    materi: MATERI_CONTOH,
  },
  {
    id: "tari-cendrawasih",
    nama: "Tari Cendrawasih",
    kategori: "kreasi",
    tingkat: "Menengah",
    penari: "Putri",
    ringkas: "Terinspirasi gerak burung cendrawasih. Dua penari putri memerankan burung betina dan jantan.",
    sumber: ["cendrawasih"],
    unsur: ["tangkis", "tandang"],
    pose: "sayap",
    kamen: true,
    materi: null,
  },
  {
    id: "oleg-tamulilingan",
    nama: "Oleg Tamulilingan",
    kategori: "kreasi",
    tingkat: "Lanjut",
    penari: "Putra & putri",
    ringkas: "Tari berpasangan tentang sepasang kumbang (tamulilingan) yang bercengkerama di taman bunga.",
    sumber: ["oleg"],
    unsur: ["tangkis", "tangkep"],
    pose: "berpasangan",
    kamen: true,
    materi: null,
  },
  {
    id: "tari-margapati",
    nama: "Tari Margapati",
    kategori: "kreasi",
    tingkat: "Menengah",
    penari: "Putri",
    ringkas: "Penari putri membawakan karakter gagah: raja hutan yang bersiap menerkam mangsanya.",
    sumber: ["margapati"],
    unsur: ["agem", "tangkep"],
    pose: "gagah",
    kamen: true,
    materi: null,
  },
  {
    id: "tari-pendet",
    nama: "Tari Pendet",
    kategori: "penyambutan",
    tingkat: "Pemula",
    penari: "Putri",
    ringkas:
      "Tari penyambutan. Penari membawa bokor berisi bunga lalu menaburkannya kepada tamu. Di sanggar diajarkan sesudah gerak dasar.",
    sumber: ["pendet", "igel2023"],
    unsur: ["agem", "tangkis"],
    pose: "bokor",
    kamen: true,
    materi: null,
  },
  {
    id: "tari-panyembrama",
    nama: "Tari Panyembrama",
    kategori: "penyambutan",
    tingkat: "Pemula",
    penari: "Putri",
    ringkas: "Tari penyambutan tamu. Bersama Tari Pendet, diajarkan sanggar sesudah murid menguasai gerak dasar.",
    sumber: ["panyembrama", "igel2023"],
    unsur: ["agem", "tangkis"],
    pose: "bokor",
    kamen: true,
    materi: null,
  },
  {
    id: "tari-puspanjali",
    nama: "Tari Puspanjali",
    kategori: "penyambutan",
    tingkat: "Pemula",
    penari: "Putri",
    ringkas: "Tari penyambutan yang menggambarkan penghormatan kepada tamu. Namanya dari puspa (bunga) dan anjali (penghormatan).",
    sumber: ["puspanjali"],
    unsur: ["agem", "tangkep"],
    pose: "anjali",
    kamen: true,
    materi: null,
  },
  {
    id: "tari-sekar-jagat",
    nama: "Tari Sekar Jagat",
    kategori: "penyambutan",
    tingkat: "Menengah",
    penari: "Putri",
    ringkas: "Tari penyambutan tamu yang tergolong baru dan bersifat sekuler, bukan untuk upacara.",
    sumber: ["sekarJagat"],
    unsur: ["tangkis", "tandang"],
    pose: "miles",
    kamen: true,
    materi: null,
  },
  {
    id: "legong-kraton",
    nama: "Legong Kraton",
    kategori: "klasik",
    tingkat: "Lanjut",
    penari: "Putri",
    ringkas: "Tari balih-balihan (pertunjukan). Satu dari sembilan tari Bali yang diakui UNESCO pada 2015.",
    sumber: ["unesco2015"],
    unsur: ["agem", "tangkis", "tangkep"],
    pose: "kipas",
    kamen: true,
    materi: null,
  },
  {
    id: "joged-bumbung",
    nama: "Joged Bumbung",
    kategori: "klasik",
    tingkat: "Menengah",
    penari: "Putra & putri",
    ringkas: "Tari pergaulan berpasangan dari genre balih-balihan, juga termasuk sembilan tari Bali yang diakui UNESCO pada 2015.",
    sumber: ["unesco2015"],
    unsur: ["tandang", "tangkep"],
    pose: "goyang",
    kamen: true,
    materi: null,
  },
  {
    id: "baris-tunggal",
    nama: "Baris Tunggal",
    kategori: "klasik",
    tingkat: "Pemula",
    penari: "Putra",
    ringkas: "Mengisahkan pemuda gagah berani dengan sikap keprajuritan. Sering dijadikan pendidikan dasar tari putra.",
    sumber: ["batarirupa2022"],
    unsur: ["agem", "tandang", "tangkep"],
    pose: "prajurit",
    kamen: false,
    materi: null,
  },
  {
    id: "kebyar-duduk",
    nama: "Kebyar Duduk",
    kategori: "klasik",
    tingkat: "Lanjut",
    penari: "Putra",
    ringkas: "Dibawakan dalam posisi duduk dan setengah duduk. Karya I Ketut Marya (I Mario), pertama dipentaskan 1925.",
    sumber: ["kebyarDuduk"],
    unsur: ["tangkis", "tangkep"],
    pose: "duduk",
    kamen: false,
    materi: null,
  },
  {
    id: "gerak-agem",
    nama: "Agem",
    kategori: "dasar",
    tingkat: "Pemula",
    penari: "Putra & putri",
    ringkas: "Sikap pokok tari Bali yang menunjukkan ciri khas suatu tarian.",
    sumber: ["igel2023"],
    unsur: ["agem"],
    pose: "agem",
    kamen: true,
    materi: null,
  },
  {
    id: "gerak-miles-agem",
    nama: "Miles-agem",
    kategori: "dasar",
    tingkat: "Pemula",
    penari: "Putri",
    ringkas: "Rangkaian gerak dengan kedua lengan diangkat setinggi bahu.",
    sumber: ["igel2023"],
    unsur: ["agem"],
    pose: "miles",
    kamen: true,
    materi: null,
  },
  {
    id: "gerak-ngumbang",
    nama: "Ngumbang",
    kategori: "dasar",
    tingkat: "Pemula",
    penari: "Putra & putri",
    ringkas: "Bagian dari tandang: perpindahan gerak tari mengikuti pola lantai.",
    sumber: ["igel2023"],
    unsur: ["tandang"],
    pose: "ngumbang",
    kamen: true,
    materi: null,
  },
  {
    id: "gerak-nyeregseg",
    nama: "Nyeregseg",
    kategori: "dasar",
    tingkat: "Menengah",
    penari: "Putri",
    ringkas: "Gerak kaki ke samping kanan dan kiri yang dipercepat, dengan tumit menjinjit.",
    sumber: ["igel2023"],
    unsur: ["tandang"],
    pose: "nyeregseg",
    kamen: true,
    materi: null,
  },
  {
    id: "gerak-seledet",
    nama: "Seledet",
    kategori: "dasar",
    tingkat: "Pemula",
    penari: "Putra & putri",
    ringkas: "Gerak mata ke samping kanan dan kiri, disertai gerak dagu dan muka. Bagian dari tangkep (ekspresi).",
    sumber: ["igel2023"],
    unsur: ["tangkep"],
    pose: "seledet",
    kamen: true,
    materi: null,
  },
  {
    id: "gerak-luk-nerudut",
    nama: "Luk Nerudut",
    kategori: "dasar",
    tingkat: "Menengah",
    penari: "Putri",
    ringkas: "Kedua telapak tangan turun dan naik bersamaan dengan naik-turunnya lutut.",
    sumber: ["igel2023"],
    unsur: ["tangkis"],
    pose: "nerudut",
    kamen: true,
    materi: null,
  },
];

export const cariKelas = (id: string | undefined): KelasTari | undefined => DAFTAR_KELAS.find((k) => k.id === id);

export const namaKategori = (id: IdKategori): string => KATEGORI.find((k) => k.id === id)?.nama ?? id;

/** Materi yang dipakai saat latihan; kelas tanpa materi sendiri memakai video contoh. */
export function materiLatihan(kelas: KelasTari): { materi: MateriKelas; contoh: boolean } {
  return kelas.materi ? { materi: kelas.materi, contoh: false } : { materi: MATERI_CONTOH, contoh: true };
}

/** Huruf kecil tanpa tanda baca, untuk pencarian yang memaafkan ("Legong kraton" = "legong-kraton"). */
const ratakan = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();

export type SaringanKelas = { kata?: string; kategori?: IdKategori | "semua"; tingkat?: KelasTari["tingkat"] | "semua" };

/** Kelas yang cocok dengan kata kunci (nama, ringkasan, kategori, unsur), kategori, dan tingkat. */
export function saringKelas(kelas: readonly KelasTari[], s: SaringanKelas): KelasTari[] {
  const kata = ratakan(s.kata ?? "")
    .split(" ")
    .filter(Boolean);
  return kelas.filter((k) => {
    if (s.kategori && s.kategori !== "semua" && k.kategori !== s.kategori) return false;
    if (s.tingkat && s.tingkat !== "semua" && k.tingkat !== s.tingkat) return false;
    const teks = ratakan([k.nama, k.ringkas, namaKategori(k.kategori), k.penari, ...k.unsur].join(" "));
    return kata.every((w) => teks.includes(w));
  });
}

/** "2:52" dari detik; dibulatkan ke bawah seperti pemutar video. */
export function formatDurasi(detik: number): string {
  const total = Math.max(0, Math.floor(detik + 1e-6));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
