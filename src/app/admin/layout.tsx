import Header from "@/components/header";
import { isCommittee, requireStaff } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireStaff();
  const items = isCommittee(profile)
    ? [
        { href: "/admin", label: "Summary" },
        { href: "/admin/trends", label: "Trends" },
        { href: "/admin/menu", label: "Menu" },
        { href: "/admin/quality", label: "Quality" },
        { href: "/admin/feedback", label: "Feedback" },
        { href: "/admin/snacks", label: "Snacks" },
        { href: "/admin/kiosk", label: "Kiosk" },
        { href: "/admin/students", label: "Students" },
        { href: "/admin/updates", label: "Updates" },
      ]
    : [
        { href: "/admin/snacks", label: "Snacks" },
        { href: "/", label: "Menu" },
      ];

  return (
    <>
      <Header profile={profile} items={items} home="/admin" badge={isCommittee(profile) ? "Committee" : "Staff"} />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-5 lg:pb-10">{children}</main>
    </>
  );
}
