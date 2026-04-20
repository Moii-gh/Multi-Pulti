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

  // Set a tolerance for color matching to handle anti-aliasing artifacts
  const tolerance = 64; 

  // Fast check: If start color is very close to fill color, don't fill
  if (Math.abs(startR - fillRgba.r) <= tolerance &&
      Math.abs(startG - fillRgba.g) <= tolerance &&
      Math.abs(startB - fillRgba.b) <= tolerance &&
      Math.abs(startA - fillRgba.a) <= tolerance) {
    return;
  }

  const matchColor = (pos: number) => {
    const r = data[pos];
    const g = data[pos + 1];
    const b = data[pos + 2];
    const a = data[pos + 3];
    
    // Check if the current pixel color is within tolerance of the starting color
    return Math.abs(r - startR) <= tolerance &&
           Math.abs(g - startG) <= tolerance &&
           Math.abs(b - startB) <= tolerance &&
           Math.abs(a - startA) <= tolerance;
  };

  const colorPixel = (pos: number) => {
    data[pos] = fillRgba.r;
    data[pos + 1] = fillRgba.g;
    data[pos + 2] = fillRgba.b;
    data[pos + 3] = fillRgba.a;
  };

  const stack = [startX, startY];
  let reachLeft, reachRight;
  
  // Use a scanline approach for much faster and cleaner filling
  while (stack.length > 0) {
    let y = stack.pop()!;
    let x = stack.pop()!;

    let pos = (y * width + x) * 4;

    while (y >= 0 && matchColor(pos)) {
      y--;
      pos -= width * 4;
    }
    
    pos += width * 4;
    y++;
    
    reachLeft = false;
    reachRight = false;
    
    while (y < height && matchColor(pos)) {
      colorPixel(pos);
      
      if (x > 0) {
        if (matchColor(pos - 4)) {
          if (!reachLeft) {
            stack.push(x - 1, y);
            reachLeft = true;
          }
        } else if (reachLeft) {
          reachLeft = false;
        }
      }
      
      if (x < width - 1) {
        if (matchColor(pos + 4)) {
          if (!reachRight) {
            stack.push(x + 1, y);
            reachRight = true;
          }
        } else if (reachRight) {
          reachRight = false;
        }
      }
      
      y++;
      pos += width * 4;
    }
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
