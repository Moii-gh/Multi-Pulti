export function floodFill(ctx: CanvasRenderingContext2D, startX: number, startY: number, fillColorHex: string) {
  const canvas = ctx.canvas;
  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const startPos = (startY * width + startX) * 4;
  const startR = data[startPos];
  const startG = data[startPos + 1];
  const startB = data[startPos + 2];
  const startA = data[startPos + 3];

  const fillRgba = hexToRgba(fillColorHex);
  if (!fillRgba) return;

  if (startR === fillRgba.r && startG === fillRgba.g && startB === fillRgba.b && startA === fillRgba.a) {
    return;
  }

  const matchColor = (pos: number) => {
    return data[pos] === startR && data[pos + 1] === startG && data[pos + 2] === startB && data[pos + 3] === startA;
  };

  const colorPixel = (pos: number) => {
    data[pos] = fillRgba.r;
    data[pos + 1] = fillRgba.g;
    data[pos + 2] = fillRgba.b;
    data[pos + 3] = fillRgba.a;
  };

  const stack = [startX, startY];

  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;

    const pos = (y * width + x) * 4;
    if (!matchColor(pos)) continue;

    colorPixel(pos);

    if (x > 0) stack.push(x - 1, y);
    if (x < width - 1) stack.push(x + 1, y);
    if (y > 0) stack.push(x, y - 1);
    if (y < height - 1) stack.push(x, y + 1);
  }

  ctx.putImageData(imageData, 0, 0);
}

function hexToRgba(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
    a: 255
  } : null;
}
