import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function getGeminiClient(): GoogleGenAI | null {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GOOGLE_API_KEY,
  ];
  const apiKey = candidates
    .map((k) => (typeof k === 'string' ? k.trim() : ''))
    .find((k) => Boolean(k) && k !== 'MY_GEMINI_API_KEY');

  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function ensureWavBase64(base64Data: string, mimeType?: string): string {
  const rawBuf = Buffer.from(base64Data, 'base64');
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
  header.writeUInt16LE(1, 20);
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/tts', async (req, res) => {
    try {
      const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
      const voiceId =
        typeof req.body?.voiceId === 'string' ? req.body.voiceId : 'south_female_mai';

      if (!rawText) {
        res.status(400).json({ error: 'Nội dung cần đọc không được để trống.' });
        return;
      }

      if (rawText.length > 600) {
        res.status(400).json({ error: 'Nội dung đọc vượt quá 600 ký tự.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'Chưa thiết lập GEMINI_API_KEY trên máy chủ. Vui lòng kiểm tra mục Settings > Secrets (hoặc Environment Variables trên Vercel).',
        });
        return;
      }

      const profile =
        SOUTHERN_VIETNAMESE_VOICES[voiceId] ?? SOUTHERN_VIETNAMESE_VOICES.south_female_mai;

      const audioBase64 = await generateSouthernVietnameseSpeech(ai, rawText, profile);
      if (!audioBase64) {
        res.status(502).json({ error: 'Mô hình AI không trả về dữ liệu âm thanh.' });
        return;
      }

      res.json({
        audioBase64,
        mimeType: 'audio/wav',
      });
    } catch (err) {
      console.error('Lỗi tạo giọng đọc AI:', err);
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối dịch vụ giọng đọc AI.';
      res.status(500).json({
        error: `Không thể tạo giọng đọc AI: ${msg}`,
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });

    // Serve a clean HMR-disabled /@vite/client module so browsers never open failing WebSockets
    app.get('/@vite/client', (_req, res) => {
      res.type('application/javascript').send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function injectQuery(url) { return url; }
export function createHotContext() {
  return {
    data: {},
    accept() {},
    dispose() {},
    prune() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export class ErrorOverlay extends HTMLElement {}
`);
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
