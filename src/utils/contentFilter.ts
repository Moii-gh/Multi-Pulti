/**
 * Модуль цензуры рисунков для детского приложения.
 * Анализирует содержимое канваса и определяет "плохие" рисунки:
 * - Кресты, перечеркивания, X-образные фигуры
 * - Агрессивные цветовые палитры (только чёрный + красный)
 * - Символы ненависти, оскорбительные знаки
 * - Грубые/агрессивные паттерны штрихов
 */

interface ColorInfo {
  hex: string;
  count: number;
  r: number;
  g: number;
  b: number;
}

interface FilterResult {
  blocked: boolean;
  reason: string;
  severity: number; // 0-100, чем выше тем хуже
}

// ─── Утилиты ───────────────────────────────────────────────────────

/** Классифицировать цвет пикселя */
function classifyColor(r: number, g: number, b: number): string {
  // Белый / фон
  if (r > 240 && g > 240 && b > 240) return "white";
  // Чёрный / очень тёмный
  if (r < 40 && g < 40 && b < 40) return "black";
  // Красный (доминирующий R, низкие G и B)
  if (r > 150 && g < 80 && b < 80) return "red";
  // Тёмно-красный / бордо
  if (r > 100 && r < 180 && g < 50 && b < 50) return "red";
  // Оранжевый
  if (r > 180 && g > 80 && g < 170 && b < 80) return "orange";
  // Жёлтый
  if (r > 180 && g > 180 && b < 100) return "yellow";
  // Зелёный
  if (g > 100 && r < 100 && b < 100) return "green";
  if (g > 150 && r < g && b < g) return "green";
  // Синий / голубой
  if (b > 120 && r < 100 && g < 150) return "blue";
  // Фиолетовый
  if (r > 80 && b > 80 && g < 80) return "purple";
  // Розовый
  if (r > 180 && g < 120 && b > 100) return "pink";
  // Серый
  if (Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && r > 40 && r < 240) return "gray";
  // Коричневый
  if (r > 100 && g > 50 && g < 130 && b < 80) return "brown";
  return "other";
}

// ─── Анализ цветовой палитры ────────────────────────────────────────

function analyzeColorPalette(imageData: ImageData): {
  colorGroups: Map<string, number>;
  totalDrawnPixels: number;
  drawingDensity: number;
} {
  const colorGroups = new Map<string, number>();
  const data = imageData.data;
  const totalPixels = imageData.width * imageData.height;
  let drawnPixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 128) continue; // прозрачный

    const group = classifyColor(r, g, b);
    if (group !== "white") {
      drawnPixels++;
      colorGroups.set(group, (colorGroups.get(group) || 0) + 1);
    }
  }

  return {
    colorGroups,
    totalDrawnPixels: drawnPixels,
    drawingDensity: drawnPixels / totalPixels,
  };
}

/**
 * Проверяет, является ли палитра агрессивной.
 * Агрессивная палитра: ТОЛЬКО чёрный + красный, без других цветов.
 */
function checkAggressivePalette(
  colorGroups: Map<string, number>,
  totalDrawn: number,
): { isAggressive: boolean; score: number } {
  if (totalDrawn < 500) return { isAggressive: false, score: 0 }; // слишком мало рисования

  const blackCount = colorGroups.get("black") || 0;
  const redCount = colorGroups.get("red") || 0;
  const aggressivePixels = blackCount + redCount;

  // Найти другие цвета (кроме чёрного, красного, серого)
  let otherColorPixels = 0;
  for (const [group, count] of colorGroups) {
    if (group !== "black" && group !== "red" && group !== "gray") {
      otherColorPixels += count;
    }
  }

  // Доля агрессивных цветов
  const aggressiveRatio = aggressivePixels / totalDrawn;
  const otherRatio = otherColorPixels / totalDrawn;

  // Должно быть и чёрное, и красное, и почти нет других цветов
  if (
    blackCount > 100 &&
    redCount > 100 &&
    aggressiveRatio > 0.85 &&
    otherRatio < 0.1
  ) {
    // Чем выше доля — тем выше балл
    const score = Math.min(100, Math.round(aggressiveRatio * 80));
    return { isAggressive: true, score };
  }

  return { isAggressive: false, score: 0 };
}

