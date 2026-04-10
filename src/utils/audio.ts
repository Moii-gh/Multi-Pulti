const getAudioCtx = () => {
  if (typeof window === 'undefined') return null;
  return new (window.AudioContext || (window as any).webkitAudioContext)();
};

let audioCtx: AudioContext | null = null;

function playTone(freq: number, type: OscillatorType, duration: number) {
  if (!audioCtx) audioCtx = getAudioCtx();
  if (!audioCtx) return;
  
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

export const playPop = () => playTone(800, 'sine', 0.1);
export const playSwoosh = () => playTone(300, 'triangle', 0.15);
export const playAction = () => playTone(600, 'square', 0.1);
export const playError = () => playTone(150, 'sawtooth', 0.3);
