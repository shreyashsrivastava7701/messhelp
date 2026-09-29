/**
 * Turn the links people paste into ones an <img> can show.
 * Google Drive "share" links point at a viewer page, not the image, so they are
 * rewritten to Drive's thumbnail endpoint. The file must be shared as
 * "Anyone with the link".
 */
export function normalizePhotoUrl(raw: string | null | undefined): string | null {
  const url = (raw ?? "").trim();
  if (!url) return null;

  const driveId =
    url.match(/drive\.google\.com\/file\/d\/([\w-]{10,})/)?.[1] ??
    url.match(/drive\.google\.com\/(?:open|uc|thumbnail)\?(?:.*&)?id=([\w-]{10,})/)?.[1] ??
    url.match(/docs\.google\.com\/uc\?(?:.*&)?id=([\w-]{10,})/)?.[1];
  if (driveId) return `https://drive.google.com/thumbnail?id=${driveId}&sz=w400`;

  return /^https?:\/\//i.test(url) ? url : null;
}

export function initialsPhoto(name: string): string {
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}`;
}