// ─── Обнаружение крестов и X-образных фигур ─────────────────────────

/**
 * Обнаружение крестообразных фигур с помощью анализа линий.
 * Использует метод Хафа (упрощённый) — ищем пересекающиеся диагональные линии.
 */
function detectCrossPattern(imageData: ImageData): {
  hasCross: boolean;
  score: number;
} {
  const w = imageData.width;
  const h = imageData.height;
  const data = imageData.data;

  // Уменьшаем разрешение для скорости
  const scale = 4;
  const sw = Math.floor(w / scale);
  const sh = Math.floor(h / scale);

  // Бинаризация: 1 = нарисовано, 0 = фон
  const binary: number[][] = [];
  for (let y = 0; y < sh; y++) {
    binary[y] = [];
    for (let x = 0; x < sw; x++) {
      const px = x * scale;
      const py = y * scale;
      const idx = (py * w + px) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // Считаем пиксель нарисованным если он не белый
      binary[y][x] = r < 230 || g < 230 || b < 230 ? 1 : 0;
    }
  }

  // Ищем длинные линейные паттерны в разных направлениях
  const directions = [
    { dx: 1, dy: 1, name: "diag-down-right" },   // \
    { dx: 1, dy: -1, name: "diag-up-right" },     // /
    { dx: 1, dy: 0, name: "horizontal" },          // —
    { dx: 0, dy: 1, name: "vertical" },            // |
  ];

  interface Line {
    dir: string;
    length: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    midX: number;
    midY: number;
  }

  const significantLines: Line[] = [];
  const minLineLength = Math.min(sw, sh) * 0.25; // Минимум 25% размера

  for (const dir of directions) {
    // Сканируем стартовые точки
    for (let sy = 0; sy < sh; sy += 2) {
      for (let sx = 0; sx < sw; sx += 2) {
        if (!binary[sy]?.[sx]) continue;

        // Прослеживаем линию
        let length = 0;
        let gaps = 0;
        let maxGap = 0;
        let currentGap = 0;
        let cx = sx;
        let cy = sy;

        while (
          cx >= 0 && cx < sw &&
          cy >= 0 && cy < sh
        ) {
          if (binary[cy]?.[cx]) {
            length++;
            currentGap = 0;
          } else {
            currentGap++;
            gaps++;
            if (currentGap > 3) break; // слишком большой разрыв
            maxGap = Math.max(maxGap, currentGap);
          }
          cx += dir.dx;
          cy += dir.dy;
        }

        if (length >= minLineLength && gaps / (length + gaps) < 0.3) {
          const endX = cx - dir.dx;
          const endY = cy - dir.dy;
          significantLines.push({
            dir: dir.name,
            length,
            startX: sx,
            startY: sy,
            endX,
            endY,
            midX: (sx + endX) / 2,
            midY: (sy + endY) / 2,
          });
        }
      }
    }
  }

  // Ищем пересечения (крест = 2 линии разного направления, пересекающиеся)
  let crossScore = 0;

  for (let i = 0; i < significantLines.length; i++) {
    for (let j = i + 1; j < significantLines.length; j++) {
      const a = significantLines[i];
      const b = significantLines[j];

      // Линии должны быть разных направлений
      if (a.dir === b.dir) continue;

      // Проверяем, пересекаются ли линии (средние точки близко)
      const dist = Math.sqrt(
        Math.pow(a.midX - b.midX, 2) + Math.pow(a.midY - b.midY, 2),
      );
      const tolerance = Math.min(sw, sh) * 0.15;

      if (dist < tolerance) {
        // Классический крест: \ + / или | + —
        const isDiagCross =
          (a.dir === "diag-down-right" && b.dir === "diag-up-right") ||
          (a.dir === "diag-up-right" && b.dir === "diag-down-right");

        const isOrthoCross =
          (a.dir === "horizontal" && b.dir === "vertical") ||
          (a.dir === "vertical" && b.dir === "horizontal");

        if (isDiagCross) {
          crossScore = Math.max(crossScore, 70);
        } else if (isOrthoCross) {
          // Обычный "+" может быть легитимным, даём меньший балл
          crossScore = Math.max(crossScore, 30);
        } else {
          crossScore = Math.max(crossScore, 20);
        }
      }
    }
  }

  return {
    hasCross: crossScore >= 50,
    score: crossScore,
  };
}

