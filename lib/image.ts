export async function readAndCompressImage(
  file: File,
  options: { maxSize?: number; quality?: number } = {}
): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  return compressImage(dataUrl, options);
}

export function compressImage(
  dataUrl: string,
  options: { maxSize?: number; quality?: number } = {}
): Promise<string> {
  const maxSize = options.maxSize ?? 1200;
  const quality = options.quality ?? 0.78;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("Could not read the selected image."));
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not prepare the image for storage."));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}
