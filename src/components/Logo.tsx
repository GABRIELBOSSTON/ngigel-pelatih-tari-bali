// Logo Ngigel: bunga jepun (kamboja) lima kelopak di atas merah bata, dengan pusat emas prada.
const KELOPAK = "M16 16 C12.6 11.4 13.4 5.6 17.6 4.2 C20.9 5.9 20.3 12 16 16 Z";

export function TandaNgigel({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="#7a1416" />
      <g fill="#faf6ee">
        {[0, 72, 144, 216, 288].map((sudut) => (
          <path key={sudut} d={KELOPAK} transform={`rotate(${sudut} 16 16)`} />
        ))}
      </g>
      <circle cx="16" cy="16" r="2.7" fill="#f6c453" />
    </svg>
  );
}

export default function Logo({ terang = false }: { terang?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <TandaNgigel />
      <span className={`text-[22px] font-extrabold tracking-tight ${terang ? "text-white" : "text-merah-tua"}`}>Ngigel</span>
      <span className="rounded-md bg-prada px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-tinta">AI</span>
    </span>
  );
}
