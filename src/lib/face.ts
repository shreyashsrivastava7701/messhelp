// Browser-only face helpers (face-api runs TensorFlow.js in the browser).
// Models are served from /public/models, so nothing is sent to other servers.

type FaceApi = typeof import("@vladmandic/face-api");

let loading: Promise<FaceApi> | null = null;

/** Loads face-api and its three models once per page. */
export function loadFaceApi(): Promise<FaceApi> {
  loading ??= (async () => {
    const faceapi = await import("@vladmandic/face-api");
    // Use the graphics card (WebGL) when there is one, otherwise the slower CPU backend.
    const tf = faceapi.tf as unknown as { setBackend(name: string): Promise<boolean>; ready(): Promise<void> };
    const gpu = await tf.setBackend("webgl").catch(() => false);
    if (!gpu) await tf.setBackend("cpu");
    await tf.ready();
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
      faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
    ]);
    return faceapi;
  })().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

/** Loads an image (e.g. a blob: URL) so face-api can read its pixels. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("couldn't load the photo"));
    img.src = src;
  });
}

type FaceInput = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

/**
 * 128-number descriptor of the largest face in the picture, or null if there is none.
 * `minConfidence` is lower for roster photos, which are often small or low quality.
 */
export async function describeFace(input: FaceInput, minConfidence = 0.5): Promise<number[] | null> {
  const faceapi = await loadFaceApi();
  const result = await faceapi
    .detectSingleFace(input, new faceapi.SsdMobilenetv1Options({ minConfidence }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return result ? Array.from(result.descriptor) : null;
}

function distance(a: number[], b: number[]) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

/** Below this the match is trusted outright; up to MAYBE it asks "Is this you?". */
export const SURE = 0.45;
export const MAYBE = 0.55;

export type FaceMatch<T> = { item: T; distance: number; sure: boolean };

/** Closest person, if close enough and clearly closer than the runner-up. */
export function findMatch<T extends { descriptor: number[] | null }>(
  probe: number[],
  people: T[],
): FaceMatch<T> | null {
  let best: { item: T; d: number } | null = null;
  let second = Infinity;
  for (const p of people) {
    if (!p.descriptor) continue;
    const d = distance(probe, p.descriptor);
    if (!best || d < best.d) {
      if (best) second = best.d;
      best = { item: p, d };
    } else if (d < second) {
      second = d;
    }
  }
  if (!best || best.d > MAYBE) return null;
  const clear = second - best.d > 0.06;
  return { item: best.item, distance: best.d, sure: best.d < SURE && clear };
}
