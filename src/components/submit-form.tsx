"use client";

import { useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/app/admin/actions";

/** A form wired to a server action that clears itself after a successful save. */
export default function SubmitForm({
  action,
  children,
  submitLabel,
  className,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.at, state.ok]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && !pending && <span className="text-sm text-emerald-700">Done ✓</span>}
      </div>
    </form>
  );
}
