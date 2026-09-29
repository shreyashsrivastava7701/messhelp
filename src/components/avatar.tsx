/* eslint-disable @next/next/no-img-element -- photos come from any URL the committee enters */
export default function Avatar({ src, name, size = 36 }: { src: string | null; name: string; size?: number }) {
  return src ? (
    <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full bg-stone-100 object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800"
      style={{ width: size, height: size }}
    >
      {name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
