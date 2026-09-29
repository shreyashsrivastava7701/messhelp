"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { authenticate, type AuthState } from "./actions";

type Portal = "student" | "admin";

export default function LoginForm() {
  const [portal, setPortal] = useState<Portal>("student");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [state, action, pending] = useActionState<AuthState, FormData>(authenticate, {});
  const signingUp = portal === "student" && mode === "signup";

  return (
    <div>
      <div className="mb-6 grid grid-cols-3 rounded-xl bg-stone-200/70 p-1 text-xs font-medium sm:text-sm">
        {(["student", "admin"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setPortal(p);
              setMode("signin");
            }}
            className={`rounded-lg px-1 py-2 transition ${portal === p ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
          >
            {p === "student" ? "Student" : "Mess committee"}
          </button>
        ))}
        <Link href="/kiosk" className="rounded-lg px-1 py-2 text-center text-stone-500 transition hover:text-stone-700">
          Snack counter
        </Link>
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="portal" value={portal} />
        <input type="hidden" name="mode" value={mode} />

        {signingUp && (
          <>
            <Field label="Roll number" name="roll_no" type="text" placeholder="e.g. 22CS001" required />
            <Field label="Full name" name="full_name" type="text" autoComplete="name" required />
          </>
        )}
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete={signingUp ? "new-password" : "current-password"}
          minLength={6}
          required
        />

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.message && <p className="text-sm text-emerald-700">{state.message}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "Please wait…" : signingUp ? "Create student account" : "Sign in"}
        </button>

        {portal === "student" ? (
          <p className="text-center text-sm text-stone-500">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="font-medium text-emerald-700 hover:underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        ) : (
          <p className="text-center text-xs text-stone-500">
            First time? Create an account on the Student tab, then ask the mess admin to make it a committee or staff account.
          </p>
        )}
      </form>
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <input
        {...props}
        className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}
