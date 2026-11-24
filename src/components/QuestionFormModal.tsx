import React, { useState } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  Music,
  Video,
  Check,
  Trash2,
  Eye,
  Volume2,
  Loader2,
} from 'lucide-react';
import {
  AnswerOption,
  MediaType,
  Question,
  QuestionType,
  SouthernVoiceId,
} from '../types/game';
import { fetchAiVoiceBase64, SOUTHERN_VOICE_OPTIONS } from '../services/aiVoice';
import { MascotCharacter } from './MascotCharacter';

interface QuestionFormModalProps {
  initialQuestion: Question | null;
  defaultTimeLimit: number;
  onSave: (question: Question) => void;
  onClose: () => void;
}

const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string; desc: string }[] = [
  { value: 'choice_2', label: 'Trắc nghiệm 2 đáp án', desc: 'Chọn A (Trái) hoặc B (Phải)' },
  { value: 'choice_3', label: 'Trắc nghiệm 3 đáp án', desc: 'Chọn A (Trái), B (Ngẩng) hoặc C (Phải)' },
  { value: 'choice_4', label: 'Trắc nghiệm 4 đáp án', desc: 'Chọn A, B, C, D theo 4 hướng' },
  { value: 'multi_select', label: 'Trắc nghiệm nhiều đáp án', desc: 'Cho phép chọn từ 2 đáp án đúng trở lên' },
  { value: 'true_false', label: 'Câu hỏi Đúng hoặc Sai', desc: '2 phương án phân biệt Đúng / Sai' },
  { value: 'image_choice', label: 'Câu hỏi có hình ảnh minh họa', desc: 'Đính kèm ảnh vào câu hỏi hoặc đáp án' },
  { value: 'audio_choice', label: 'Câu hỏi có âm thanh', desc: 'Phát tệp âm thanh khi hiển thị câu hỏi' },
  { value: 'video_choice', label: 'Câu hỏi có video minh họa', desc: 'Phát video ngắn kèm câu hỏi' },
  { value: 'text_image', label: 'Kết hợp văn bản và hình ảnh', desc: 'Nội dung chữ kết hợp hình ảnh trực quan' },
];

const LABELS = ['A', 'B', 'C', 'D'];

function getExpectedOptionCount(type: QuestionType, currentCount: number): number {
  if (type === 'choice_2' || type === 'true_false') return 2;
  if (type === 'choice_3') return 3;
  if (type === 'choice_4') return 4;
  return Math.max(2, Math.min(4, currentCount || 4));
}

function getDefaultMediaType(type: QuestionType, existing: MediaType): MediaType {
  if (type === 'image_choice' || type === 'text_image') return 'image';
  if (type === 'audio_choice') return 'audio';
  if (type === 'video_choice') return 'video';
  return existing;
}

