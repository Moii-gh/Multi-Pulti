import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Pen, Eraser, PaintBucket, Minus, Circle, Square, 
  Undo, Redo, Play, Square as StopCircle, Plus, Copy, Trash, 
  Save, Image as ImageIcon, Film, Download, Smile, Check, X,
  Wand2, FlipHorizontal, BookTemplate, Pipette, Palette, Star
} from 'lucide-react';
import { cn } from './utils/cn';
import { floodFill } from './utils/floodFill';
import { exportToGif } from './utils/gifExport';
import { playPop, playSwoosh, playAction, playError } from './utils/audio';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const BASIC_COLORS = [
  { hex: '#000000', name: 'Чёрный' },
  { hex: '#FFFFFF', name: 'Белый' },
  { hex: '#FF3B30', name: 'Красный' },
  { hex: '#FF9500', name: 'Оранжевый' },
  { hex: '#FFCC00', name: 'Жёлтый' },
  { hex: '#4CD964', name: 'Зелёный' },
  { hex: '#5AC8FA', name: 'Голубой' },
  { hex: '#007AFF', name: 'Синий' },
  { hex: '#5856D6', name: 'Фиолетовый' },
  { hex: '#FF2D55', name: 'Розовый' },
  { hex: '#A2845E', name: 'Коричневый' },
  { hex: '#8E8E93', name: 'Серый' }
];

const rgbToHex = (r: number, g: number, b: number) => {
  return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
};

const hsvToHex = (h: number, s: number, v: number) => {
  s /= 100;
  v /= 100;
  const f = (n: number, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
  const r = Math.round(f(5) * 255).toString(16).padStart(2, '0');
  const g = Math.round(f(3) * 255).toString(16).padStart(2, '0');
  const b = Math.round(f(1) * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`.toUpperCase();
};

const BRUSH_SIZES = [
  { id: 'small', size: 5, label: 'Тонко' },
  { id: 'medium', size: 15, label: 'Средне' },
  { id: 'large', size: 30, label: 'Толсто' },
];

const TOOLS = [
  { id: 'brush', icon: Pen, label: 'Кисть' },
  { id: 'eraser', icon: Eraser, label: 'Ластик' },
  { id: 'fill', icon: PaintBucket, label: 'Заливка' },
  { id: 'pipette', icon: Pipette, label: 'Пипетка' },
  { id: 'line', icon: Minus, label: 'Линия' },
  { id: 'circle', icon: Circle, label: 'Круг' },
  { id: 'rect', icon: Square, label: 'Квадрат' },
  { id: 'sticker', icon: Smile, label: 'Стикер' },
];

const STICKERS = [
  {
    category: 'Фигуры',
    items: ['⭐', '💖', '🔺', '🔻', '🔴', '🔵', '🟡', '🟢', '🟥', '🟦', '🟨', '🟩']
  },
  {
    category: 'Животные',
    items: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮']
  },
  {
    category: 'Смайлики',
    items: ['😀', '😂', '😊', '😍', '😎', '😜', '😡', '😭', '😱', '😴', '👽', '👻']
  }
];

const FPS_OPTIONS = [
  { id: 'slow', fps: 2, label: '🐢 Медленно' },
  { id: 'normal', fps: 5, label: '🚶 Нормально' },
  { id: 'fast', fps: 12, label: '🚀 Быстро' },
];

const TEMPLATES = [
  { id: 'cat', label: 'Котик', icon: '🐱', url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="%2394a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="50" cy="50" r="35"/><path d="M25 25 L35 15 L45 25 M75 25 L65 15 L55 25"/><circle cx="35" cy="45" r="4" fill="%2394a3b8"/><circle cx="65" cy="45" r="4" fill="%2394a3b8"/><path d="M45 55 Q50 65 55 55"/><path d="M10 45 L25 50 M10 55 L25 55 M10 65 L25 60 M90 45 L75 50 M90 55 L75 55 M90 65 L75 60"/></svg>` },
  { id: 'house', label: 'Домик', icon: '🏠', url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="%2394a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="20" y="40" width="60" height="50"/><path d="M10 40 L50 10 L90 40 Z"/><rect x="40" y="60" width="20" height="30"/><rect x="25" y="50" width="10" height="10"/><rect x="65" y="50" width="10" height="10"/></svg>` },
  { id: 'fish', label: 'Рыбка', icon: '🐟', url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="%2394a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="50" cy="50" rx="30" ry="20"/><path d="M20 50 L5 35 L5 65 Z"/><circle cx="65" cy="45" r="3" fill="%2394a3b8"/><path d="M40 30 Q50 15 60 30 M40 70 Q50 85 60 70"/></svg>` }
];

const drawSmoothedCurve = (ctx: CanvasRenderingContext2D, points: {x: number, y: number}[], color: string, size: number, symmetry: boolean) => {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  if (points.length === 0) return;
  
  const draw = (mirror: boolean) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const getX = (p: {x: number}) => mirror ? CANVAS_WIDTH - p.x : p.x;
    
    ctx.moveTo(getX(points[0]), points[0].y);
    
    if (points.length < 3) {
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(getX(points[i]), points[i].y);
        }
    } else {
        for (let i = 1; i < points.length - 2; i++) {
            const xc = (points[i].x + points[i + 1].x) / 2;
            const yc = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(getX(points[i]), points[i].y, mirror ? CANVAS_WIDTH - xc : xc, yc);
        }
        const last = points[points.length - 1];
        const secondLast = points[points.length - 2];
        ctx.quadraticCurveTo(getX(secondLast), secondLast.y, getX(last), last.y);
    }
    ctx.stroke();
  };
  
  draw(false);
  if (symmetry) draw(true);
};

const detectShape = (points: {x: number, y: number}[]) => {
    if (points.length < 10) return null;
    const first = points[0];
    const last = points[points.length - 1];
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let pathLength = 0;
    for (let i=0; i<points.length; i++) {
        minX = Math.min(minX, points[i].x);
        maxX = Math.max(maxX, points[i].x);
        minY = Math.min(minY, points[i].y);
        maxY = Math.max(maxY, points[i].y);
        if (i > 0) {
            pathLength += Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
        }
    }
    
    const width = maxX - minX;
    const height = maxY - minY;
    const isClosed = dist < Math.max(width, height) * 0.3;
    
    if (isClosed && width > 20 && height > 20) {
        const perimeter = 2 * Math.PI * Math.sqrt((width*width + height*height) / 8);
        const ratio = pathLength / perimeter;
        if (ratio > 0.8 && ratio < 1.4) {
            return { type: 'ellipse', cx: minX + width/2, cy: minY + height/2, rx: width/2, ry: height/2 };
        }
    } else if (width > 20 || height > 20) {
        const straightDist = Math.hypot(last.x - first.x, last.y - first.y);
        if (pathLength / straightDist < 1.1) {
            return { type: 'line', x1: first.x, y1: first.y, x2: last.x, y2: last.y };
        }
    }
    return null;
};

const drawPerfectShape = (ctx: CanvasRenderingContext2D, shape: any, color: string, size: number, symmetry: boolean) => {
    const draw = (mirror: boolean) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        if (shape.type === 'ellipse') {
            const cx = mirror ? CANVAS_WIDTH - shape.cx : shape.cx;
            ctx.ellipse(cx, shape.cy, shape.rx, shape.ry, 0, 0, 2 * Math.PI);
        } else if (shape.type === 'line') {
            ctx.moveTo(mirror ? CANVAS_WIDTH - shape.x1 : shape.x1, shape.y1);
            ctx.lineTo(mirror ? CANVAS_WIDTH - shape.x2 : shape.x2, shape.y2);
        }
        ctx.stroke();
    };
    draw(false);
    if (symmetry) draw(true);
};

