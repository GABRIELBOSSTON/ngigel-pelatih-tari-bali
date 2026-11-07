import { useEffect, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router";
import { bacaRiwayat } from "../latihan/riwayat";
import Logo from "./Logo";

const menu = [
  { ke: "/", label: "Etalase" },
  { ke: "/riwayat", label: "Riwayat" },
  { ke: "/guru", label: "Untuk Guru" },
  { ke: "/tentang", label: "Tentang" },
];

function IkonCari({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7.5" />
      <path strokeLinecap="round" d="M21 21l-4.6-4.6" />
    </svg>
  );
}

/** Kotak cari berbentuk pil. Mengisi ?cari= di Beranda, tempat etalase menyaring kelas. */
function KotakCari({ className = "" }: { className?: string }) {
  const [param] = useSearchParams();
  const lokasi = useLocation();
  const pindah = useNavigate();
  const [kata, setKata] = useState(param.get("cari") ?? "");

  // Ikuti URL bila pengguna kembali/maju di riwayat peramban.
  useEffect(() => {
    if (lokasi.pathname === "/") setKata(param.get("cari") ?? "");
  }, [param, lokasi.pathname]);

  const kirim = (e: FormEvent) => {
    e.preventDefault();
    const q = kata.trim();
    void pindah({ pathname: "/", search: q ? `?cari=${encodeURIComponent(q)}` : "", hash: "#kelas" });
  };

  return (
    <form role="search" onSubmit={kirim} className={`flex h-11 items-center gap-2.5 rounded-full bg-pasir/70 px-4 ring-merah-tua/30 focus-within:ring-2 ${className}`}>
      <IkonCari className="h-4 w-4 shrink-0 text-stone-500" />
      <label className="sr-only" htmlFor="cari-kelas">
        Cari kelas tari
      </label>
      <input
        id="cari-kelas"
        type="search"
        value={kata}
        onChange={(e) => setKata(e.target.value)}
        placeholder="Cari tarian, gerak dasar, atau unsur…"
        className="w-full bg-transparent text-sm text-tinta placeholder:text-stone-500 focus:outline-none"
      />
    </form>
  );
}

export default function Layout() {
  const lokasi = useLocation();
  const [jumlahRiwayat, setJumlahRiwayat] = useState(0);
  // Riwayat dibaca ulang setiap pindah halaman (mis. sesudah latihan selesai).
  useEffect(() => setJumlahRiwayat(bacaRiwayat().length), [lokasi.pathname]);

  // Gulir ke #kelas sesudah pencarian, atau ke atas halaman saat pindah rute.
  useEffect(() => {
    if (lokasi.hash) document.getElementById(lokasi.hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
    else window.scrollTo({ top: 0 });
  }, [lokasi.pathname, lokasi.hash, lokasi.search]);

  return (
    <div className="flex min-h-screen flex-col text-tinta">
      <a href="#isi" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
        Lompat ke isi
      </a>
      <div className="bg-hutan px-4 py-2 text-center text-xs font-medium text-white">
        <span>
          Gratis untuk murid dan sanggar <span className="text-prada">✦</span> Kamera diproses di perangkat Anda, tidak dikirim ke server
        </span>
        <span className="hidden lg:inline">
          {" "}
          <span className="text-prada">✦</span> AI Web Innovation Challenge · Bali DigiFest 2026
        </span>
      </div>

      <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" aria-label="Ngigel, ke etalase" className="shrink-0">
            <Logo />
          </Link>
          <KotakCari className="hidden max-w-lg flex-1 md:flex" />
          <nav aria-label="Navigasi utama">
            <ul className="flex items-center gap-1 text-sm font-semibold sm:gap-2">
              {menu.map((m) => (
                <li key={m.ke} className={m.ke === "/riwayat" || m.ke === "/" ? "" : "hidden sm:block"}>
                  <NavLink
                    to={m.ke}
                    end={m.ke === "/"}
                    className={({ isActive }) =>
                      `relative flex items-center gap-1.5 rounded-full px-3 py-2 transition ${isActive ? "bg-merah-tua text-white" : "text-stone-700 hover:bg-pasir hover:text-merah-tua"}`
                    }
                  >
                    {m.label}
                    {m.ke === "/riwayat" && jumlahRiwayat > 0 && (
                      <span className="rounded-full bg-kunyit px-1.5 text-[10px] leading-4 font-bold text-white">{jumlahRiwayat}</span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="px-4 pb-3 md:hidden">
          <KotakCari />
        </div>
        <div className="poleng h-1.5 opacity-90" aria-hidden="true" />
      </header>

      <main id="isi" className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 bg-hutan text-white">
        <div className="poleng h-1.5" aria-hidden="true" />
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
          <div className="space-y-3">
            <Logo terang />
            <p className="text-sm text-white/80">Berlatih tari Bali di depan kamera, dengan koreksi AI per unsur agem, tandang, tangkis, dan tangkep.</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-bold text-prada">Jelajahi</p>
            <ul className="space-y-1.5 text-sm text-white/85">
              <li><Link className="hover:text-white hover:underline" to="/">Etalase kelas</Link></li>
              <li><Link className="hover:text-white hover:underline" to="/riwayat">Riwayat latihan</Link></li>
              <li><Link className="hover:text-white hover:underline" to="/guru">Untuk guru sanggar</Link></li>
              <li><Link className="hover:text-white hover:underline" to="/tentang">Tentang, sumber, dan kredit</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-bold text-prada">Privasi</p>
            <p className="text-sm text-white/85">
              Video kamera diproses di perangkat ini dan tidak dikirim ke server. Riwayat nilai hanya tersimpan di peramban Anda dan bisa dihapus kapan saja dari halaman Riwayat.
            </p>
          </div>
        </div>
        <p className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/70">AI Web Innovation Challenge · Bali DigiFest 2026 · Tim Sekaa Kode</p>
      </footer>
    </div>
  );
}
