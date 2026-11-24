import { SouthernVoiceId } from '../types/game';

export interface SouthernVoiceOption {
  id: SouthernVoiceId;
  name: string;
  gender: 'Nữ' | 'Nam';
  regionLabel: string;
  description: string;
}

export const SOUTHERN_VOICE_OPTIONS: SouthernVoiceOption[] = [
  {
    id: 'south_female_mai',
    name: 'Cô Mai',
    gender: 'Nữ',
    regionLabel: 'Nữ miền Nam',
    description: 'Giọng Sài Gòn dịu dàng, ấm áp, phù hợp Mầm non & Tiểu học',
  },
  {
    id: 'south_female_linh',
    name: 'Chị Linh',
    gender: 'Nữ',
    regionLabel: 'Nữ miền Nam',
    description: 'Giọng miền Nam vui tươi, năng động, hào hứng',
  },
  {
    id: 'south_female_ngoc',
    name: 'Cô Ngọc',
    gender: 'Nữ',
    regionLabel: 'Nữ miền Nam',
    description: 'Giọng miền Tây ngọt ngào, truyền cảm, rõ ràng',
  },
  {
    id: 'south_male_nam',
    name: 'Thầy Nam',
    gender: 'Nam',
    regionLabel: 'Nam miền Nam',
    description: 'Giọng Sài Gòn trầm ấm, điềm tĩnh, thân thiện',
  },
  {
    id: 'south_male_minh',
    name: 'Anh Minh',
    gender: 'Nam',
    regionLabel: 'Nam miền Nam',
    description: 'Giọng miền Nam trẻ trung, sôi nổi, lôi cuốn',
  },
  {
    id: 'south_male_hung',
    name: 'Chú Hùng',
    gender: 'Nam',
    regionLabel: 'Nam miền Nam',
    description: 'Giọng Nam Bộ hào sảng, vui tính, khích lệ học sinh',
  },
];

// In-memory cache of base64 WAV audio keyed by `${voiceId}::${text}`
const ttsCache = new Map<string, string>();
let activeAudio: HTMLAudioElement | null = null;

export function stopActiveAiVoice(): void {
  if (activeAudio) {
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio.pause();
    activeAudio.src = '';
    activeAudio = null;
  }
}

export async function fetchAiVoiceBase64(
  text: string,
  voiceId: SouthernVoiceId
): Promise<string> {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Vui lòng nhập câu mẫu để tạo giọng đọc AI.');
  }

  const key = `${voiceId}::${cleanText}`;
  const cached = ttsCache.get(key);
  if (cached) return cached;

  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: cleanText, voiceId }),
  });

  const data = (await response.json()) as { audioBase64?: string; error?: string };
  if (!response.ok || !data.audioBase64) {
    throw new Error(data.error || 'Không thể tạo giọng đọc AI.');
  }

  ttsCache.set(key, data.audioBase64);
  return data.audioBase64;
}

export async function playAiVoiceFeedback(
  text: string,
  voiceId: SouthernVoiceId
): Promise<void> {
  stopActiveAiVoice();

  const audioBase64 = await fetchAiVoiceBase64(text, voiceId);

  await new Promise<void>((resolve, reject) => {
    const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
    activeAudio = audio;

    audio.onended = () => {
      if (activeAudio === audio) activeAudio = null;
      resolve();
    };
    audio.onerror = () => {
      if (activeAudio === audio) activeAudio = null;
      reject(new Error('Không thể phát tệp âm thanh phản hồi.'));
    };

    audio.play().catch((err) => {
      if (activeAudio === audio) activeAudio = null;
      reject(err);
    });
  });
}

export function buildFeedbackSpeechText(params: {
  isCorrect: boolean;
  isUnanswered: boolean;
  correctAnswerTexts: string[];
  explanation?: string;
  showCorrectAnswer: boolean;
  customCorrectSample?: string;
  customWrongSample?: string;
}): string {
  const {
    isCorrect,
    isUnanswered,
    correctAnswerTexts,
    explanation,
    showCorrectAnswer,
    customCorrectSample,
    customWrongSample,
  } = params;

  if (isCorrect) {
    const base = customCorrectSample?.trim() || 'Chính xác.';
    return explanation ? `${base} ${explanation}` : base;
  }

  const customWrong = customWrongSample?.trim();
  const intro = customWrong
    ? customWrong
    : isUnanswered
    ? 'Hết thời gian.'
    : 'Chưa chính xác.';

  const parts = [intro];
  if (showCorrectAnswer && correctAnswerTexts.length > 0) {
    parts.push(`Đáp án đúng là ${correctAnswerTexts.join(', ')}.`);
  }
  if (explanation) {
    parts.push(explanation);
  }
  return parts.join(' ');
}
