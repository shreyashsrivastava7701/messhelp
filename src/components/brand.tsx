import Image from "next/image";
import { APP_NAME, HOSTEL_NAME } from "@/lib/brand";

/** Top-left logo block: NIT Hamirpur logo, app name, hostel name. */
export default function Brand({ badge, size = "md" }: { badge?: string; size?: "md" | "lg" }) {
  const logo = size === "lg" ? 56 : 40;
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Image
        src="/nit-hamirpur-logo.png"
        alt="NIT Hamirpur logo"
        width={logo}
        height={logo}
        priority
        className="shrink-0 rounded-full"
      />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="flex items-center gap-2">
          <span className={`truncate font-bold text-emerald-700 ${size === "lg" ? "text-2xl" : "text-base"}`}>
            {APP_NAME}
          </span>
          {badge && (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
              {badge}
            </span>
          )}
        </span>
        <span className={`truncate text-stone-500 ${size === "lg" ? "text-sm" : "text-[11px]"}`}>{HOSTEL_NAME}</span>
      </span>
    </span>
  );
}
