"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Avatar from "@/components/avatar";
import Brand from "@/components/brand";
import { formatClockIST } from "@/lib/dates";
import { describeFace, findMatch, loadFaceApi, loadImage } from "@/lib/face";
import { createClient } from "@/lib/supabase/client";

type Person = {
  roll_no: string;
  full_name: string;
  room_no: string | null;
  photo_url: string | null;
  descriptor: number[] | null;
  face_photo_url?: string | null; // the photo the face data was made from
  taken_today: string | null;
};

type Result =
  | { kind: "logged" | "already"; person: Person; at: string }
  | { kind: "confirm"; person: Person }
  | { kind: "noface" | "nomatch" | "error"; message: string };

type Mode = "face" | "id";

const PIN_KEY = "kiosk-pin";
const PIN_ERRORS: Record<string, string> = {
  bad_pin: "That PIN is wrong.",
  locked: "Too many wrong PINs. The kiosk is locked for 15 minutes.",
  not_set: "The committee hasn't set a kiosk PIN yet (Committee portal > Kiosk).",
};

function readPin() {
  try {
    return localStorage.getItem(PIN_KEY);
  } catch {
    return null;
  }
}
function writePin(pin: string | null) {
  try {
    if (pin) localStorage.setItem(PIN_KEY, pin);
    else localStorage.removeItem(PIN_KEY);
  } catch {
    // Private window: the PIN just isn't remembered.
  }
}