export const QuestionFormModal: React.FC<QuestionFormModalProps> = ({
  initialQuestion,
  defaultTimeLimit,
  onSave,
  onClose,
}) => {
  const [type, setType] = useState<QuestionType>(initialQuestion?.type ?? 'choice_2');
  const [prompt, setPrompt] = useState<string>(initialQuestion?.prompt ?? '');
  const [mediaType, setMediaType] = useState<MediaType>(initialQuestion?.mediaType ?? 'none');
  const [mediaUrl, setMediaUrl] = useState<string>(initialQuestion?.mediaUrl ?? '');
  const [mediaName, setMediaName] = useState<string>(initialQuestion?.mediaName ?? '');
  const [options, setOptions] = useState<AnswerOption[]>(() => {
    if (initialQuestion?.options?.length) {
      return initialQuestion.options.map((o) => ({ ...o }));
    }
    return [
      { id: crypto.randomUUID(), label: 'A', text: '' },
      { id: crypto.randomUUID(), label: 'B', text: '' },
    ];
  });
  const [correctOptionIds, setCorrectOptionIds] = useState<string[]>(
    initialQuestion?.correctOptionIds ?? []
  );
  const [explanation, setExplanation] = useState<string>(initialQuestion?.explanation ?? '');
  const [aiAudioText, setAiAudioText] = useState<string>('');
  const [aiAudioVoiceId, setAiAudioVoiceId] = useState<SouthernVoiceId>('south_female_mai');
  const [generatingAiAudio, setGeneratingAiAudio] = useState<boolean>(false);
  const [timeLimit, setTimeLimit] = useState<string>(
    initialQuestion ? String(initialQuestion.timeLimit) : defaultTimeLimit ? String(defaultTimeLimit) : ''
  );
  const [points, setPoints] = useState<string>(initialQuestion ? String(initialQuestion.points) : '');
  const [error, setError] = useState<string>('');
  const [showPreview, setShowPreview] = useState<boolean>(false);

  const handleTypeChange = (nextType: QuestionType) => {
    setType(nextType);
    setMediaType((prev) => getDefaultMediaType(nextType, prev));

    const targetCount = getExpectedOptionCount(nextType, options.length);
    setOptions((prev) => {
      const copy = [...prev];
      while (copy.length < targetCount) {
        copy.push({
          id: crypto.randomUUID(),
          label: LABELS[copy.length],
          text: '',
        });
      }
      if (copy.length > targetCount && (nextType === 'choice_2' || nextType === 'choice_3' || nextType === 'choice_4' || nextType === 'true_false')) {
        return copy.slice(0, targetCount);
      }
      return copy.map((o, idx) => ({ ...o, label: LABELS[idx] }));
    });

    if (nextType !== 'multi_select' && correctOptionIds.length > 1) {
      setCorrectOptionIds([correctOptionIds[0]]);
    }
  };

  const handleAdjustOptionCount = (count: number) => {
    setOptions((prev) => {
      const next = [...prev];
      while (next.length < count) {
        next.push({ id: crypto.randomUUID(), label: LABELS[next.length], text: '' });
      }
      return next.slice(0, count).map((o, i) => ({ ...o, label: LABELS[i] }));
    });
  };

  const toggleCorrect = (optId: string) => {
    if (type === 'multi_select') {
      setCorrectOptionIds((prev) =>
        prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId]
      );
    } else {
      setCorrectOptionIds([optId]);
    }
  };

  const handleMediaFileUpload = (file: File, target: 'question' | string) => {
    if (file.size > 15 * 1024 * 1024) {
      setError('Tệp đính kèm vượt quá giới hạn 15MB. Vui lòng chọn tệp nhẹ hơn hoặc dùng đường dẫn URL.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      if (target === 'question') {
        setMediaUrl(result);
        setMediaName(file.name);
      } else {
        setOptions((prev) =>
          prev.map((o) => (o.id === target ? { ...o, imageUrl: result } : o))
        );
      }
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      setError('Vui lòng nhập nội dung câu hỏi.');
      return;
    }

    const validOptions = options.map((o, idx) => ({
      ...o,
      label: LABELS[idx],
      text: o.text.trim(),
    }));

    if (validOptions.some((o) => !o.text && !o.imageUrl)) {
      setError('Vui lòng nhập nội dung (hoặc ảnh) cho tất cả các phương án trả lời.');
      return;
    }

    const validOptionIds = new Set(validOptions.map((o) => o.id));
    const filteredCorrect = correctOptionIds.filter((id) => validOptionIds.has(id));

    if (filteredCorrect.length === 0) {
      setError('Vui lòng đánh dấu ít nhất một đáp án chính xác.');
      return;
    }

    const parsedTime = Number(timeLimit);
    const parsedPoints = Number(points);

    if (!timeLimit || Number.isNaN(parsedTime) || parsedTime < 0) {
      setError('Vui lòng nhập thời gian trả lời hợp lệ (tính bằng giây, từ 0 trở lên).');
      return;
    }

    if (!points || Number.isNaN(parsedPoints) || parsedPoints <= 0) {
      setError('Vui lòng nhập điểm số lớn hơn 0.');
      return;
    }

    const question: Question = {
      id: initialQuestion?.id ?? crypto.randomUUID(),
      type,
      prompt: cleanPrompt,
      mediaType: mediaUrl.trim() ? mediaType : 'none',
      mediaUrl: mediaUrl.trim() || undefined,
      mediaName: mediaName || undefined,
      options: validOptions,
      correctOptionIds: filteredCorrect,
      explanation: explanation.trim() || undefined,
      timeLimit: parsedTime,
      points: parsedPoints,
      order: initialQuestion?.order ?? 0,
    };

    onSave(question);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <h2 className="font-display text-xl font-bold text-slate-900">
            {initialQuestion ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreview((p) => !p)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showPreview ? 'Quay lại soạn thảo' : 'Xem trước'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {showPreview ? (
          <div className="p-6 overflow-y-auto space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-5">
              <div className="text-center space-y-3">
                <p className="text-xs font-medium text-slate-500">
                  Xem trước giao diện học sinh · {points || '0'} điểm · {timeLimit || '0'} giây
                </p>
                <h3 className="font-display text-xl font-bold text-slate-900">
                  {prompt || '(Chưa nhập nội dung câu hỏi)'}
                </h3>
                {mediaUrl && mediaType === 'image' && (
                  <img
                    src={mediaUrl}
                    alt="Minh họa câu hỏi"
                    referrerPolicy="no-referrer"
                    className="max-h-52 mx-auto rounded-xl object-contain border border-slate-200 bg-white"
                  />
                )}
                {mediaUrl && mediaType === 'audio' && (
                  <audio controls src={mediaUrl} className="mx-auto w-full max-w-md" />
                )}
                {mediaUrl && mediaType === 'video' && (
                  <video controls src={mediaUrl} className="max-h-52 mx-auto rounded-xl" />
                )}
              </div>

              <div className="flex justify-center py-2">
                <MascotCharacter characterId="owl" direction="neutral" size={88} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {options.map((opt) => {
                  const isCorrect = correctOptionIds.includes(opt.id);
                  return (
                    <div
                      key={opt.id}
                      className={`p-3.5 rounded-xl border bg-white flex items-center gap-3 ${
                        isCorrect ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200'
                      }`}
                    >
                      <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 font-bold text-sm flex items-center justify-center shrink-0">
                        {opt.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        {opt.imageUrl && (
                          <img
                            src={opt.imageUrl}
                            alt={`Đáp án ${opt.label}`}
                            referrerPolicy="no-referrer"
                            className="h-14 rounded object-contain mb-1"
                          />
                        )}
                        <p className="text-sm font-medium text-slate-900">
                          {opt.text || '(Trống)'}
                        </p>
                      </div>
                      {isCorrect && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
                {error}
              </div>
            )}

            {/* Question Type */}
            <div className="space-y-1.5">
              <label htmlFor="q-type" className="block text-sm font-semibold text-slate-800">
                Dạng câu hỏi
              </label>
              <select
                id="q-type"
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {QUESTION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} — {opt.desc}
                  </option>
                ))}
              </select>
            </div>

            {/* Prompt */}
            <div className="space-y-1.5">
              <label htmlFor="q-prompt" className="block text-sm font-semibold text-slate-800">
                Nội dung câu hỏi <span className="text-red-600">*</span>
              </label>
              <textarea
                id="q-prompt"
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Nhập câu hỏi bài học tại đây..."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Media Attachment */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">
                  Tư liệu đính kèm (hình ảnh, âm thanh, video — không bắt buộc)
                </span>
                <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg">
                  {(
                    [
                      { id: 'none', label: 'Không có', icon: null },
                      { id: 'image', label: 'Hình ảnh', icon: <ImageIcon className="w-3.5 h-3.5" /> },
                      { id: 'audio', label: 'Âm thanh', icon: <Music className="w-3.5 h-3.5" /> },
                      { id: 'video', label: 'Video', icon: <Video className="w-3.5 h-3.5" /> },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setMediaType(item.id);
                        if (item.id === 'none') {
                          setMediaUrl('');
                          setMediaName('');
                        }
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        mediaType === item.id
                          ? 'bg-sky-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {mediaType !== 'none' && (
                <div className="space-y-2.5">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={mediaUrl.startsWith('data:') ? mediaName || 'Đã tải tệp lên từ máy' : mediaUrl}
                      onChange={(e) => {
                        setMediaUrl(e.target.value);
                        setMediaName('');
                      }}
                      placeholder={`Dán đường dẫn URL ${
                        mediaType === 'image' ? 'hình ảnh' : mediaType === 'audio' ? 'âm thanh' : 'video'
                      } hoặc tải tệp từ thiết bị`}
                      className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <label className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Tải tệp lên</span>
                      <input
                        type="file"
                        accept={
                          mediaType === 'image'
                            ? 'image/*'
                            : mediaType === 'audio'
                            ? 'audio/*'
                            : 'video/*'
                        }
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleMediaFileUpload(file, 'question');
                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                    </label>
                    {mediaUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setMediaUrl('');
                          setMediaName('');
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Xóa tư liệu"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {mediaUrl && mediaType === 'image' && (
                    <img
                      src={mediaUrl}
                      alt="Xem trước hình ảnh"
                      referrerPolicy="no-referrer"
                      className="max-h-36 rounded-lg border border-slate-200 bg-white object-contain"
                    />
                  )}
                  {mediaUrl && mediaType === 'audio' && (
                    <audio controls src={mediaUrl} className="w-full" />
                  )}
                  {mediaUrl && mediaType === 'video' && (
                    <video controls src={mediaUrl} className="max-h-40 rounded-lg bg-black" />
                  )}

                  {mediaType === 'audio' && (
                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700">
                          Hoặc nhập câu mẫu để tạo âm thanh bằng giọng đọc AI:
                        </span>
                        <select
                          value={aiAudioVoiceId}
                          onChange={(e) => setAiAudioVoiceId(e.target.value as SouthernVoiceId)}
                          className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50"
                        >
                          {SOUTHERN_VOICE_OPTIONS.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.regionLabel})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          maxLength={600}
                          value={aiAudioText}
                          onChange={(e) => {
                            setAiAudioText(e.target.value);
                            if (error) setError('');
                          }}
                          placeholder="Nhập câu mẫu tiếng Việt để tạo tệp âm thanh AI..."
                          className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        <button
                          type="button"
                          disabled={generatingAiAudio}
                          onClick={async () => {
                            const clean = aiAudioText.trim();
                            if (!clean) {
                              setError('Vui lòng nhập câu mẫu trước khi tạo âm thanh bằng giọng đọc AI.');
                              return;
                            }
                            setError('');
                            try {
                              setGeneratingAiAudio(true);
                              const b64 = await fetchAiVoiceBase64(clean, aiAudioVoiceId);
                              setMediaUrl(`data:audio/wav;base64,${b64}`);
                              setMediaName('Giọng đọc AI.wav');
                            } catch (err) {
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : 'Không thể tạo âm thanh bằng giọng đọc AI.'
                              );
                            } finally {
                              setGeneratingAiAudio(false);
                            }
                          }}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg disabled:opacity-60 shrink-0"
                        >
                          {generatingAiAudio ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                          <span>{generatingAiAudio ? 'Đang tạo...' : 'Tạo giọng đọc AI'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Answer Options */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-semibold text-slate-800">
                  Các phương án trả lời & Đáp án đúng <span className="text-red-600">*</span>
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  {type === 'true_false' && (
                    <button
                      type="button"
                      onClick={() =>
                        setOptions((prev) => [
                          { ...prev[0], text: 'Đúng' },
                          { ...prev[1], text: 'Sai' },
                        ])
                      }
                      className="px-2.5 py-1 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-md"
                    >
                      Điền nhanh: Đúng / Sai
                    </button>
                  )}

                  {(type === 'multi_select' ||
                    type === 'image_choice' ||
                    type === 'audio_choice' ||
                    type === 'video_choice' ||
                    type === 'text_image') && (
                    <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
                      {[2, 3, 4].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => handleAdjustOptionCount(cnt)}
                          className={`px-2 py-1 text-xs font-medium rounded-md ${
                            options.length === cnt
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600'
                          }`}
                        >
                          {cnt} đáp án
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2.5">
                {options.map((opt, idx) => {
                  const isCorrect = correctOptionIds.includes(opt.id);
                  return (
                    <div
                      key={opt.id}
                      className={`p-3 rounded-xl border transition-colors ${
                        isCorrect
                          ? 'border-emerald-400 bg-emerald-50/40'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => toggleCorrect(opt.id)}
                          className={`w-9 h-9 rounded-lg border font-bold text-sm flex items-center justify-center shrink-0 transition-colors ${
                            isCorrect
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-emerald-400'
                          }`}
                          title={isCorrect ? 'Đang chọn là đáp án đúng' : 'Nhấn để chọn làm đáp án đúng'}
                        >
                          {isCorrect ? <Check className="w-4 h-4" /> : opt.label}
                        </button>

                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOptions((prev) =>
                              prev.map((item) =>
                                item.id === opt.id ? { ...item, text: val } : item
                              )
                            );
                          }}
                          placeholder={`Nhập nội dung đáp án ${LABELS[idx]}...`}
                          className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />

                        <label
                          className="p-2 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded-lg cursor-pointer transition-colors"
                          title="Đính kèm ảnh cho phương án này"
                        >
                          <ImageIcon className="w-4 h-4" />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleMediaFileUpload(file, opt.id);
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {opt.imageUrl && (
                        <div className="mt-2 ml-11 flex items-center gap-2">
                          <img
                            src={opt.imageUrl}
                            alt={`Ảnh đáp án ${opt.label}`}
                            referrerPolicy="no-referrer"
                            className="h-16 rounded border border-slate-200 object-contain bg-white"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setOptions((prev) =>
                                prev.map((item) =>
                                  item.id === opt.id ? { ...item, imageUrl: undefined } : item
                                )
                              )
                            }
                            className="text-xs text-red-600 hover:underline"
                          >
                            Xóa ảnh
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500">
                Nhấn vào chữ cái (A, B, C, D) bên trái mỗi dòng để đánh dấu đáp án đúng.
                {type === 'multi_select' && ' Dạng nhiều đáp án cho phép chọn nhiều ô cùng lúc.'}
              </p>
            </div>

            {/* Time, Points, Explanation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="q-time" className="block text-sm font-semibold text-slate-800">
                  Thời gian trả lời (giây) <span className="text-red-600">*</span>
                </label>
                <input
                  id="q-time"
                  type="number"
                  min={0}
                  max={600}
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(e.target.value)}
                  placeholder="VD: 20"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="q-points" className="block text-sm font-semibold text-slate-800">
                  Điểm số <span className="text-red-600">*</span>
                </label>
                <input
                  id="q-points"
                  type="number"
                  min={1}
                  max={1000}
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  placeholder="VD: 10"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="q-explain" className="block text-sm font-semibold text-slate-800">
                Giải thích đáp án (hiển thị sau khi trả lời — không bắt buộc)
              </label>
              <textarea
                id="q-explain"
                rows={2}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Nhập lời giải thích để học sinh hiểu sâu hơn..."
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors"
              >
                {initialQuestion ? 'Cập nhật câu hỏi' : 'Lưu câu hỏi'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
