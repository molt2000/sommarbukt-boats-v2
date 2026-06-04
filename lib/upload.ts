import { createClient } from "@/lib/supabase/client";

export type Bucket = "id-photos" | "damage-photos" | "signatures";

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Uploads a base64 data URL to a bucket and returns the stored path. */
export async function uploadDataUrl(dataUrl: string, bucket: Bucket, path: string): Promise<string> {
  const supabase = createClient();
  const blob = dataUrlToBlob(dataUrl);
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: blob.type,
    upsert: true,
  });
  if (error) throw new Error(`Could not upload image: ${error.message}`);
  return `${bucket}/${path}`;
}

function splitPath(fullPath: string): { bucket: Bucket; path: string } {
  const slash = fullPath.indexOf("/");
  return { bucket: fullPath.slice(0, slash) as Bucket, path: fullPath.slice(slash + 1) };
}

/** Returns a short-lived signed URL for displaying a private object. */
export async function getSignedUrl(fullPath: string, expiresInSec = 3600): Promise<string> {
  if (!fullPath) return "";
  const supabase = createClient();
  const { bucket, path } = splitPath(fullPath);
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSec);
  if (error) throw new Error(`Could not load image: ${error.message}`);
  return data.signedUrl;
}

/** Fetches a stored object and returns it as a base64 data URL (for jsPDF). */
export async function dataUrlFromPath(fullPath: string): Promise<string> {
  if (!fullPath) return "";
  const url = await getSignedUrl(fullPath, 600);
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read stored image."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

/** Deletes objects by full path (bucket/key), grouped per bucket. */
export async function deletePaths(fullPaths: string[]): Promise<void> {
  const valid = fullPaths.filter(Boolean);
  if (!valid.length) return;
  const supabase = createClient();
  const byBucket = new Map<Bucket, string[]>();
  for (const fp of valid) {
    const { bucket, path } = splitPath(fp);
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), path]);
  }
  for (const [bucket, paths] of byBucket) {
    await supabase.storage.from(bucket).remove(paths);
  }
}
