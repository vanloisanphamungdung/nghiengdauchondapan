import type { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleGenAI } from '@google/genai';

interface VoiceProfile {
  prebuiltVoice: 'Kore' | 'Zephyr' | 'Puck' | 'Charon' | 'Fenrir';
  style: string;
}

const SOUTHERN_VIETNAMESE_VOICES: Record<string, VoiceProfile> = {
  south_female_mai: {
    prebuiltVoice: 'Kore',
    style:
      'Speak Vietnamese with an authentic, warm, gentle Southern Vietnamese (Saigon / Nam Bộ) female teacher accent. Friendly, reassuring, clear pronunciation for students.',
  },
  south_female_linh: {
    prebuiltVoice: 'Zephyr',
    style:
      'Speak Vietnamese with a bright, cheerful, energetic Southern Vietnamese (Miền Nam) young female accent. Joyful and enthusiastic educational game host tone.',
  },
  south_female_ngoc: {
    prebuiltVoice: 'Kore',
    style:
      'Speak Vietnamese with a sweet, articulate, expressive Mekong Delta (Miền Tây Nam Bộ) female educator accent. Steady pace, warm encouragement.',
  },
  south_male_nam: {
    prebuiltVoice: 'Charon',
    style:
      'Speak Vietnamese with a warm, calm, reassuring Southern Vietnamese (Saigon / Nam Bộ) male teacher accent. Clear, trustworthy, friendly voice.',
  },
  south_male_minh: {
    prebuiltVoice: 'Puck',
    style:
      'Speak Vietnamese with an upbeat, lively, friendly young Southern Vietnamese (Miền Nam) male accent. Enthusiastic and encouraging tone for quiz games.',
  },
  south_male_hung: {
    prebuiltVoice: 'Fenrir',
    style:
      'Speak Vietnamese with a hearty, cheerful, motivating Southern Vietnamese (Nam Bộ) male voice. Warm, encouraging and clear pronunciation.',
  },
};

function sendJson(res: ServerResponse, statusCode: number, payload: Record<string, unknown>): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage & { body?: unknown }): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk as Uint8Array));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getGeminiApiKey(): string | null {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GOOGLE_API_KEY,
  ];
  for (const key of candidates) {
    if (typeof key === 'string') {
      const trimmed = key.trim();
      if (trimmed && trimmed !== 'MY_GEMINI_API_KEY') {
        return trimmed;
      }
    }
  }
  return null;
}

function ensureWavBase64(base64Data: string, mimeType?: string): string {
  const rawBuf = Buffer.from(base64Data, 'base64');
  // Already has RIFF WAV header
  if (rawBuf.length >= 12 && rawBuf.subarray(0, 4).toString('ascii') === 'RIFF') {
    return base64Data;
  }

  const normalizedMime = (mimeType || '').toLowerCase();
  if (
    normalizedMime &&
    !normalizedMime.includes('l16') &&
    !normalizedMime.includes('pcm') &&
    !normalizedMime.includes('wav')
  ) {
    return base64Data;
  }

  // Wrap raw 24kHz mono 16-bit PCM (Gemini TTS streaming/preview format) in a standard 44-byte RIFF WAV header
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = rawBuf.length;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, rawBuf]).toString('base64');
}

async function generateSouthernVietnameseSpeech(
  ai: GoogleGenAI,
  text: string,
  profile: VoiceProfile
): Promise<string | undefined> {
  const attempts: Array<{ model: string; useSpeechMetadata: boolean }> = [
    { model: 'gemini-3.8-flash-tts', useSpeechMetadata: true },
    { model: 'gemini-3.8-flash-lite-tts', useSpeechMetadata: true },
    { model: 'gemini-2.5-flash-preview-tts', useSpeechMetadata: false },
  ];

  let lastError: unknown = null;

  for (const attempt of attempts) {
    try {
      const part = attempt.useSpeechMetadata
        ? { text, speechMetadata: { style: profile.style } }
        : { text };

      const response = await ai.models.generateContent({
        model: attempt.model,
        contents: [
          {
            role: 'user',
            parts: [part],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: profile.prebuiltVoice },
            },
          },
        },
      });

      const inlineData = response.candidates?.[0]?.content?.parts?.find(
        (p) => Boolean(p.inlineData?.data)
      )?.inlineData;

      if (inlineData?.data) {
        return ensureWavBase64(inlineData.data, inlineData.mimeType);
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError) {
    throw lastError;
  }
  return undefined;
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Phương thức không hợp lệ. Chỉ hỗ trợ POST.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const rawText = typeof body.text === 'string' ? body.text.trim() : '';
    const voiceId = typeof body.voiceId === 'string' ? body.voiceId : 'south_female_mai';

    if (!rawText) {
      sendJson(res, 400, { error: 'Nội dung cần đọc không được để trống.' });
      return;
    }

    if (rawText.length > 600) {
      sendJson(res, 400, { error: 'Nội dung đọc vượt quá 600 ký tự.' });
      return;
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      sendJson(res, 503, {
        error:
          'Chưa thiết lập GEMINI_API_KEY trên máy chủ. Khi deploy lên Vercel, vui lòng thêm biến môi trường GEMINI_API_KEY trong Settings > Environment Variables rồi Redeploy.',
      });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      apiVersion: 'v1beta',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const profile =
      SOUTHERN_VIETNAMESE_VOICES[voiceId] ?? SOUTHERN_VIETNAMESE_VOICES.south_female_mai;

    const audioBase64 = await generateSouthernVietnameseSpeech(ai, rawText, profile);
    if (!audioBase64) {
      sendJson(res, 502, { error: 'Mô hình AI không trả về dữ liệu âm thanh.' });
      return;
    }

    sendJson(res, 200, {
      audioBase64,
      mimeType: 'audio/wav',
    });
  } catch (err) {
    console.error('Lỗi tạo giọng đọc AI (/api/tts):', err);
    const msg = err instanceof Error ? err.message : 'Lỗi kết nối dịch vụ giọng đọc AI.';
    sendJson(res, 500, {
      error: `Không thể tạo giọng đọc AI: ${msg}`,
    });
  }
}