// ─── Детектор "зачёркивания" (грубые штрихи по всему холсту) ────────

function detectScribblePattern(imageData: ImageData): {
  isScribble: boolean;
  score: number;
} {
  const w = imageData.width;
  const h = imageData.height;
  const data = imageData.data;

  // Разделяем холст на сектора и считаем плотность
  const sectorsX = 8;
  const sectorsY = 6;
  const sectorW = Math.floor(w / sectorsX);
  const sectorH = Math.floor(h / sectorsY);

  const sectorDensity: number[][] = [];
  let totalDensity = 0;
  let filledSectors = 0;

  for (let sy = 0; sy < sectorsY; sy++) {
    sectorDensity[sy] = [];
    for (let sx = 0; sx < sectorsX; sx++) {
      let drawn = 0;
      let total = 0;

      for (let py = sy * sectorH; py < (sy + 1) * sectorH && py < h; py++) {
        for (let px = sx * sectorW; px < (sx + 1) * sectorW && px < w; px++) {
          const idx = (py * w + px) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          total++;
          if (r < 230 || g < 230 || b < 230) drawn++;
        }
      }

      const density = total > 0 ? drawn / total : 0;
      sectorDensity[sy][sx] = density;
      totalDensity += density;
      if (density > 0.3) filledSectors++;
    }
  }

  const avgDensity = totalDensity / (sectorsX * sectorsY);
  const sectorFillRatio = filledSectors / (sectorsX * sectorsY);

  // Хаотичное "зачёркивание" = высокая плотность по всему холсту
  // но не однородная заливка (это может быть фон)
  let varianceSum = 0;
  for (let sy = 0; sy < sectorsY; sy++) {
    for (let sx = 0; sx < sectorsX; sx++) {
      varianceSum += Math.pow(sectorDensity[sy][sx] - avgDensity, 2);
    }
  }
  const variance = varianceSum / (sectorsX * sectorsY);

  // Зачёркивание: много заполнено, умеренная разница между секторами
  if (avgDensity > 0.4 && sectorFillRatio > 0.7 && variance > 0.01 && variance < 0.15) {
    const score = Math.min(100, Math.round(avgDensity * 60 + sectorFillRatio * 30));
    return { isScribble: true, score };
  }

  return { isScribble: false, score: 0 };
}

// ─── Обнаружение агрессивных символов ───────────────────────────────

/**
 * Простой детектор свастикоподобных фигур.
 * Ищем 4-кратную вращательную симметрию.
 */
