// Shrinks a photo in the browser before it is uploaded, so a 12 megapixel phone photo does not take a minute on cell data.

/** The size to scale a picture to so its long side is at most `max`. Never makes a small picture bigger. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Resizes an image file to a JPEG no larger than `max` pixels on its long side. Browser only. */
export async function resizeImage(file: File, max = 1200, quality = 0.82): Promise<Blob> {
  // imageOrientation "from-image" turns a sideways phone photo upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't resize pictures.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Couldn't prepare that picture.");
  return blob;
}
