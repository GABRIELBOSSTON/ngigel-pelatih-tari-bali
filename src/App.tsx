import { lazy, Suspense } from "react";
import { Outlet, Route, Routes } from "react-router";
import Layout from "./components/Layout";
import Beranda from "./pages/Beranda";
import Hasil from "./pages/Hasil";
import Latihan from "./pages/Latihan";
import Riwayat from "./pages/Riwayat";
import TidakDitemukan from "./pages/TidakDitemukan";

// Halaman yang jarang dibuka murid dimuat terpisah, supaya etalase dan studio lebih cepat terbuka.
const Guru = lazy(() => import("./pages/Guru"));
const Tentang = lazy(() => import("./pages/Tentang"));
const UjiKamera = lazy(() => import("./pages/UjiKamera"));
const UjiVideo = lazy(() => import("./pages/UjiVideo"));

function Memuat() {
  return (
    <p role="status" className="px-4 py-16 text-center text-sm text-stone-600">
      Memuat halaman…
    </p>
  );
}

/** Wadah lebar sedang untuk halaman formulir dan alat uji. */
function Wadah() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
      <Suspense fallback={<Memuat />}>
        <Outlet />
      </Suspense>
    </div>
  );
}

// Rute mengikuti docs/03_FLOW_PROYEK.md bagian B.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Beranda />} />
        <Route path="latihan/:kelasId" element={<Latihan />} />
        <Route path="hasil/:sesiId" element={<Hasil />} />
        <Route path="riwayat" element={<Riwayat />} />
        <Route
          path="tentang"
          element={
            <Suspense fallback={<Memuat />}>
              <Tentang />
            </Suspense>
          }
        />
        <Route element={<Wadah />}>
          <Route path="guru" element={<Guru />} />
          {/* Alat uji pengembang (docs/06, docs/09); tidak ditautkan dari navigasi utama. */}
          <Route path="uji-kamera" element={<UjiKamera />} />
          <Route path="uji-video" element={<UjiVideo />} />
        </Route>
        <Route path="*" element={<TidakDitemukan />} />
      </Route>
    </Routes>
  );
}
