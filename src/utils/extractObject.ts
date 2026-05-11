export function extractObject(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number
): { canvas: HTMLCanvasElement; x: number; y: number; width: number; height: number } | null {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  startX = Math.floor(startX);
  startY = Math.floor(startY);
  
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return null;

  const getPixelOffset = (x: number, y: number) => (y * width + x);
  const getDataIndex = (x: number, y: number) => getPixelOffset(x, y) * 4;

  const isBackgroundPixel = (index: number) => {
    if (data[index + 3] === 0) return true;
    if (data[index] > 250 && data[index + 1] > 250 && data[index + 2] > 250) return true;
    return false;
  };

  const startIndex = getDataIndex(startX, startY);
  
  // В режиме выбора дети часто нажимают рядом с контуром, поэтому сначала ищем ближайший нарисованный пиксель.
  if (isBackgroundPixel(startIndex)) {
    let found = false;
    for (let r = 1; r <= 10; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
           const nx = startX + dx;
           const ny = startY + dy;
           if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
             if (!isBackgroundPixel(getDataIndex(nx, ny))) {
               startX = nx;
               startY = ny;
               found = true;
               break;
             }
           }
        }
        if (found) break;
      }
      if (found) break;
    }
    if (!found) return null;
  }

  const visited = new Uint8Array(width * height);
  const objectPixels: number[] = [];
  
  let minX = startX, maxX = startX;
  let minY = startY, maxY = startY;

  // Один объект может состоять из нескольких близких компонентов, например букв в слове.
  const searchComponentsQueue: [number, number][] = [[startX, startY]];

  while (searchComponentsQueue.length > 0) {
    const [sx, sy] = searchComponentsQueue.pop()!;
    if (visited[getPixelOffset(sx, sy)]) continue;

    const stack = [sx, sy];
    visited[getPixelOffset(sx, sy)] = 1;

    let compMinX = sx, compMaxX = sx;
    let compMinY = sy, compMaxY = sy;

    while (stack.length > 0) {
      const y = stack.pop()!;
      const x = stack.pop()!;
      
      const pixelOffset = getPixelOffset(x, y);
      objectPixels.push(pixelOffset);
      
      if (x < compMinX) compMinX = x;
      if (x > compMaxX) compMaxX = x;
      if (y < compMinY) compMinY = y;
      if (y > compMaxY) compMaxY = y;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nextOffset = getPixelOffset(nx, ny);
            if (!visited[nextOffset]) {
              visited[nextOffset] = 1;
              if (!isBackgroundPixel(nextOffset * 4)) {
                stack.push(nx, ny);
              }
            }
          }
        }
      }
    }

    if (compMinX < minX) minX = compMinX;
    if (compMaxX > maxX) maxX = compMaxX;
    if (compMinY < minY) minY = compMinY;
    if (compMaxY > maxY) maxY = compMaxY;

    const nearbyComponentGap = 15;
    const searchMinX = Math.max(0, compMinX - nearbyComponentGap);
    const searchMaxX = Math.min(width - 1, compMaxX + nearbyComponentGap);
    const searchMinY = Math.max(0, compMinY - nearbyComponentGap);
    const searchMaxY = Math.min(height - 1, compMaxY + nearbyComponentGap);

    for (let y = searchMinY; y <= searchMaxY; y++) {
      for (let x = searchMinX; x <= searchMaxX; x++) {
        const pixelOffset = getPixelOffset(x, y);
        if (!visited[pixelOffset] && !isBackgroundPixel(pixelOffset * 4)) {
          searchComponentsQueue.push([x, y]);
        }
      }
    }
  }

  const objWidth = maxX - minX + 1;
  const objHeight = maxY - minY + 1;

  const objectCanvas = document.createElement("canvas");
  objectCanvas.width = objWidth;
  objectCanvas.height = objHeight;
  const objectCtx = objectCanvas.getContext("2d");
  if (!objectCtx) return null;

  const objectImageData = objectCtx.createImageData(objWidth, objHeight);
  
  for (let i = 0; i < objectPixels.length; i++) {
    const pixelOffset = objectPixels[i];
    const px = pixelOffset % width;
    const py = Math.floor(pixelOffset / width);
    
    const sourceIndex = pixelOffset * 4;
    const targetIndex = ((py - minY) * objWidth + (px - minX)) * 4;
    
    objectImageData.data[targetIndex] = data[sourceIndex];
    objectImageData.data[targetIndex + 1] = data[sourceIndex + 1];
    objectImageData.data[targetIndex + 2] = data[sourceIndex + 2];
    objectImageData.data[targetIndex + 3] = data[sourceIndex + 3];
    
    data[sourceIndex] = 255;
    data[sourceIndex + 1] = 255;
    data[sourceIndex + 2] = 255;
    data[sourceIndex + 3] = 255;
  }
  
  objectCtx.putImageData(objectImageData, 0, 0);
  ctx.putImageData(imageData, 0, 0);

  return {
    canvas: objectCanvas,
    x: minX,
    y: minY,
    width: objWidth,
    height: objHeight
  };
}
