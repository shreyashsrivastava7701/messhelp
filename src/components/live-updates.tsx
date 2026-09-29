"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isoDateIST } from "@/lib/dates";

type Toast = { id: number; text: string };

/**
 * Step 4: listen for menu, announcement and quality-check changes and refresh the
 * page the moment they happen, with a small banner (and a system notification if
 * the tab is in the background and the student allowed notifications).
 */
export default function LiveUpdates() {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let n = 0;

    const announce = (text: string) => {
      const id = ++n;
      setToasts((t) => [...t.filter((x) => x.text !== text), { id, text }].slice(-3));
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        new Notification("Chachu ka Mittar", { body: text, icon: "/favicon.ico" });
      }
      // Several rows change in one save; refresh once after they settle.
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 400);
    };

    const today = isoDateIST();
    const channel = supabase
      .channel("messmate-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "meals" }, (p) => {
        const row = (p.new ?? p.old) as { menu_date?: string };
        announce(row?.menu_date === today ? "Today's menu was just updated" : "The menu was updated");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () => announce("The menu was updated"))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "announcements" }, (p) =>
        announce(`📣 ${(p.new as { title?: string }).title ?? "New update from the mess"}`),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "quality_checks" }, () =>
        announce("A quality check was just posted"),
      )
      .subscribe();

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-30 flex flex-col items-center gap-2 px-4" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto rounded-full bg-stone-900 px-4 py-2 text-sm text-white shadow-lg">
          {t.text}
        </div>
      ))}
    </div>
  );
}
