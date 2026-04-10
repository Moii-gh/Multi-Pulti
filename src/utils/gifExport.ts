import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export async function exportToGif(framesDataUrls: string[], fps: number, width: number, height: number): Promise<Blob> {
  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  for (const dataUrl of framesDataUrls) {
    const img = new Image();
    await new Promise((resolve) => {
      img.onload = resolve;
      img.src = dataUrl;
    });

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0);

    const { data } = ctx.getImageData(0, 0, width, height);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);

    gif.writeFrame(index, width, height, { palette, delay });
  }

  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}
