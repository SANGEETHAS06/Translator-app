import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  stream: MediaStream | null;
  isRecording: boolean;
}

export default function AudioVisualizer({ stream, isRecording }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (!stream || !isRecording) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const audioContext = audioContextRef.current;
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 256;
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyzer);

    analyzerRef.current = analyzer;
    sourceRef.current = source;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyzer.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;

        // Gradient for a hardware-synth look
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#3b82f6'); // blue
        gradient.addColorStop(0.5, '#8b5cf6'); // purple
        gradient.addColorStop(1, '#ec4899'); // pink

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (sourceRef.current) sourceRef.current.disconnect();
    };
  }, [stream, isRecording]);

  return (
    <canvas 
      ref={canvasRef} 
      width={600} 
      height={100} 
      className="w-full h-24 bg-black/20 rounded-lg border border-white/10"
    />
  );
}
