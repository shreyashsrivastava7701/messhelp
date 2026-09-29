import Link from "next/link";
import Brand from "@/components/brand";
import { signOut } from "@/app/login/actions";
import NavLinks, { type NavItem } from "@/components/nav-links";
import type { Profile } from "@/lib/types";

export default function Header({
  profile,
  items,
  home,
  badge,
}: {
  profile: Profile;
  items: NavItem[];
  home: string;
  badge?: string;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
        <Link href={home} className="min-w-0 shrink">
          <Brand badge={badge} />
        </Link>
        <NavLinks items={items} />
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-stone-500 md:inline">{profile.full_name}</span>
          <form action={signOut}>
            <button className="text-stone-500 hover:text-stone-900">Sign out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