function detectRotationalSymmetry(imageData: ImageData): {
  hasSymmetry: boolean;
  score: number;
} {
  const w = imageData.width;
  const h = imageData.height;
  const data = imageData.data;

  // Уменьшаем для скорости
  const scale = 8;
  const sw = Math.floor(w / scale);
  const sh = Math.floor(h / scale);
  const cx = sw / 2;
  const cy = sh / 2;

  // Бинаризация
  const getBin = (x: number, y: number): number => {
    const px = Math.min(w - 1, x * scale);
    const py = Math.min(h - 1, y * scale);
    const idx = (py * w + px) * 4;
    return data[idx] < 230 || data[idx + 1] < 230 || data[idx + 2] < 230 ? 1 : 0;
  };

  // Считаем совпадение при повороте на 90°
  let matchCount = 0;
  let totalChecked = 0;

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const val = getBin(x, y);
      if (val === 0) continue;

      // Поворот на 90° вокруг центра
      const rx = cx + (y - cy);
      const ry = cy - (x - cx);
      const rxi = Math.round(rx);
      const ryi = Math.round(ry);

      if (rxi >= 0 && rxi < sw && ryi >= 0 && ryi < sh) {
        totalChecked++;
        if (getBin(rxi, ryi) === val) {
          matchCount++;
        }
      }
    }
  }

  const symmetryRatio = totalChecked > 50 ? matchCount / totalChecked : 0;

  // Высокая 4-кратная симметрия подозрительна
  if (symmetryRatio > 0.6 && totalChecked > 100) {
    return { hasSymmetry: true, score: Math.round(symmetryRatio * 50) };
  }

  return { hasSymmetry: false, score: 0 };
}

// ─── Главная функция фильтрации ────────────────────────────────────

export function analyzeFrame(canvas: HTMLCanvasElement): FilterResult {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { blocked: false, reason: "", severity: 0 };

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // 1. Анализ палитры
  const palette = analyzeColorPalette(imageData);

  // Слишком мало рисования — ОК
  if (palette.totalDrawnPixels < 300) {
    return { blocked: false, reason: "", severity: 0 };
  }

  let totalScore = 0;
  const reasons: string[] = [];

  // 2. Проверка агрессивной палитры (чёрный + красный)
  const paletteCheck = checkAggressivePalette(
    palette.colorGroups,
    palette.totalDrawnPixels,
  );
  if (paletteCheck.isAggressive) {
    totalScore += paletteCheck.score;
    reasons.push("агрессивная палитра (только чёрный и красный)");
  }

  // 3. Детекция крестов
  const crossCheck = detectCrossPattern(imageData);
  if (crossCheck.hasCross) {
    totalScore += crossCheck.score;
    reasons.push("крестообразая фигура");
  }

  // 4. Детекция «зачёркивания»
  const scribbleCheck = detectScribblePattern(imageData);
  if (scribbleCheck.isScribble) {
    totalScore += scribbleCheck.score;
    reasons.push("хаотичное зачёркивание");
  }

  // 5. Вращательная симметрия (свастикоподобные фигуры)
  const symmetryCheck = detectRotationalSymmetry(imageData);
  if (symmetryCheck.hasSymmetry) {
    totalScore += symmetryCheck.score;
    reasons.push("подозрительная симметричная фигура");
  }

  // Комбинированная оценка:
  // Крест + агрессивная палитра = очень плохо
  if (paletteCheck.isAggressive && crossCheck.hasCross) {
    totalScore += 30; // бонус за комбинацию
  }

  // Зачёркивание + агрессивная палитра = очень плохо
  if (paletteCheck.isAggressive && scribbleCheck.isScribble) {
    totalScore += 20;
  }

  const severity = Math.min(100, totalScore);

  // Порог блокировки: 60+
  if (severity >= 60) {
    return {
      blocked: true,
      reason: reasons.join(", "),
      severity,
    };
  }

  return {
    blocked: false,
    reason: reasons.length > 0 ? reasons.join(", ") : "",
    severity,
  };
}

/**
 * Быстрая проверка dataURL кадра.
 * Загружает картинку, рисует на временный канвас и анализирует.
 */
export function analyzeFrameDataURL(
  dataURL: string,
  width: number,
  height: number,
): Promise<FilterResult> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = width;
      tempCanvas.height = height;
      const ctx = tempCanvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        resolve({ blocked: false, reason: "", severity: 0 });
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(analyzeFrame(tempCanvas));
    };
    img.onerror = () => resolve({ blocked: false, reason: "", severity: 0 });
    img.src = dataURL;
  });
}
