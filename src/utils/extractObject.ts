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

  const getPos = (x: number, y: number) => (y * width + x);
  const getIdx = (x: number, y: number) => getPos(x, y) * 4;

  const isEmpty = (idx: number) => {
    // Transparent
    if (data[idx + 3] === 0) return true;
    // Almost white (to handle anti-aliasing)
    if (data[idx] > 250 && data[idx + 1] > 250 && data[idx + 2] > 250) return true;
    return false;
  };

  const startIdx = getIdx(startX, startY);
  
  // Allow clicking slightly near an object by searching in a small radius first
  if (isEmpty(startIdx)) {
    let found = false;
    for (let r = 1; r <= 10; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
           const nx = startX + dx;
           const ny = startY + dy;
           if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
             if (!isEmpty(getIdx(nx, ny))) {
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

  // We maintain a search queue for the flood fills to merge nearby components
  const searchComponentsQueue: [number, number][] = [[startX, startY]];

  while (searchComponentsQueue.length > 0) {
    const [sx, sy] = searchComponentsQueue.pop()!;
    if (visited[getPos(sx, sy)]) continue;

    // Run flood fill for a single connected component
    const stack = [sx, sy];
    visited[getPos(sx, sy)] = 1;

    let compMinX = sx, compMaxX = sx;
    let compMinY = sy, compMaxY = sy;

    while (stack.length > 0) {
      const y = stack.pop()!;
      const x = stack.pop()!;
      
      const pos = getPos(x, y);
      objectPixels.push(pos);
      
      if (x < compMinX) compMinX = x;
      if (x > compMaxX) compMaxX = x;
      if (y < compMinY) compMinY = y;
      if (y > compMaxY) compMaxY = y;

      // 8-way connectivity
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nPos = getPos(nx, ny);
            if (!visited[nPos]) {
              visited[nPos] = 1;
              if (!isEmpty(nPos * 4)) {
                stack.push(nx, ny);
              }
            }
          }
        }
      }
    }

    // Update global bounds
    if (compMinX < minX) minX = compMinX;
    if (compMaxX > maxX) maxX = compMaxX;
    if (compMinY < minY) minY = compMinY;
    if (compMaxY > maxY) maxY = compMaxY;

    // Search for nearby non-visited, non-empty pixels within a GAP radius
    // This allows disjointed letters in a text block to be merged!
    const GAP = 15; 
    const searchMinX = Math.max(0, compMinX - GAP);
    const searchMaxX = Math.min(width - 1, compMaxX + GAP);
    const searchMinY = Math.max(0, compMinY - GAP);
    const searchMaxY = Math.min(height - 1, compMaxY + GAP);

    for (let y = searchMinY; y <= searchMaxY; y++) {
      for (let x = searchMinX; x <= searchMaxX; x++) {
        const p = getPos(x, y);
        if (!visited[p] && !isEmpty(p * 4)) {
          searchComponentsQueue.push([x, y]);
        }
      }
    }
  }

  const objWidth = maxX - minX + 1;
  const objHeight = maxY - minY + 1;

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = objWidth;
  tempCanvas.height = objHeight;
  const tempCtx = tempCanvas.getContext("2d")!;
  const tempImageData = tempCtx.createImageData(objWidth, objHeight);
  
  for (let i = 0; i < objectPixels.length; i++) {
    const p = objectPixels[i];
    const px = p % width;
    const py = Math.floor(p / width);
    
    const srcPos = p * 4;
    const destPos = ((py - minY) * objWidth + (px - minX)) * 4;
    
    // Copy to temp
    tempImageData.data[destPos] = data[srcPos];
    tempImageData.data[destPos + 1] = data[srcPos + 1];
    tempImageData.data[destPos + 2] = data[srcPos + 2];
    tempImageData.data[destPos + 3] = data[srcPos + 3];
    
    // Erase from main (make white)
    data[srcPos] = 255;
    data[srcPos + 1] = 255;
    data[srcPos + 2] = 255;
    data[srcPos + 3] = 255;
  }
  
  tempCtx.putImageData(tempImageData, 0, 0);
  ctx.putImageData(imageData, 0, 0);

  return {
    canvas: tempCanvas,
    x: minX,
    y: minY,
    width: objWidth,
    height: objHeight
  };
}