export default function Kiosk() {
  const supabase = useRef(createClient()).current;
  const [pin, setPin] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [roster, setRoster] = useState<Person[] | null>(null);
  const [faceReady, setFaceReady] = useState<"loading" | "ready" | "failed">("loading");
  const [mode, setMode] = useState<Mode>("face");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [camIndex, setCamIndex] = useState(0);
  const camerasRef = useRef<MediaDeviceInfo[]>([]);
  const [learning, setLearning] = useState<{ done: number; total: number } | null>(null);
  const learningRef = useRef(false);
  const failedRef = useRef(new Set<string>());
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => setPin(readPin()), []);

  const lock = useCallback((message: string | null) => {
    writePin(null);
    setPin(null);
    setRoster(null);
    setPinError(message);
  }, []);

  // Roster (names, photos, face data), refreshed every 3 minutes.
  useEffect(() => {
    if (!pin) return;
    let stop = false;
    const load = async () => {
      const { data, error } = await supabase.rpc("kiosk_roster", { p_pin: pin });
      if (stop) return;
      if (error) {
        setPinError(
          error.message.includes("kiosk_roster")
            ? "The kiosk isn't set up in the database yet. Run the kiosk SQL file in Supabase."
            : `Can't reach the server: ${error.message}`,
        );
        return;
      }
      if (data?.error) return lock(PIN_ERRORS[data.error] ?? "The kiosk PIN didn't work.");
      writePin(pin);
      setRoster(data.students as Person[]);
    };
    load();
    const t = setInterval(load, 180_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [pin, supabase, lock]);

  // Face models load in the background; ID scanning works without them.
  useEffect(() => {
    if (!roster) return;
    loadFaceApi().then(
      () => setFaceReady("ready"),
      (e) => {
        console.error("Face models failed to load", e);
        setFaceReady("failed");
      },
    );
  }, [roster]);

  // Learn faces by itself: make face data for every student whose roster photo is
  // new or changed since last time. Runs quietly in the background; students can
  // keep using the kiosk meanwhile. New students are picked up on the next refresh.
  useEffect(() => {
    if (!roster || !pin || faceReady !== "ready" || learningRef.current) return;
    const todo = roster.filter(
      (p) =>
        p.photo_url &&
        (!p.descriptor || p.face_photo_url !== p.photo_url) &&
        !failedRef.current.has(`${p.roll_no}|${p.photo_url}`),
    );
    if (!todo.length) return;
    learningRef.current = true;
    (async () => {
      let batch: { roll_no: string; photo_url: string; descriptor: number[] }[] = [];
      const flush = async () => {
        if (!batch.length) return;
        const rows = batch;
        batch = [];
        await supabase.rpc("kiosk_save_faces", { p_pin: pin, p_rows: rows });
        setRoster((r) =>
          r?.map((p) => {
            const row = rows.find((x) => x.roll_no === p.roll_no);
            return row ? { ...p, descriptor: row.descriptor, face_photo_url: row.photo_url } : p;
          }) ?? r,
        );
      };
      for (let i = 0; i < todo.length; i++) {
        setLearning({ done: i, total: todo.length });
        const s = todo[i];
        try {
          const res = await fetch(`/api/face-photo?roll=${encodeURIComponent(s.roll_no)}`, {
            headers: { "x-kiosk-pin": pin },
          });
          if (!res.ok) throw new Error(await res.text());
          const blobUrl = URL.createObjectURL(await res.blob());
          try {
            const descriptor = await describeFace(await loadImage(blobUrl), 0.3);
            if (!descriptor) throw new Error("no face in photo");
            batch.push({ roll_no: s.roll_no, photo_url: s.photo_url!, descriptor });
          } finally {
            URL.revokeObjectURL(blobUrl);
          }
        } catch (e) {
          failedRef.current.add(`${s.roll_no}|${s.photo_url}`);
          console.warn(`No face data for ${s.roll_no}:`, (e as Error).message);
        }
        if (batch.length >= 10) await flush();
      }
      await flush().catch(() => {});
      setLearning(null);
      learningRef.current = false;
    })();
  }, [roster, pin, faceReady, supabase]);

  // Camera.
  const ready = !!roster;
  useEffect(() => {
    if (!ready) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    const deviceId = camerasRef.current[camIndex]?.deviceId;
    navigator.mediaDevices
      ?.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user", width: { ideal: 1280 } },
        audio: false,
      })
      .then(async (s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        setCameraError(null);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => {});
        }
        if (!camerasRef.current.length) {
          const all = await navigator.mediaDevices.enumerateDevices();
          camerasRef.current = all.filter((d) => d.kind === "videoinput");
          setCameras(camerasRef.current);
        }
      })
      .catch((e: Error) =>
        setCameraError(
          e.name === "NotAllowedError"
            ? "Camera permission was refused. Allow the camera for this site and reload."
            : `Camera not available: ${e.message}`,
        ),
      );
    if (!navigator.mediaDevices) setCameraError("This browser can't use the camera here (it needs https or localhost).");
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [ready, camIndex]);

  // Results clear themselves so the next student can go.
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), result.kind === "confirm" ? 12_000 : 4_000);
    return () => clearTimeout(t);
  }, [result]);

  const grabFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d", { willReadFrequently: true })!.drawImage(video, 0, 0);
    return canvas;
  };

  const logSnack = useCallback(
    async (person: Person, method: "face" | "qr") => {
      const { data, error } = await supabase.rpc("kiosk_log_snack", {
        p_pin: pin,
        p_roll_no: person.roll_no,
        p_method: method,
      });
      if (error) return setResult({ kind: "error", message: `Couldn't save: ${error.message}` });
      const status = data?.status as string;
      if (PIN_ERRORS[status]) return lock(PIN_ERRORS[status]);
      if (status === "unknown") return setResult({ kind: "error", message: "That student isn't in the roster." });
      if (status === "logged") {
        setRoster((r) => r?.map((p) => (p.roll_no === person.roll_no ? { ...p, taken_today: data.taken_at } : p)) ?? r);
      }
      setResult({ kind: status === "logged" ? "logged" : "already", person, at: data.taken_at });
    },
    [pin, supabase, lock],
  );

  const takePhoto = useCallback(async () => {
    if (busy || !roster) return;
    setBusy(true);
    setResult(null);
    try {
      const frame = grabFrame();
      if (!frame) return setResult({ kind: "error", message: "The camera isn't ready yet." });
      const probe = await describeFace(frame, 0.5);
      if (!probe) return setResult({ kind: "noface", message: "No face found. Look at the camera and try again." });
      const match = findMatch(probe, roster);
      if (!match)
        return setResult({ kind: "nomatch", message: "Face not recognised. Try again, or scan your ID card." });
      if (match.sure) await logSnack(match.item, "face");
      else setResult({ kind: "confirm", person: match.item });
    } catch (e) {
      setResult({ kind: "error", message: `Face check failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }, [busy, roster, logSnack]);

  // ID card scanning: read a frame every 300 ms until a code is found.
  useEffect(() => {
    if (mode !== "id" || !roster || result || busy) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const byLength = [...roster].sort((a, b) => b.roll_no.length - a.roll_no.length);
    (async () => {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const tick = async () => {
        if (stop) return;
        const frame = grabFrame();
        let text: string | null = null;
        if (frame) {
          try {
            text = reader.decodeFromCanvas(frame).getText();
          } catch {
            // No code in this frame.
          }
        }
        if (text && !stop) {
          const upper = text.toUpperCase();
          const person = byLength.find((p) => upper === p.roll_no.toUpperCase() || upper.includes(p.roll_no.toUpperCase()));
          setBusy(true);
          if (person) await logSnack(person, "qr");
          else setResult({ kind: "error", message: `Card read (${text.slice(0, 40)}), but no student has that roll number.` });
          setBusy(false);
          return;
        }
        timer = setTimeout(tick, 300);
      };
      tick();
    })();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [mode, roster, result, busy, logSnack]);

  // Space or Enter takes the photo, for a kiosk with a keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode === "face" && (e.key === " " || e.key === "Enter") && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        takePhoto();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, takePhoto]);

  if (!pin) return <PinScreen error={pinError} onSubmit={(p) => (setPinError(null), setPin(p))} />;

  const withFaces = roster?.filter((p) => p.descriptor).length ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <header className="flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3">
        <Brand size="lg" />
        <span className="hidden text-right text-sm font-medium text-stone-500 sm:block">Snack counter</span>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-5">
        <div className="flex overflow-hidden rounded-xl border border-stone-300 bg-white text-sm font-medium">
          {(["face", "id"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => (setMode(m), setResult(null))}
              className={`flex-1 px-4 py-3 ${mode === m ? "bg-emerald-600 text-white" : "text-stone-700 hover:bg-stone-50"}`}
            >
              {m === "face" ? "Face" : "ID card scan"}
            </button>
          ))}
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-[4/3] w-full object-cover"
            style={{ transform: mode === "face" ? "scaleX(-1)" : undefined }}
          />
          {mode === "id" && (
            <div className="pointer-events-none absolute inset-x-[12%] top-1/2 h-1/3 -translate-y-1/2 rounded-xl border-4 border-white/80" />
          )}
          {!roster && <Overlay>{pinError ?? "Loading students…"}</Overlay>}
          {cameraError && <Overlay>{cameraError}</Overlay>}
          {result && <ResultCard result={result} onYes={logSnack} onNo={() => setResult(null)} />}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        {mode === "face" ? (
          <button
            type="button"
            onClick={takePhoto}
            disabled={busy || faceReady !== "ready" || !!cameraError}
            className="rounded-2xl bg-emerald-600 px-6 py-5 text-xl font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
          >
            {faceReady === "loading" ? "Getting face check ready…" : busy ? "Checking…" : "📸 Take photo"}
          </button>
        ) : (
          <p className="rounded-2xl bg-white px-6 py-5 text-center text-lg text-stone-700 shadow-sm">
            Hold your ID card&apos;s barcode or QR code inside the box.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
          <span>
            {roster ? `${roster.length} students · ${withFaces} with face data` : ""}
            {faceReady === "failed" && " · face check couldn't load, use ID card"}
            {learning && ` · learning faces ${learning.done} / ${learning.total}`}
            {roster && !learning && withFaces === 0 && " · no faces learned yet (check photos on the Students page)"}
          </span>
          <span className="flex gap-3">
            {cameras.length > 1 && (
              <button type="button" className="hover:text-stone-900" onClick={() => setCamIndex((i) => (i + 1) % cameras.length)}>
                Switch camera
              </button>
            )}
            <button type="button" className="hover:text-stone-900" onClick={() => lock(null)}>
              Lock kiosk
            </button>
          </span>
        </div>
      </main>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-6 text-center text-lg text-white">
      {children}
    </div>
  );
}

function ResultCard({
  result,
  onYes,
  onNo,
}: {
  result: Result;
  onYes: (p: Person, m: "face") => void;
  onNo: () => void;
}) {
  if ("message" in result) {
    return (
      <div className="absolute inset-x-4 bottom-4 rounded-xl bg-white p-4 text-center text-lg font-medium text-rose-700 shadow-lg">
        {result.message}
      </div>
    );
  }
  const { person } = result;
  const tone =
    result.kind === "logged"
      ? "border-emerald-500 bg-emerald-50"
      : result.kind === "already"
        ? "border-rose-500 bg-rose-50"
        : "border-amber-400 bg-amber-50";
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-4">
      <div className={`w-full max-w-md rounded-2xl border-4 p-5 text-center shadow-xl ${tone}`}>
        <div className="flex justify-center">
          <Avatar src={person.photo_url} name={person.full_name} size={112} />
        </div>
        <p className="mt-3 text-2xl font-bold text-stone-900">{person.full_name}</p>
        <p className="text-stone-600">
          {person.roll_no}
          {person.room_no ? ` · Room ${person.room_no}` : ""}
        </p>
        {result.kind === "logged" && <p className="mt-3 text-xl font-semibold text-emerald-700">✓ Snack logged. Enjoy!</p>}
        {result.kind === "already" && (
          <p className="mt-3 text-xl font-semibold text-rose-700">
            ✗ Already taken today at {formatClockIST(new Date(result.at))}
          </p>
        )}
        {result.kind === "confirm" && (
          <>
            <p className="mt-3 text-lg font-semibold text-amber-800">Is this you?</p>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={() => onYes(person, "face")}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-lg font-semibold text-white hover:bg-emerald-700"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={onNo}
                className="flex-1 rounded-xl border border-stone-300 bg-white py-3 text-lg font-semibold text-stone-700 hover:bg-stone-50"
              >
                No
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PinScreen({ error, onSubmit }: { error: string | null; onSubmit: (pin: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <header className="px-4 py-3">
        <Brand size="lg" />
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 pb-16">
        <h1 className="text-2xl font-bold">Snack counter setup</h1>
        <p className="mt-1 text-sm text-stone-500">
          A committee member enters the kiosk PIN once on this device. Students don&apos;t need to sign in.
        </p>
        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) onSubmit(value.trim());
          }}
        >
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Kiosk PIN"
            className="w-full rounded-lg border border-stone-300 px-3 py-3 text-lg tracking-widest"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-700">
            Start kiosk
          </button>
        </form>
      </main>
    </div>
  );
}
