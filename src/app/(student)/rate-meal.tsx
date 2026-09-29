"use client";

import { useState, useTransition } from "react";
import type { Tag } from "@/lib/types";
import { rateMeal } from "./actions";

type Status = "idle" | "saving" | "saved" | "error";

/** Tap a star and it's saved. Tags and a comment are optional extras. */
export default function RateMeal({
  mealId,
  tags,
  initial,
}: {
  mealId: string;
  tags: Tag[];
  initial: { stars: number; tags: string[]; comment: string | null } | null;
}) {
  const [stars, setStars] = useState(initial?.stars ?? 0);
  const [picked, setPicked] = useState<string[]>(initial?.tags ?? []);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [showComment, setShowComment] = useState(!!initial?.comment);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const save = (next: { stars?: number; tags?: string[]; comment?: string }) => {
    const payload = {
      mealId,
      stars: next.stars ?? stars,
      tags: next.tags ?? picked,
      comment: next.comment ?? comment,
    };
    if (!payload.stars) return;
    setStatus("saving");
    startTransition(async () => {
      const result = await rateMeal(payload);
      if (result.ok) {
        setStatus("saved");
        setError(null);
      } else {
        setStatus("error");
        setError(result.error);
      }
    });
  };

  const tapStar = (n: number) => {
    setStars(n);
    save({ stars: n });
  };

  const toggleTag = (slug: string) => {
    const next = picked.includes(slug) ? picked.filter((t) => t !== slug) : [...picked, slug];
    setPicked(next);
    save({ tags: next });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex" role="radiogroup" aria-label="Rate this meal">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={stars === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => tapStar(n)}
              className={`px-0.5 text-2xl leading-none transition active:scale-90 ${n <= stars ? "text-amber-400" : "text-stone-300 hover:text-amber-200"}`}
            >
              ★
            </button>
          ))}
        </div>
        <span className="text-xs text-stone-500">
          {status === "saving" && "Saving…"}
          {status === "saved" && "Saved ✓"}
          {status === "idle" && (stars ? "Your rating" : "Tap to rate")}
        </span>
      </div>

      {stars > 0 && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const on = picked.includes(tag.slug);
              const tone =
                tag.sentiment === "positive"
                  ? on
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-emerald-200 text-emerald-700"
                  : on
                    ? "border-rose-600 bg-rose-600 text-white"
                    : "border-rose-200 text-rose-700";
              return (
                <button
                  key={tag.slug}
                  type="button"
                  onClick={() => toggleTag(tag.slug)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition ${tone}`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>

          {showComment ? (
            <div className="flex gap-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onBlur={() => comment !== (initial?.comment ?? "") && save({})}
                maxLength={500}
                placeholder="Anything else? (optional)"
                className="min-w-0 flex-1 rounded-md border border-stone-300 px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => save({})}
                className="rounded-md bg-stone-800 px-3 text-xs font-medium text-white"
              >
                Send
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setShowComment(true)} className="text-xs text-stone-500 hover:underline">
              + Add a comment
            </button>
          )}
        </>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
