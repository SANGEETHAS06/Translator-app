import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface TranscriptEntry {
  id: string;
  timestamp: string;
  original: string;
  translated: string;
  language: string;
}

export async function transcribeAudioChunk(base64Audio: string, mimeType: string): Promise<Partial<TranscriptEntry>> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            mimeType,
            data: base64Audio,
          },
        },
        {
          text: `You are an expert polyglot translator. Transcribe the speech in this audio accurately. 
          1. Detect the spoken language.
          2. Return a transcript in the original language.
          3. Return an English translation (leave empty if original is English).
          
          Format the output as a strict JSON object:
          {
            "original": "text",
            "translated": "text",
            "language": "language name"
          }
          
          If there is absolutely no speech (only background noise or silence), return:
          {
            "original": "[Silence]",
            "translated": "",
            "language": "N/A"
          }`,
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            original: { type: Type.STRING },
            translated: { type: Type.STRING },
            language: { type: Type.STRING },
          },
          required: ["original", "translated", "language"],
        },
      },
    });

    const result = JSON.parse(response.text);
    return {
      ...result,
      timestamp: new Date().toLocaleTimeString(),
    };
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}
