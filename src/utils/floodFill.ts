export function floodFill(ctx: CanvasRenderingContext2D, startX: number, startY: number, fillColorHex: string) {
  const canvas = ctx.canvas;
  const width = canvas.width;
  const height = canvas.height;
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const startIndex = (startY * width + startX) * 4;
  const startR = data[startIndex];
  const startG = data[startIndex + 1];
  const startB = data[startIndex + 2];
  const startA = data[startIndex + 3];

  const fillColor = hexToRgba(fillColorHex);
  if (!fillColor) return;

  // Без допуска заливка цепляется за отдельные пиксели сглаживания и оставляет грязную кайму.
  const tolerance = 64;

  if (Math.abs(startR - fillColor.r) <= tolerance &&
      Math.abs(startG - fillColor.g) <= tolerance &&
      Math.abs(startB - fillColor.b) <= tolerance &&
      Math.abs(startA - fillColor.a) <= tolerance) {
    return;
  }

  const matchesStartColor = (index: number) => {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];
    
    return Math.abs(r - startR) <= tolerance &&
           Math.abs(g - startG) <= tolerance &&
           Math.abs(b - startB) <= tolerance &&
           Math.abs(a - startA) <= tolerance;
  };

  const fillPixel = (index: number) => {
    data[index] = fillColor.r;
    data[index + 1] = fillColor.g;
    data[index + 2] = fillColor.b;
    data[index + 3] = fillColor.a;
  };

  const stack = [startX, startY];
  let reachLeft, reachRight;
  
  // Построчная заливка не раздувает стек на больших областях и заметно быстрее обхода по одному пикселю.
  while (stack.length > 0) {
    let y = stack.pop()!;
    let x = stack.pop()!;

    let index = (y * width + x) * 4;

    while (y >= 0 && matchesStartColor(index)) {
      y--;
      index -= width * 4;
    }
    
    index += width * 4;
    y++;
    
    reachLeft = false;
    reachRight = false;
    
    while (y < height && matchesStartColor(index)) {
      fillPixel(index);
      
      if (x > 0) {
        if (matchesStartColor(index - 4)) {
          if (!reachLeft) {
            stack.push(x - 1, y);
            reachLeft = true;
          }
        } else if (reachLeft) {
          reachLeft = false;
        }
      }
      
      if (x < width - 1) {
        if (matchesStartColor(index + 4)) {
          if (!reachRight) {
            stack.push(x + 1, y);
            reachRight = true;
          }
        } else if (reachRight) {
          reachRight = false;
        }
      }
      
      y++;
      index += width * 4;
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
