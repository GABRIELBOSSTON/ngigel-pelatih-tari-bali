import { Link } from "react-router";
import IlustrasiPose from "../katalog/IlustrasiPose";

export default function TidakDitemukan() {
  return (
    <section className="mx-auto max-w-xl px-4 py-16 text-center">
      <IlustrasiPose pose="seledet" warna="#7a1416" sendi={false} className="mx-auto h-40" />
      <h1 className="mt-4 text-2xl font-extrabold">Halaman tidak ditemukan</h1>
      <p className="mt-1 text-stone-600">Mungkin alamatnya salah ketik, atau halamannya sudah pindah.</p>
      <Link to="/" className="mt-6 inline-block rounded-xl bg-kunyit px-5 py-2.5 font-bold text-white hover:bg-kunyit-gelap">
        Kembali ke etalase
      </Link>
    </section>
  );
}
