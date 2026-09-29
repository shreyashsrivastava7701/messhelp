import Header from "@/components/header";
import LiveUpdates from "@/components/live-updates";
import { isStaffOrCommittee, requireProfile } from "@/lib/auth";

const ITEMS = [
  { href: "/", label: "Menu" },
  { href: "/updates", label: "Updates" },
  { href: "/my-food", label: "My food" },
];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const items = isStaffOrCommittee(profile) ? [...ITEMS, { href: "/admin", label: "Admin" }] : ITEMS;

  return (
    <>
      <Header profile={profile} items={items} home="/" />
      <LiveUpdates />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-5 lg:pb-10">{children}</main>
    </>
  );
}
