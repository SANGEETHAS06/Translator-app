import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  Square, 
  Upload, 
  Languages, 
  Copy, 
  Download, 
  Trash2, 
  History, 
  Volume2, 
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { transcribeAudioChunk, TranscriptEntry } from '@/src/lib/gemini';
import AudioVisualizer from '@/src/components/AudioVisualizer';

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(mediaStream);
      
      const recorder = new MediaRecorder(mediaStream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          processAudioChunk(e.data);
        }
      };

      recorder.onstop = async () => {
        setIsRecording(false);
      };

      recorder.start(8000); // Automatically slice data every 8 seconds
      setIsRecording(true);
      setError(null);
    } catch (err) {
      console.error("Mic access denied:", err);
      setError("Microphone access denied. Please check your settings.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      stream?.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const processAudioChunk = async (blob: Blob) => {
    if (blob.size < 1000) return; // Ignore tiny chunks

    try {
      setIsProcessing(true);
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        try {
          const result = await transcribeAudioChunk(base64Audio, 'audio/webm');
          
          if (result.original?.trim() && result.original.toLowerCase() !== '[silence]') {
            const newEntry: TranscriptEntry = {
              id: crypto.randomUUID(),
              timestamp: result.timestamp || new Date().toLocaleTimeString(),
              original: result.original || '',
              translated: result.translated || '',
              language: result.language || 'Unknown',
            };
            setTranscripts(prev => [...prev, newEntry]);
          }
        } catch (err) {
          console.error("Transcription chunk failed:", err);
        } finally {
          setIsProcessing(false);
        }
      };
    } catch (err) {
      console.error("FileReader error:", err);
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      setError(null);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        const result = await transcribeAudioChunk(base64Audio, file.type);
        
        const newEntry: TranscriptEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date().toLocaleTimeString(),
          original: result.original || '',
          translated: result.translated || '',
          language: result.language || 'Detected',
        };
        setTranscripts(prev => [...prev, newEntry]);
        setIsProcessing(false);
      };
    } catch (err) {
      setError("Failed to process audio file.");
      setIsProcessing(false);
    }
  };

  const copyTranscript = () => {
    const text = transcripts.map(t => `[${t.timestamp}] (${t.language}) ${t.original} -> ${t.translated}`).join('\n');
    navigator.clipboard.writeText(text);
    alert("Transcript copied to clipboard!");
  };

  const downloadTranscript = () => {
    const text = transcripts.map(t => `[${t.timestamp}] (${t.language})\nOriginal: ${t.original}\nEnglish: ${t.translated}\n---`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen font-sans p-4 md:p-8 flex flex-col items-center bg-slate-950">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full" />
      </div>

      <header className="w-full max-w-4xl flex justify-between items-center mb-8 relative">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
            <Languages className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">VoxLingo</h1>
            <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">Real-time Multimodal Analysis</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setTranscripts([])}
            className="p-2 hover:bg-white/5 rounded-lg text-slate-400 transition-colors"
            title="Clear All"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
        {/* Recording Panel */}
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Interface Status</span>
              <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${isRecording ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-green-500/20 text-green-500'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isRecording ? 'bg-red-500' : 'bg-green-500'}`} />
                {isRecording ? 'Live Recording' : 'Standby'}
              </div>
            </div>

            <div className="mb-8 flex flex-col items-center">
              <div className="relative mb-6">
                <AnimatePresence>
                  {isRecording && (
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1.1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="absolute inset-0 bg-red-500/20 blur-2xl rounded-full"
                    />
                  )}
                </AnimatePresence>
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${isRecording ? 'bg-red-500 scale-90' : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/30'}`}
                >
                  {isRecording ? (
                    <Square className="w-8 h-8 text-white fill-white" />
                  ) : (
                    <Mic className="w-8 h-8 text-white" />
                  )}
                </button>
              </div>
              <div className="text-center">
                <span className="text-3xl font-mono font-medium text-white tabular-nums">
                  {formatTime(recordingTime)}
                </span>
              </div>
            </div>

            <AudioVisualizer stream={stream} isRecording={isRecording} />

            <div className="mt-8 space-y-3">
              <label className="flex items-center gap-3 w-full p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-all group">
                <Upload className="w-5 h-5 text-slate-400 group-hover:text-blue-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-200">Upload Media</p>
                  <p className="text-xs text-slate-500">WAV, MP3, WEBM</p>
                </div>
                <input type="file" className="hidden" accept="audio/*" onChange={handleFileUpload} />
              </label>
            </div>
          </section>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-400 leading-snug">{error}</p>
            </div>
          )}

          {isProcessing && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              <p className="text-sm text-blue-400 font-medium">Analyzing audio streams...</p>
            </div>
          )}
        </div>

        {/* Transcript Area */}
        <div className="lg:col-span-2 flex flex-col h-[600px]">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col h-full shadow-2xl overflow-hidden">
            <div className="p-4 border-bottom border-white/5 bg-white/[0.02] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-medium text-slate-300">Live Transcript Feedback</h2>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={copyTranscript}
                  disabled={transcripts.length === 0}
                  className="p-2 hover:bg-white/5 rounded-lg text-slate-400 disabled:opacity-30 transition-all"
                  title="Copy All"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button 
                  onClick={downloadTranscript}
                  disabled={transcripts.length === 0}
                  className="p-2 hover:bg-white/5 rounded-lg text-slate-400 disabled:opacity-30 transition-all"
                  title="Download TXT"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-white/10"
            >
              <AnimatePresence initial={false}>
                {transcripts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                    <Volume2 className="w-12 h-12" />
                    <p className="text-sm">No audio data detected yet.<br/>Start recording or upload a file.</p>
                  </div>
                ) : (
                  transcripts.map((entry, index) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className="group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="pt-1.5 shink-0">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-mono text-slate-500 uppercase">{entry.timestamp}</span>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-bold text-blue-400 uppercase letter-spacing-wider">
                              <Languages className="w-2.5 h-2.5" />
                              {entry.language}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-white/[0.03] border border-white/[0.05] rounded-xl hover:border-white/10 transition-colors">
                              <p className="text-[10px] font-mono text-slate-500 uppercase mb-2">Original</p>
                              <p className="text-slate-200 leading-relaxed">{entry.original}</p>
                            </div>
                            {entry.translated && entry.language.toLowerCase() !== 'english' && (
                              <div className="p-4 bg-green-500/[0.03] border border-green-500/[0.1] rounded-xl hover:border-green-500/20 transition-colors shadow-inner shadow-green-500/10">
                                <p className="text-[10px] font-mono text-green-500 uppercase mb-2">English Translation</p>
                                <p className="text-green-50/90 leading-relaxed font-medium italic">{entry.translated}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            <div className="p-4 bg-white/[0.02] border-t border-white/5">
               <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  <span>AI Engine 1.5-Flash Active</span>
                  <span className="mx-2 opacity-30">|</span>
                  <span>Low Latency Context Windows</span>
               </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-auto pt-8 pb-4">
        <p className="text-[10px] font-mono text-slate-600 uppercase tracking-[0.3em]">
          Powered by Google Gemini Multimodal SDK • Secure End-to-End Processing
        </p>
      </footer>
    </div>
  );
}
