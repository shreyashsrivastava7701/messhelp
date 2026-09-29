"use client";

import { useEffect, useState } from "react";

/** Lets a student allow browser notifications for live updates while the tab is in the background. */
export default function NotifyButton() {
  const [state, setState] = useState<NotificationPermission | "unsupported" | null>(null);

  useEffect(() => {
    setState("Notification" in window ? Notification.permission : "unsupported");
  }, []);

  if (state === null || state === "unsupported") return null;
  if (state === "granted") return <p className="text-xs text-emerald-700">🔔 Notifications are on for this browser.</p>;
  if (state === "denied")
    return <p className="text-xs text-stone-500">Notifications are blocked in your browser settings for this site.</p>;
  return (
    <button
      type="button"
      onClick={async () => setState(await Notification.requestPermission())}
      className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
    >
      🔔 Notify me about menu changes
    </button>
  );
}