const getBlankCanvas = () => {
  const c = document.createElement('canvas');
  c.width = CANVAS_WIDTH;
  c.height = CANVAS_HEIGHT;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  return c.toDataURL('image/png');
};

const getInitialState = () => {
  try {
    const saved = localStorage.getItem('multipulti_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.history?.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}
  return null;
};

export default function App() {
  const [initialState] = useState(getInitialState);
  
  const [history, setHistory] = useState<{frames: string[]}[]>(initialState?.history || [{ frames: [getBlankCanvas()] }]);
  const [historyIndex, setHistoryIndex] = useState(initialState?.historyIndex ?? 0);
  const [currentFrame, setCurrentFrame] = useState(initialState?.currentFrame ?? 0);
  
  const [tool, setTool] = useState('brush');
  const [color, setColor] = useState(BASIC_COLORS[0].hex);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1].size);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(FPS_OPTIONS[1].fps);
  const [isExporting, setIsExporting] = useState(false);

  const [recentColors, setRecentColors] = useState<string[]>(initialState?.recentColors || []);
  const [favoriteColors, setFavoriteColors] = useState<string[]>(initialState?.favoriteColors || []);
  const [showColorModal, setShowColorModal] = useState(false);
  const [customHue, setCustomHue] = useState(0);
  const [customSat, setCustomSat] = useState(100);
  const [customVal, setCustomVal] = useState(100);
  const colorSquareRef = useRef<HTMLDivElement>(null);

  const [activeSticker, setActiveSticker] = useState<{emoji: string, x: number, y: number, size: number} | null>(null);
  const [selectedSticker, setSelectedSticker] = useState<string>('⭐');
  const [showStickerPanel, setShowStickerPanel] = useState(false);

  const [assistMode, setAssistMode] = useState(false);
  const [symmetryMode, setSymmetryMode] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [showTemplatesPanel, setShowTemplatesPanel] = useState(false);
  const [feedback, setFeedback] = useState<{text: string, id: number} | null>(null);
  const pointsRef = useRef<{x: number, y: number}[]>([]);

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isMovingStickerRef = useRef(false);
  const isResizingStickerRef = useRef(false);
  const initialStickerPosRef = useRef({ x: 0, y: 0 });
  const initialStickerSizeRef = useRef(100);

  const frames = history[historyIndex].frames;

  useEffect(() => {
    try {
      const stateToSave = {
        history,
        historyIndex,
        currentFrame,
        favoriteColors,
        recentColors
      };
      localStorage.setItem('multipulti_state', JSON.stringify(stateToSave));
    } catch (e) {
      console.warn("Failed to save state to localStorage (might be too large)", e);
      try {
        const minimalState = {
          history: [history[historyIndex]],
          historyIndex: 0,
          currentFrame,
          favoriteColors,
          recentColors
        };
        localStorage.setItem('multipulti_state', JSON.stringify(minimalState));
      } catch (e2) {
        console.error("Even minimal state is too large", e2);
      }
    }
  }, [history, historyIndex, currentFrame, favoriteColors, recentColors]);

  // Save state to history
  const saveState = useCallback((newFrames: string[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ frames: newFrames });
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const finalizeSticker = useCallback(() => {
    if (!activeSticker) return;
    const mainCanvas = mainCanvasRef.current;
    const mainCtx = mainCanvas?.getContext('2d', { willReadFrequently: true });
    if (!mainCanvas || !mainCtx) return;

    mainCtx.font = `${activeSticker.size}px Arial`;
    mainCtx.textAlign = 'center';
    mainCtx.textBaseline = 'middle';
    mainCtx.fillText(activeSticker.emoji, activeSticker.x, activeSticker.y);

    const newFrames = [...frames];
    newFrames[currentFrame] = mainCanvas.toDataURL('image/png');
    saveState(newFrames);
    
    setActiveSticker(null);
    
    const overlayCanvas = overlayCanvasRef.current;
    const overlayCtx = overlayCanvas?.getContext('2d');
    if (overlayCtx && overlayCanvas) {
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
    playPop();
  }, [activeSticker, frames, currentFrame, saveState]);

  const cancelSticker = useCallback(() => {
    setActiveSticker(null);
    const overlayCanvas = overlayCanvasRef.current;
    const overlayCtx = overlayCanvas?.getContext('2d');
    if (overlayCtx && overlayCanvas) {
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
    playPop();
  }, []);

  const handleSetTool = useCallback((newTool: string) => {
    if (tool === 'sticker' && newTool !== 'sticker' && activeSticker) {
      finalizeSticker();
    }
    setTool(newTool);
  }, [tool, activeSticker, finalizeSticker]);

  // Redraw main canvas when frame changes or history changes
  useEffect(() => {
    if (isDrawingRef.current) return;
    const canvas = mainCanvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = frames[currentFrame] || getBlankCanvas();
  }, [frames, currentFrame]);

  // Playback loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentFrame(prev => (prev + 1) % frames.length);
      }, 1000 / fps);
    }
    return () => clearInterval(interval);
  }, [isPlaying, fps, frames.length]);

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleColorSelect = useCallback((c: string) => {
    setColor(c);
    setRecentColors(prev => {
      const newRecent = [c, ...prev.filter(col => col !== c)].slice(0, 8);
      return newRecent;
    });
  }, []);

  const toggleFavorite = (c: string) => {
    setFavoriteColors(prev => 
      prev.includes(c) ? prev.filter(col => col !== c) : [...prev, c]
    );
    playPop();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPlaying) return;
    const { x, y } = getCoordinates(e);
    const mainCanvas = mainCanvasRef.current;
    const mainCtx = mainCanvas?.getContext('2d', { willReadFrequently: true });
    if (!mainCanvas || !mainCtx) return;

    if (tool === 'pipette') {
      const pixel = mainCtx.getImageData(x, y, 1, 1).data;
      if (pixel[3] === 0) {
        handleColorSelect('#FFFFFF');
      } else {
        const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
        handleColorSelect(hex);
      }
      setTool('brush');
      playPop();
      return;
    }

    if (tool === 'sticker') {
      if (activeSticker) {
        const halfSize = activeSticker.size / 2;
        const handleSize = 24;
        const handleX = activeSticker.x + halfSize;
        const handleY = activeSticker.y + halfSize;
        
        if (Math.abs(x - handleX) < handleSize && Math.abs(y - handleY) < handleSize) {
          isResizingStickerRef.current = true;
          startPosRef.current = { x, y };
          initialStickerSizeRef.current = activeSticker.size;
          return;
        }
        
        if (Math.abs(x - activeSticker.x) < halfSize && Math.abs(y - activeSticker.y) < halfSize) {
          isMovingStickerRef.current = true;
          startPosRef.current = { x, y };
          initialStickerPosRef.current = { x: activeSticker.x, y: activeSticker.y };
          return;
        }
        
        finalizeSticker();
        return;
      } else {
        setActiveSticker({ emoji: selectedSticker, x, y, size: 100 });
        playPop();
        return;
      }
    }

    if (tool === 'fill') {
      playAction();
      floodFill(mainCtx, Math.floor(x), Math.floor(y), color);
      const newFrames = [...frames];
      newFrames[currentFrame] = mainCanvas.toDataURL('image/png');
      saveState(newFrames);
      return;
    }

    if (tool === 'brush') {
      isDrawingRef.current = true;
      pointsRef.current = [{x, y}];
      const overlayCtx = overlayCanvasRef.current?.getContext('2d');
      if (overlayCtx) {
        drawSmoothedCurve(overlayCtx, pointsRef.current, color, brushSize, symmetryMode);
      }
      return;
    }

    if (tool === 'eraser') {
      isDrawingRef.current = true;
      startPosRef.current = { x, y };
      mainCtx.lineCap = 'round';
      mainCtx.lineJoin = 'round';
      mainCtx.lineWidth = brushSize;
      mainCtx.strokeStyle = '#FFFFFF';
      
      mainCtx.beginPath();
      mainCtx.moveTo(x, y);
      mainCtx.lineTo(x, y);
      mainCtx.stroke();
      
      if (symmetryMode) {
          mainCtx.beginPath();
          mainCtx.moveTo(CANVAS_WIDTH - x, y);
          mainCtx.lineTo(CANVAS_WIDTH - x, y);
          mainCtx.stroke();
      }
      return;
    }

    isDrawingRef.current = true;
    startPosRef.current = { x, y };

    mainCtx.lineCap = 'round';
    mainCtx.lineJoin = 'round';
    mainCtx.lineWidth = brushSize;
    mainCtx.strokeStyle = color;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPlaying) return;
    const { x, y } = getCoordinates(e);
    
    if (tool === 'sticker' && activeSticker) {
      if (isMovingStickerRef.current) {
        const dx = x - startPosRef.current.x;
        const dy = y - startPosRef.current.y;
        setActiveSticker({
          ...activeSticker,
          x: initialStickerPosRef.current.x + dx,
          y: initialStickerPosRef.current.y + dy
        });
      } else if (isResizingStickerRef.current) {
        const dx = x - startPosRef.current.x;
        const newSize = Math.max(30, initialStickerSizeRef.current + dx * 2);
        setActiveSticker({
          ...activeSticker,
          size: newSize
        });
      }
      return;
    }

    if (!isDrawingRef.current) return;
    const mainCtx = mainCanvasRef.current?.getContext('2d', { willReadFrequently: true });
    const overlayCanvas = overlayCanvasRef.current;
    const overlayCtx = overlayCanvas?.getContext('2d');
    
    if (!mainCtx || !overlayCanvas || !overlayCtx) return;

    if (tool === 'brush') {
      pointsRef.current.push({x, y});
      drawSmoothedCurve(overlayCtx, pointsRef.current, color, brushSize, symmetryMode);
      return;
    }
    
    if (tool === 'eraser') {
      const prev = startPosRef.current;
      mainCtx.beginPath();
      mainCtx.moveTo(prev.x, prev.y);
      mainCtx.lineTo(x, y);
      mainCtx.stroke();
      
      if (symmetryMode) {
          mainCtx.beginPath();
          mainCtx.moveTo(CANVAS_WIDTH - prev.x, prev.y);
          mainCtx.lineTo(CANVAS_WIDTH - x, y);
          mainCtx.stroke();
      }
      startPosRef.current = { x, y };
      return;
    }

    // Shapes
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    overlayCtx.lineCap = 'round';
    overlayCtx.lineJoin = 'round';
    overlayCtx.lineWidth = brushSize;
    overlayCtx.strokeStyle = color;
    
    const startX = startPosRef.current.x;
    const startY = startPosRef.current.y;

    overlayCtx.beginPath();
    if (tool === 'line') {
      overlayCtx.moveTo(startX, startY);
      overlayCtx.lineTo(x, y);
    } else if (tool === 'rect') {
      overlayCtx.rect(startX, startY, x - startX, y - startY);
    } else if (tool === 'circle') {
      const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
      overlayCtx.arc(startX, startY, radius, 0, 2 * Math.PI);
    }
    overlayCtx.stroke();
  };

  const handlePointerUp = () => {
    if (isPlaying) return;
    
    if (tool === 'sticker') {
      isMovingStickerRef.current = false;
      isResizingStickerRef.current = false;
      return;
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const mainCanvas = mainCanvasRef.current;
    const mainCtx = mainCanvas?.getContext('2d', { willReadFrequently: true });
    const overlayCanvas = overlayCanvasRef.current;
    const overlayCtx = overlayCanvas?.getContext('2d');

    if (!mainCanvas || !mainCtx || !overlayCanvas || !overlayCtx) return;

    if (tool === 'brush') {
      let shapeDetected = false;
      if (assistMode) {
          const shape = detectShape(pointsRef.current);
          if (shape) {
              overlayCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
              drawPerfectShape(overlayCtx, shape, color, brushSize, symmetryMode);
              shapeDetected = true;
              playPop();
          }
      }
      
      mainCtx.drawImage(overlayCanvas, 0, 0);
      overlayCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      const newFrames = [...frames];
      newFrames[currentFrame] = mainCanvas.toDataURL('image/png');
      saveState(newFrames);
      
      if (assistMode && pointsRef.current.length > 20 && Math.random() > 0.5) {
          const msgs = ["Супер!", "Класс!", "Отлично!", "Красота!", "Волшебно!"];
          setFeedback({ text: msgs[Math.floor(Math.random() * msgs.length)], id: Date.now() });
          setTimeout(() => setFeedback(null), 2000);
      }
      return;
    }

    if (tool === 'eraser') {
      const newFrames = [...frames];
      newFrames[currentFrame] = mainCanvas.toDataURL('image/png');
      saveState(newFrames);
      return;
    }

    if (tool === 'line' || tool === 'rect' || tool === 'circle') {
      mainCtx.drawImage(overlayCanvas, 0, 0);
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }

    const newFrames = [...frames];
    newFrames[currentFrame] = mainCanvas.toDataURL('image/png');
    saveState(newFrames);
  };

  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current;
    const overlayCtx = overlayCanvas?.getContext('2d');
    if (!overlayCanvas || !overlayCtx) return;

    if (tool === 'sticker') {
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      if (activeSticker) {
        overlayCtx.font = `${activeSticker.size}px Arial`;
        overlayCtx.textAlign = 'center';
        overlayCtx.textBaseline = 'middle';
        overlayCtx.fillText(activeSticker.emoji, activeSticker.x, activeSticker.y);
        
        const halfSize = activeSticker.size / 2;
        
        overlayCtx.strokeStyle = '#3B82F6';
        overlayCtx.lineWidth = 2;
        overlayCtx.setLineDash([5, 5]);
        overlayCtx.strokeRect(activeSticker.x - halfSize, activeSticker.y - halfSize, activeSticker.size, activeSticker.size);
        overlayCtx.setLineDash([]);
        
        overlayCtx.fillStyle = '#3B82F6';
        const handleSize = 20;
        overlayCtx.fillRect(activeSticker.x + halfSize - handleSize/2, activeSticker.y + halfSize - handleSize/2, handleSize, handleSize);
        
        overlayCtx.fillStyle = '#FFFFFF';
        overlayCtx.font = '12px Arial';
        overlayCtx.fillText('⤡', activeSticker.x + halfSize, activeSticker.y + halfSize);
      }
    } else if (!isDrawingRef.current) {
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
  }, [activeSticker, tool]);

  // Timeline actions
  const addFrame = () => {
    playPop();
    const newFrames = [...frames];
    newFrames.splice(currentFrame + 1, 0, getBlankCanvas());
    saveState(newFrames);
    setCurrentFrame(currentFrame + 1);
  };

  const copyFrame = () => {
    playPop();
    const newFrames = [...frames];
    newFrames.splice(currentFrame + 1, 0, frames[currentFrame]);
    saveState(newFrames);
    setCurrentFrame(currentFrame + 1);
  };

  const deleteFrame = () => {
    if (frames.length <= 1) {
      playError();
      return;
    }
    playSwoosh();
    const newFrames = [...frames];
    newFrames.splice(currentFrame, 1);
    saveState(newFrames);
    setCurrentFrame(Math.min(currentFrame, newFrames.length - 1));
  };

  const clearCanvas = () => {
    playSwoosh();
    const newFrames = [...frames];
    newFrames[currentFrame] = getBlankCanvas();
    saveState(newFrames);
  };

  // File actions
  const savePng = () => {
    playAction();
    const link = document.createElement('a');
    link.download = `рисунок-${Date.now()}.png`;
    link.href = frames[currentFrame];
    link.click();
  };

  const saveGif = async () => {
    if (frames.length <= 1) {
      alert('Нужно больше одного кадра для мультика!');
      return;
    }
    playAction();
    setIsExporting(true);
    try {
      const blob = await exportToGif(frames, fps, CANVAS_WIDTH, CANVAS_HEIGHT);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `мультик-${Date.now()}.gif`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Ошибка при сохранении GIF');
    }
    setIsExporting(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = mainCanvasRef.current;
        const ctx = canvas?.getContext('2d', { willReadFrequently: true });
        if (!canvas || !ctx) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const newFrames = [...frames];
        newFrames[currentFrame] = canvas.toDataURL('image/png');
        saveState(newFrames);
        playPop();
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-screen bg-blue-50 font-sans text-gray-800">
      {/* Top Menu */}
      <header className="h-16 bg-white border-b-4 border-black flex items-center justify-between px-4 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-yellow-400 rounded-full border-4 border-black flex items-center justify-center">
            <Film className="w-5 h-5 text-black" />
          </div>
          <h1 className="text-xl font-black tracking-wider text-black uppercase hidden sm:block" style={{ WebkitTextStroke: '1px white' }}>
            Мульти-Пульти
          </h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            className="btn-kid p-2 text-blue-600" 
            onClick={() => { playPop(); setHistoryIndex(Math.max(0, historyIndex - 1)); }}
            disabled={historyIndex === 0 || isPlaying}
            title="Отменить"
          >
            <Undo className="w-6 h-6" />
          </button>
          <button 
            className="btn-kid p-2 text-blue-600" 
            onClick={() => { playPop(); setHistoryIndex(Math.min(history.length - 1, historyIndex + 1)); }}
            disabled={historyIndex === history.length - 1 || isPlaying}
            title="Повторить"
          >
            <Redo className="w-6 h-6" />
          </button>
          
          <div className="w-1 h-8 bg-gray-300 mx-1 rounded-full" />
          
          <button className="btn-kid p-2 text-green-600" onClick={() => fileInputRef.current?.click()} title="Загрузить картинку">
            <ImageIcon className="w-6 h-6" />
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
          
          <button className="btn-kid p-2 text-red-600" onClick={clearCanvas} title="Очистить холст">
            <Trash className="w-6 h-6" />
          </button>
          
          <button className="btn-kid p-2 text-purple-600" onClick={savePng} title="Сохранить картинку">
            <Download className="w-6 h-6" />
          </button>
          <button className="btn-kid p-2 px-4 text-pink-600 flex items-center gap-2" onClick={saveGif} disabled={isExporting}>
            {isExporting ? <span className="animate-pulse">⏳...</span> : <><Save className="w-6 h-6" /> <span className="hidden sm:inline">GIF</span></>}
          </button>
        </div>
      </header>

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbar */}
        <aside className="w-24 sm:w-32 bg-white border-r-4 border-black flex flex-col items-center py-4 gap-6 overflow-y-auto shrink-0 z-10">
          
          {/* Tools */}
          <div className="flex flex-col gap-3 w-full px-2">
            {TOOLS.map(t => (
              <button
                key={t.id}
                className={cn("btn-kid p-3 flex flex-col gap-1", tool === t.id && "btn-kid-active")}
                onClick={() => { 
                  playPop(); 
                  handleSetTool(t.id); 
                  if (t.id === 'sticker' && !activeSticker) setShowStickerPanel(true);
                }}
                title={t.label}
              >
                <t.icon className="w-6 h-6" />
                <span className="text-[10px] sm:text-xs font-bold leading-none">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="w-16 h-1 bg-gray-200 rounded-full" />

          {/* Smart Features */}
          <div className="flex flex-col gap-3 w-full px-2">
            <div className="text-[9px] sm:text-[10px] font-bold text-gray-400 text-center uppercase tracking-wider">Магия</div>
            <button
                className={cn("btn-kid p-3 flex flex-col gap-1", assistMode && "bg-purple-100 border-purple-400 text-purple-600")}
                onClick={() => { playPop(); setAssistMode(!assistMode); }}
                title="Умный помощник (сглаживание и ровные фигуры)"
            >
                <Wand2 className="w-6 h-6" />
                <span className="text-[9px] sm:text-[10px] font-bold leading-none text-center">Помощник</span>
            </button>
            <button
                className={cn("btn-kid p-3 flex flex-col gap-1", symmetryMode && "bg-blue-100 border-blue-400 text-blue-600")}
                onClick={() => { playPop(); setSymmetryMode(!symmetryMode); }}
                title="Симметричное рисование"
            >
                <FlipHorizontal className="w-6 h-6" />
                <span className="text-[9px] sm:text-[10px] font-bold leading-none text-center">Симметрия</span>
            </button>
            <button
                className={cn("btn-kid p-3 flex flex-col gap-1", activeTemplate && "bg-green-100 border-green-400 text-green-600")}
                onClick={() => { playPop(); setShowTemplatesPanel(true); }}
                title="Шаблоны для обводки"
            >
                <BookTemplate className="w-6 h-6" />
                <span className="text-[9px] sm:text-[10px] font-bold leading-none text-center">Шаблоны</span>
            </button>
          </div>

          <div className="w-16 h-1 bg-gray-200 rounded-full" />

          {tool === 'sticker' ? (
            <div className="flex flex-col items-center gap-2 w-full px-2 pb-4">
              <span className="text-xs font-bold text-gray-500 text-center">Выбран:</span>
              <button 
                className="text-4xl hover:scale-110 transition-transform p-2 rounded-xl bg-blue-50 border-4 border-blue-200 w-full flex justify-center"
                onClick={() => setShowStickerPanel(true)}
                title="Выбрать другой стикер"
              >
                {selectedSticker}
              </button>
              
              {activeSticker && (
                <div className="flex flex-col gap-2 w-full mt-2">
                  <button 
                    className="btn-kid bg-green-500 text-white py-2 flex justify-center items-center gap-1"
                    onClick={finalizeSticker}
                  >
                    <Check className="w-5 h-5" /> ОК
                  </button>
                  <button 
                    className="btn-kid bg-red-500 text-white py-2 flex justify-center items-center gap-1"
                    onClick={cancelSticker}
                  >
                    <X className="w-5 h-5" /> Отмена
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Brush Size */}
              <div className="flex flex-col gap-2 items-center">
                {BRUSH_SIZES.map(s => (
                  <button
                    key={s.id}
                    className={cn("btn-kid p-2 rounded-full w-12 h-12 flex items-center justify-center", brushSize === s.size && "btn-kid-active")}
                    onClick={() => { playPop(); setBrushSize(s.size); }}
                    title={s.label}
                  >
                    <div className="bg-black rounded-full" style={{ width: s.size, height: s.size }} />
                  </button>
                ))}
              </div>

              <div className="w-16 h-1 bg-gray-200 rounded-full" />

              {/* Current Color & Palette */}
              <div className="flex flex-col items-center gap-2 px-2 w-full pb-4">
                <div className="text-[9px] sm:text-[10px] font-bold text-gray-400 text-center uppercase tracking-wider">Цвет</div>
                
                <div className="relative mb-2">
                  <div 
                    className="w-14 h-14 rounded-full border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center transition-colors"
                    style={{ backgroundColor: color }}
                  />
                  <button 
                    className="absolute -bottom-2 -right-2 bg-white rounded-full p-1.5 border-2 border-black shadow-sm hover:scale-110 active:scale-95 transition-transform"
                    onClick={() => { playPop(); setShowColorModal(true); }}
                    title="Больше цветов"
                  >
                    <Palette className="w-5 h-5 text-pink-500" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 w-full">
                  {BASIC_COLORS.slice(0, 8).map(c => (
                    <button
                      key={c.hex}
                      title={c.name}
                      className={cn(
                        "w-full aspect-square rounded-full border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] active:translate-y-[2px] active:shadow-none transition-all",
                        color === c.hex && "scale-110 shadow-none translate-y-[2px] ring-4 ring-blue-400 ring-offset-2"
                      )}
                      style={{ backgroundColor: c.hex }}
                      onClick={() => { playPop(); handleColorSelect(c.hex); }}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </aside>

        {/* Canvas Area */}
        <main className="flex-1 flex items-center justify-center bg-gray-200 p-4 sm:p-8 overflow-hidden relative">
          <div 
            className="relative bg-white border-8 border-black rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)] overflow-hidden w-full max-w-4xl"
            style={{ aspectRatio: '4/3' }}
          >
            <canvas
              ref={mainCanvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="absolute inset-0 w-full h-full"
            />
            <canvas
              ref={overlayCanvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="absolute inset-0 w-full h-full"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerOut={handlePointerUp}
            />
            {activeTemplate && (
              <img 
                src={TEMPLATES.find(t => t.id === activeTemplate)?.url} 
                className="absolute inset-0 w-full h-full object-contain opacity-30 pointer-events-none"
                alt="Template"
              />
            )}
            {feedback && (
              <div 
                  key={feedback.id}
                  className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl sm:text-6xl font-black text-yellow-400 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] animate-bounce z-50 pointer-events-none"
                  style={{ WebkitTextStroke: '2px #FF3B30' }}
              >
                  {feedback.text}
              </div>
            )}
            {isPlaying && (
              <div className="absolute top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-full font-bold animate-pulse border-4 border-black">
                🔴 ЗАПИСЬ
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Bottom Timeline */}
      <footer className="h-40 bg-white border-t-4 border-black p-4 flex flex-col gap-2 shrink-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button 
              className={cn("btn-kid px-4 py-2 gap-2 text-white", isPlaying ? "!bg-red-500 hover:!bg-red-400" : "!bg-green-500 hover:!bg-green-400")}
              onClick={() => { playAction(); setIsPlaying(!isPlaying); }}
            >
              {isPlaying ? <><StopCircle className="w-6 h-6 fill-current"/> Стоп</> : <><Play className="w-6 h-6 fill-current"/> Играть</>}
            </button>
            
            <div className="hidden sm:flex items-center gap-2 bg-gray-100 p-1 rounded-2xl border-4 border-black ml-4">
              {FPS_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  className={cn("px-3 py-1 rounded-xl font-bold text-sm transition-all", fps === opt.fps ? "bg-white shadow-sm border-2 border-black" : "text-gray-500 hover:bg-gray-200")}
                  onClick={() => { playPop(); setFps(opt.fps); }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="btn-kid p-2 text-blue-500" onClick={addFrame} disabled={isPlaying} title="Новый кадр">
              <Plus className="w-6 h-6" />
            </button>
            <button className="btn-kid p-2 text-orange-500" onClick={copyFrame} disabled={isPlaying} title="Копировать кадр">
              <Copy className="w-6 h-6" />
            </button>
            <button className="btn-kid p-2 text-red-500" onClick={deleteFrame} disabled={isPlaying || frames.length <= 1} title="Удалить кадр">
              <Trash className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Frames List */}
        <div className="flex-1 flex items-center gap-3 overflow-x-auto pb-2 px-2 snap-x">
          {frames.map((frame, idx) => (
            <div 
              key={idx}
              className={cn(
                "relative h-full aspect-[4/3] bg-white border-4 rounded-xl shrink-0 cursor-pointer snap-center transition-all overflow-hidden",
                currentFrame === idx ? "border-blue-500 scale-105 shadow-[0_0_0_4px_rgba(59,130,246,0.3)]" : "border-gray-300 hover:border-gray-400"
              )}
              onClick={() => {
                if (!isPlaying) {
                  playPop();
                  setCurrentFrame(idx);
                }
              }}
            >
              <img src={frame} alt={`Кадр ${idx + 1}`} className="w-full h-full object-contain bg-white" />
              <div className="absolute bottom-1 right-1 bg-black text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                {idx + 1}
              </div>
            </div>
          ))}
          {!isPlaying && (
            <button 
              className="h-full aspect-[4/3] border-4 border-dashed border-gray-300 rounded-xl shrink-0 flex items-center justify-center text-gray-400 hover:text-blue-500 hover:border-blue-500 hover:bg-blue-50 transition-all"
              onClick={addFrame}
            >
              <Plus className="w-8 h-8" />
            </button>
          )}
        </div>
      </footer>

      {/* Templates Panel Modal */}
      {showTemplatesPanel && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl border-8 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-2xl font-black uppercase text-black">Выбери шаблон</h2>
              <button className="btn-kid p-2 text-red-500" onClick={() => setShowTemplatesPanel(false)}>
                <X className="w-8 h-8" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <button 
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-4 transition-all hover:scale-105",
                  activeTemplate === null ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"
                )}
                onClick={() => { setActiveTemplate(null); setShowTemplatesPanel(false); playPop(); }}
              >
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">❌</div>
                <span className="font-bold text-sm">Без шаблона</span>
              </button>
              {TEMPLATES.map(t => (
                <button 
                  key={t.id}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-4 transition-all hover:scale-105",
                    activeTemplate === t.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"
                  )}
                  onClick={() => { setActiveTemplate(t.id); setShowTemplatesPanel(false); playPop(); }}
                >
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-2xl">{t.icon}</div>
                  <span className="font-bold text-sm">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sticker Panel Modal */}
      {showStickerPanel && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl border-8 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h2 className="text-2xl font-black uppercase text-black">Выбери стикер</h2>
              <button className="btn-kid p-2 text-red-500" onClick={() => setShowStickerPanel(false)}>
                <X className="w-8 h-8" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 flex flex-col gap-6 pr-2">
              {STICKERS.map(cat => (
                <div key={cat.category}>
                  <h3 className="text-xl font-bold mb-3 text-gray-700 border-b-4 border-gray-200 pb-1">{cat.category}</h3>
                  <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                    {cat.items.map(emoji => (
                      <button 
                        key={emoji}
                        className={cn(
                          "text-4xl hover:scale-110 transition-transform p-2 rounded-xl hover:bg-gray-100 flex items-center justify-center aspect-square",
                          selectedSticker === emoji && "bg-blue-100 ring-4 ring-blue-500"
                        )}
                        onClick={() => {
                          setSelectedSticker(emoji);
                          setShowStickerPanel(false);
                          handleSetTool('sticker');
                          playPop();
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Color Palette Modal */}
      {showColorModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-3xl border-8 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-2xl font-black uppercase text-black flex items-center gap-2">
                <Palette className="w-8 h-8 text-pink-500" /> Палитра цветов
              </h2>
              <button className="btn-kid p-2 text-red-500" onClick={() => setShowColorModal(false)}>
                <X className="w-8 h-8" />
              </button>
            </div>
            
            <div className="flex flex-col md:flex-row gap-6 overflow-y-auto pr-2">
              {/* Left side: Basic, Recent, Favorites */}
              <div className="flex-1 flex flex-col gap-6">
                
                {/* Current Color & Favorite toggle */}
                <div className="flex items-center gap-4 bg-gray-100 p-4 rounded-2xl border-4 border-gray-200">
                  <div className="w-16 h-16 rounded-full border-4 border-black shadow-md" style={{ backgroundColor: color }} />
                  <div className="flex-1">
                    <div className="text-lg font-bold">Текущий цвет</div>
                  </div>
                  <button 
                    className={cn("btn-kid p-3 transition-colors", favoriteColors.includes(color) ? "text-yellow-500 bg-yellow-50 border-yellow-400" : "text-gray-400")}
                    onClick={() => toggleFavorite(color)}
                    title="В любимые"
                  >
                    <Star className={cn("w-8 h-8", favoriteColors.includes(color) && "fill-current")} />
                  </button>
                </div>

                {/* Favorites */}
                {favoriteColors.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-gray-700">
                      <Star className="w-5 h-5 fill-yellow-500 text-yellow-500"/> Любимые цвета
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {favoriteColors.map(c => (
                        <button 
                          key={c} 
                          className="w-12 h-12 rounded-full border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] active:translate-y-[2px] active:shadow-none transition-all" 
                          style={{ backgroundColor: c }} 
                          onClick={() => { playPop(); handleColorSelect(c); }} 
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent */}
                {recentColors.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold mb-3 text-gray-700">Недавние</h3>
                    <div className="flex flex-wrap gap-3">
                      {recentColors.map((c, i) => (
                        <button 
                          key={i} 
                          className="w-12 h-12 rounded-full border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] active:translate-y-[2px] active:shadow-none transition-all" 
                          style={{ backgroundColor: c }} 
                          onClick={() => { playPop(); handleColorSelect(c); }} 
                        />
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Basic Colors */}
                <div>
                  <h3 className="text-lg font-bold mb-3 text-gray-700">Основные</h3>
                  <div className="flex flex-wrap gap-3">
                    {BASIC_COLORS.map(c => (
                      <button 
                        key={c.hex} 
                        title={c.name}
                        className="w-12 h-12 rounded-full border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] active:translate-y-[2px] active:shadow-none transition-all" 
                        style={{ backgroundColor: c.hex }} 
                        onClick={() => { playPop(); handleColorSelect(c.hex); }} 
                      />
                    ))}
                  </div>
                </div>

              </div>

              {/* Right side: Custom Color Picker */}
              <div className="flex-1 flex flex-col gap-4 bg-blue-50 p-6 rounded-3xl border-4 border-blue-200">
                <h3 className="text-xl font-bold text-center text-blue-800">Создать свой цвет</h3>
                
                {/* Color Square */}
                <div 
                  ref={colorSquareRef}
                  className="w-full aspect-square rounded-2xl border-4 border-black relative touch-none cursor-crosshair overflow-hidden shadow-inner"
                  style={{ backgroundColor: `hsl(${customHue}, 100%, 50%)` }}
                  onPointerDown={(e) => {
                    if (!colorSquareRef.current) return;
                    (e.target as HTMLElement).setPointerCapture(e.pointerId);
                    const rect = colorSquareRef.current.getBoundingClientRect();
                    const s = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                    const v = Math.max(0, Math.min(100, 100 - ((e.clientY - rect.top) / rect.height) * 100));
                    setCustomSat(s); setCustomVal(v);
                  }}
                  onPointerMove={(e) => {
                    if (e.buttons > 0 && colorSquareRef.current) {
                      const rect = colorSquareRef.current.getBoundingClientRect();
                      const s = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                      const v = Math.max(0, Math.min(100, 100 - ((e.clientY - rect.top) / rect.height) * 100));
                      setCustomSat(s); setCustomVal(v);
                    }
                  }}
                >
                  {/* Saturation gradient (white to transparent) */}
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #fff, transparent)' }} />
                  {/* Value gradient (transparent to black) */}
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #000, transparent)' }} />
                  
                  {/* Picker Handle */}
                  <div 
                    className="absolute w-6 h-6 border-4 border-white rounded-full shadow-[0_0_4px_rgba(0,0,0,0.5)] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ 
                      left: `${customSat}%`, 
                      top: `${100 - customVal}%`,
                      backgroundColor: hsvToHex(customHue, customSat, customVal)
                    }}
                  />
                </div>

                {/* Hue Slider */}
                <div className="flex flex-col gap-2 mt-2">
                  <label className="text-sm font-bold text-gray-600 uppercase tracking-wider">Радуга</label>
                  <input 
                    type="range" min="0" max="360" 
                    value={customHue} onChange={(e) => setCustomHue(Number(e.target.value))}
                    className="color-slider w-full h-8 rounded-full border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    style={{ 
                      background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
                    }}
                  />
                </div>

                <button 
                  className="btn-kid !bg-green-500 hover:!bg-green-400 text-white py-4 mt-4 text-xl flex items-center justify-center gap-2"
                  onClick={() => { 
                    playPop();
                    handleColorSelect(hsvToHex(customHue, customSat, customVal)); 
                    setShowColorModal(false); 
                  }}
                >
                  <Check className="w-8 h-8" /> Выбрать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
