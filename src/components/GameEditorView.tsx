import React, { useRef, useState } from 'react';
import {
  Plus,
  Save,
  Play,
  Upload,
  Download,
  FileSpreadsheet,
  ArrowUp,
  ArrowDown,
  Copy,
  Edit3,
  Trash2,
  Eye,
  BookOpen,
  CheckCircle2,
  ArrowLeft,
  Volume2,
  Loader2,
} from 'lucide-react';
import {
  EvaluationRule,
  GameConfig,
  GradeLevel,
  PlayMode,
  Question,
  QuestionType,
  SouthernVoiceId,
} from '../types/game';
import { QuestionFormModal } from './QuestionFormModal';
import {
  downloadQuestionTemplate,
  exportQuestionsToSpreadsheet,
  parseQuestionsFromFile,
} from '../services/excelCsv';
import {
  playAiVoiceFeedback,
  SOUTHERN_VOICE_OPTIONS,
  stopActiveAiVoice,
} from '../services/aiVoice';

interface GameEditorViewProps {
  game: GameConfig;
  onSaveGame: (game: GameConfig) => Promise<void>;
  onStartPlay: (game: GameConfig) => void;
  onBackHome: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  choice_2: 'Trắc nghiệm 2 đáp án',
  choice_3: 'Trắc nghiệm 3 đáp án',
  choice_4: 'Trắc nghiệm 4 đáp án',
  multi_select: 'Nhiều đáp án đúng',
  true_false: 'Đúng / Sai',
  image_choice: 'Có hình ảnh',
  audio_choice: 'Có âm thanh',
  video_choice: 'Có video',
  text_image: 'Văn bản & Hình ảnh',
};

const GRADE_LEVEL_PRESETS = [
  'Mầm non',
  'Tiểu học',
  'THCS',
  'THPT',
  'Giáo dục thường xuyên',
  'Đại học / Cao đẳng',
];

function getSuggestedClasses(level: string): string[] {
  if (level === 'Mầm non') return ['Nhà trẻ', 'Lớp Mầm', 'Lớp Chồi', 'Lớp Lá'];
  if (level === 'Tiểu học') return ['Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5'];
  if (level === 'THCS') return ['Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9'];
  if (level === 'THPT') return ['Lớp 10', 'Lớp 11', 'Lớp 12'];
  return [];
}

function getSuggestedSubjects(level: string): string[] {
  if (level === 'Mầm non') {
    return [
      'Làm quen chữ cái',
      'Làm quen với Toán',
      'Khám phá khoa học',
      'Khám phá xã hội',
      'Âm nhạc',
      'Tạo hình',
      'Kỹ năng sống',
    ];
  }
  if (level === 'Tiểu học') {
    return [
      'Toán',
      'Tiếng Việt',
      'Tiếng Anh',
      'Tự nhiên và Xã hội',
      'Khoa học',
      'Lịch sử và Địa lý',
      'Đạo đức',
      'Tin học',
      'Công nghệ',
      'Âm nhạc',
      'Mỹ thuật',
      'Hoạt động trải nghiệm',
    ];
  }
  if (level === 'THCS') {
    return [
      'Toán học',
      'Ngữ văn',
      'Tiếng Anh',
      'Khoa học tự nhiên',
      'Lịch sử và Địa lý',
      'Giáo dục công dân',
      'Tin học',
      'Công nghệ',
      'Âm nhạc',
      'Mỹ thuật',
      'Hoạt động trải nghiệm',
    ];
  }
  if (level === 'THPT') {
    return [
      'Toán học',
      'Ngữ văn',
      'Tiếng Anh',
      'Vật lý',
      'Hóa học',
      'Sinh học',
      'Lịch sử',
      'Địa lý',
      'Giáo dục kinh tế và pháp luật',
      'Tin học',
      'Công nghệ',
    ];
  }
  return [
    'Toán học',
    'Tiếng Việt / Ngữ văn',
    'Tiếng Anh',
    'Khoa học tự nhiên',
    'Lịch sử',
    'Địa lý',
    'Tin học',
    'Kỹ năng sống',
  ];
}

export const GameEditorView: React.FC<GameEditorViewProps> = ({
  game,
  onSaveGame,
  onStartPlay,
  onBackHome,
  onNotify,
}) => {
  const [draft, setDraft] = useState<GameConfig>(() => ({
    ...game,
    aiVoiceEnabled: game.aiVoiceEnabled ?? true,
    aiVoiceId: game.aiVoiceId ?? 'south_female_mai',
    aiVoiceSampleText: game.aiVoiceSampleText ?? '',
    aiCorrectSample: game.aiCorrectSample ?? '',
    aiWrongSample: game.aiWrongSample ?? '',
    questions: game.questions.map((q) => ({ ...q })),
    evaluationRules: game.evaluationRules.map((r) => ({ ...r })),
  }));
  const [activeTab, setActiveTab] = useState<'setup' | 'questions'>('setup');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  const [testingVoice, setTestingVoice] = useState(false);
  const [voiceSampleError, setVoiceSampleError] = useState('');
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const validateGameMetadata = (): string | null => {
    if (!draft.title.trim()) return 'Vui lòng nhập Tên trò chơi.';
    if (!draft.lesson.trim()) return 'Vui lòng nhập Tên bài học hoặc chủ đề.';
    if (!draft.gradeLevel) return 'Vui lòng chọn Cấp học.';
    if (!draft.subject.trim()) return 'Vui lòng nhập Môn học.';
    if (!draft.playMode) return 'Vui lòng chọn Hình thức chơi.';
    if (draft.defaultTimeLimit === '' || Number(draft.defaultTimeLimit) < 0) {
      return 'Vui lòng nhập Thời gian trả lời mỗi câu hợp lệ.';
    }
    if (draft.maxAttempts === '' || Number(draft.maxAttempts) < 1) {
      return 'Vui lòng nhập Số lượt chơi (từ 1 trở lên).';
    }
    return null;
  };

  const handleSave = async () => {
    const err = validateGameMetadata();
    if (err) {
      setActiveTab('setup');
      onNotify('error', 'Thiếu thông tin thiết lập', err);
      return;
    }
    await onSaveGame(draft);
  };

  const handlePlayNow = async () => {
    const err = validateGameMetadata();
    if (err) {
      setActiveTab('setup');
      onNotify('error', 'Chưa thể bắt đầu chơi', err);
      return;
    }
    if (draft.questions.length === 0) {
      setActiveTab('questions');
      onNotify(
        'error',
        'Chưa có câu hỏi nào',
        'Giáo viên cần tạo hoặc nhập ít nhất 1 câu hỏi hợp lệ trước khi bắt đầu trò chơi.'
      );
      return;
    }
    await onSaveGame(draft);
    onStartPlay(draft);
  };

  const handleSaveQuestion = (saved: Question) => {
    setDraft((prev) => {
      const exists = prev.questions.some((q) => q.id === saved.id);
      const nextQuestions = exists
        ? prev.questions.map((q) => (q.id === saved.id ? saved : q))
        : [...prev.questions, { ...saved, order: prev.questions.length }];
      return { ...prev, questions: nextQuestions };
    });
    setIsQuestionModalOpen(false);
    setEditingQuestion(null);
    onNotify('success', 'Đã cập nhật danh sách câu hỏi');
  };

  const handleDuplicateQuestion = (q: Question) => {
    const clone: Question = {
      ...q,
      id: crypto.randomUUID(),
      prompt: `${q.prompt} (Bản sao)`,
      options: q.options.map((o) => ({ ...o })),
      order: draft.questions.length,
    };
    // Remap correctOptionIds to cloned option ids
    const idMap = new Map<string, string>();
    clone.options = q.options.map((o) => {
      const newId = crypto.randomUUID();
      idMap.set(o.id, newId);
      return { ...o, id: newId };
    });
    clone.correctOptionIds = q.correctOptionIds
      .map((oldId) => idMap.get(oldId))
      .filter((x): x is string => Boolean(x));

    setDraft((prev) => ({
      ...prev,
      questions: [...prev.questions, clone],
    }));
    onNotify('info', 'Đã sao chép câu hỏi');
  };

  const handleDeleteQuestion = (qId: string) => {
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions
        .filter((q) => q.id !== qId)
        .map((q, idx) => ({ ...q, order: idx })),
    }));
  };

  const handleMoveQuestion = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= draft.questions.length) return;
    setDraft((prev) => {
      const next = [...prev.questions];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return {
        ...prev,
        questions: next.map((q, idx) => ({ ...q, order: idx })),
      };
    });
  };

  const handleImportSpreadsheet = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const defaultSec = Number(draft.defaultTimeLimit) || 20;
      const imported = await parseQuestionsFromFile(file, defaultSec);
      setDraft((prev) => ({
        ...prev,
        questions: [
          ...prev.questions,
          ...imported.map((q, i) => ({ ...q, order: prev.questions.length + i })),
        ],
      }));
      onNotify(
        'success',
        `Đã nhập thành công ${imported.length} câu hỏi`,
        `Từ tệp ${file.name}`
      );
    } catch (err) {
      onNotify(
        'error',
        'Không thể nhập bộ câu hỏi',
        err instanceof Error ? err.message : 'Định dạng tệp không hợp lệ.'
      );
    } finally {
      e.target.value = '';
    }
  };

  const addEvaluationRule = () => {
    const newRule: EvaluationRule = {
      id: crypto.randomUUID(),
      minPercentage: 80,
      label: '',
      feedback: '',
    };
    setDraft((prev) => ({
      ...prev,
      evaluationRules: [...prev.evaluationRules, newRule],
    }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBackHome}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors mt-0.5"
            aria-label="Quay lại trang chủ"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
              {draft.title.trim() || 'Thiết lập trò chơi mới'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {draft.questions.length} câu hỏi đã tạo · Lưu trữ cục bộ an toàn trên trình duyệt
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Lưu trò chơi</span>
          </button>

          <button
            type="button"
            onClick={handlePlayNow}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors shadow-sm"
          >
            <Play className="w-4 h-4" />
            <span>Bắt đầu trò chơi</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('setup')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === 'setup'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          1. Thông tin & Cài đặt trò chơi
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('questions')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === 'questions'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          2. Bộ câu hỏi ({draft.questions.length})
        </button>
      </div>

      {activeTab === 'setup' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Core 10 Setup Fields */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Thông tin bài học & Trò chơi
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label htmlFor="g-title" className="block text-sm font-semibold text-slate-800">
                  1. Tên trò chơi <span className="text-red-600">*</span>
                </label>
                <input
                  id="g-title"
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Nhập tên trò chơi..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label htmlFor="g-lesson" className="block text-sm font-semibold text-slate-800">
                  2. Tên bài học hoặc chủ đề <span className="text-red-600">*</span>
                </label>
                <input
                  id="g-lesson"
                  type="text"
                  value={draft.lesson}
                  onChange={(e) => setDraft({ ...draft, lesson: e.target.value })}
                  placeholder="Nhập tên bài học hoặc chủ đề..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="sm:col-span-2 space-y-2">
                <label htmlFor="g-level" className="block text-sm font-semibold text-slate-800">
                  3. Cấp học <span className="text-red-600">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {GRADE_LEVEL_PRESETS.map((lvl) => {
                    const active = draft.gradeLevel === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setDraft({ ...draft, gradeLevel: lvl as GradeLevel })}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                          active
                            ? 'bg-sky-600 border-sky-600 text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {lvl}
                      </button>
                    );
                  })}
                </div>
                <input
                  id="g-level"
                  type="text"
                  value={draft.gradeLevel}
                  onChange={(e) => setDraft({ ...draft, gradeLevel: e.target.value as GradeLevel })}
                  placeholder="Chọn cấp học phía trên hoặc tự nhập cấp học khác..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="sm:col-span-2 space-y-2">
                <label htmlFor="g-class" className="block text-sm font-semibold text-slate-800">
                  4. Lớp học
                </label>
                {getSuggestedClasses(draft.gradeLevel).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {getSuggestedClasses(draft.gradeLevel).map((cls) => {
                      const active = draft.gradeClass === cls;
                      return (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => setDraft({ ...draft, gradeClass: cls })}
                          className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                            active
                              ? 'bg-sky-600 border-sky-600 text-white'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {cls}
                        </button>
                      );
                    })}
                  </div>
                )}
                <input
                  id="g-class"
                  type="text"
                  value={draft.gradeClass}
                  onChange={(e) => setDraft({ ...draft, gradeClass: e.target.value })}
                  placeholder="Chọn nhanh hoặc tự nhập tên lớp cụ thể (VD: 5A1, 9B, Chồi 2...)"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="sm:col-span-2 space-y-2">
                <label htmlFor="g-subject" className="block text-sm font-semibold text-slate-800">
                  5. Môn học / Lĩnh vực <span className="text-red-600">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {getSuggestedSubjects(draft.gradeLevel).map((subj) => {
                    const active = draft.subject === subj;
                    return (
                      <button
                        key={subj}
                        type="button"
                        onClick={() => setDraft({ ...draft, subject: subj })}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                          active
                            ? 'bg-sky-600 border-sky-600 text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {subj}
                      </button>
                    );
                  })}
                </div>
                <input
                  id="g-subject"
                  type="text"
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  placeholder="Chọn nhanh phía trên hoặc tự nhập môn học bất kỳ..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label htmlFor="g-desc" className="block text-sm font-semibold text-slate-800">
                  6. Mô tả trò chơi
                </label>
                <textarea
                  id="g-desc"
                  rows={3}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="Mô tả mục tiêu bài học hoặc luật chơi cho học sinh..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="sm:col-span-2 space-y-2">
                <span className="block text-sm font-semibold text-slate-800">
                  7. Hình thức chơi <span className="text-red-600">*</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(
                    [
                      {
                        id: 'practice',
                        title: 'Chế độ luyện tập',
                        desc: 'Không giới hạn thời gian, được xem giải thích và làm lại câu sai.',
                      },
                      {
                        id: 'challenge',
                        title: 'Chế độ thử thách',
                        desc: 'Tính giờ từng câu, cộng điểm thưởng theo tốc độ và độ chính xác.',
                      },
                      {
                        id: 'competition',
                        title: 'Chế độ thi đấu',
                        desc: 'Chơi nhiều lượt, lưu tên từng học sinh và xếp hạng điểm số.',
                      },
                      {
                        id: 'presentation',
                        title: 'Chế độ trình chiếu',
                        desc: 'Chữ lớn tối ưu cho máy chiếu lớp học, điều khiển linh hoạt.',
                      },
                    ] as const
                  ).map((mode) => {
                    const selected = draft.playMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setDraft({ ...draft, playMode: mode.id as PlayMode })}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          selected
                            ? 'border-sky-600 bg-sky-50/70'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {mode.title}
                          </span>
                          {selected && <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />}
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{mode.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="g-qcount" className="block text-sm font-semibold text-slate-800">
                  8. Số lượng câu hỏi khi chơi
                </label>
                <input
                  id="g-qcount"
                  type="number"
                  min={1}
                  value={draft.questionCountLimit}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      questionCountLimit: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                  placeholder="Để trống nếu chơi toàn bộ câu hỏi đã tạo"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="g-time" className="block text-sm font-semibold text-slate-800">
                  9. Thời gian trả lời mỗi câu (giây) <span className="text-red-600">*</span>
                </label>
                <input
                  id="g-time"
                  type="number"
                  min={0}
                  max={600}
                  value={draft.defaultTimeLimit}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      defaultTimeLimit: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                  placeholder="VD: 20"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="g-attempts" className="block text-sm font-semibold text-slate-800">
                  10. Số lượt chơi <span className="text-red-600">*</span>
                </label>
                <input
                  id="g-attempts"
                  type="number"
                  min={1}
                  max={100}
                  value={draft.maxAttempts}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      maxAttempts: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                  placeholder="VD: 1 (hoặc nhiều lượt cho Thi đấu)"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 tabular-nums"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveTab('questions')}
                className="px-4 py-2 text-sm font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-xl transition-colors"
              >
                Tiếp tục: Soạn bộ câu hỏi →
              </button>
            </div>
          </div>

          {/* Side Column: Gameplay & Evaluation Rules */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <h3 className="font-display text-base font-bold text-slate-900">
                Tùy chọn phản hồi khi chơi
              </h3>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.showCorrectAnswerOnWrong}
                  onChange={(e) =>
                    setDraft({ ...draft, showCorrectAnswerOnWrong: e.target.checked })
                  }
                  className="mt-1 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-sm text-slate-700">
                  Hiển thị đáp án đúng khi học sinh trả lời chưa chính xác
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.autoAdvance}
                  onChange={(e) => setDraft({ ...draft, autoAdvance: e.target.checked })}
                  className="mt-1 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-sm text-slate-700">
                  Tự động chuyển sang câu hỏi tiếp theo sau khi hiển thị đúng/sai (và đọc xong phản hồi AI nếu bật)
                </span>
              </label>

              {draft.autoAdvance && (
                <div className="pl-7 space-y-1">
                  <label htmlFor="g-adv-delay" className="text-xs font-medium text-slate-600">
                    Thời gian chờ chuyển câu khi tắt giọng đọc (giây)
                  </label>
                  <input
                    id="g-adv-delay"
                    type="number"
                    min={1}
                    max={15}
                    value={draft.autoAdvanceDelay}
                    onChange={(e) =>
                      setDraft({ ...draft, autoAdvanceDelay: Number(e.target.value) || 3 })
                    }
                    className="w-28 px-3 py-1.5 text-sm border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
              )}
            </div>

            {/* AI Southern Vietnamese Voice Feedback Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-slate-900">
                  Giọng đọc AI phản hồi (Tiếng Việt)
                </h3>
                {testingVoice && (
                  <button
                    type="button"
                    onClick={() => {
                      stopActiveAiVoice();
                      setTestingVoice(false);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                  >
                    Dừng đọc
                  </button>
                )}
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.aiVoiceEnabled}
                  onChange={(e) => setDraft({ ...draft, aiVoiceEnabled: e.target.checked })}
                  className="mt-1 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-sm text-slate-700">
                  Phát giọng đọc AI nhận xét đúng/sai sau mỗi câu hỏi (chuyển câu sau khi đọc xong)
                </span>
              </label>

              {/* Custom Sample Sentence Input to Generate & Test AI Speech (Empty by default) */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="g-voice-sample"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Câu mẫu để tạo giọng đọc AI
                  </label>
                  {(draft.aiVoiceSampleText ?? '').length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({ ...draft, aiVoiceSampleText: '' });
                        setVoiceSampleError('');
                      }}
                      className="text-[11px] font-medium text-slate-500 hover:text-slate-700"
                    >
                      Xóa chữ
                    </button>
                  )}
                </div>
                <textarea
                  id="g-voice-sample"
                  rows={2}
                  maxLength={600}
                  value={draft.aiVoiceSampleText ?? ''}
                  onChange={(e) => {
                    setDraft({ ...draft, aiVoiceSampleText: e.target.value });
                    if (voiceSampleError) setVoiceSampleError('');
                  }}
                  placeholder="Nhập câu mẫu tiếng Việt mà bạn muốn tạo giọng đọc AI..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                />
                {voiceSampleError && (
                  <p className="text-[11px] font-medium text-red-600">{voiceSampleError}</p>
                )}
                <button
                  type="button"
                  disabled={testingVoice}
                  onClick={async () => {
                    const sample = (draft.aiVoiceSampleText ?? '').trim();
                    if (!sample) {
                      const msg = 'Vui lòng nhập câu mẫu trước khi tạo giọng đọc AI.';
                      setVoiceSampleError(msg);
                      onNotify('error', 'Chưa có câu mẫu', msg);
                      return;
                    }
                    setVoiceSampleError('');
                    try {
                      setTestingVoice(true);
                      stopActiveAiVoice();
                      await playAiVoiceFeedback(sample, draft.aiVoiceId);
                    } catch (err) {
                      onNotify(
                        'error',
                        'Không thể tạo giọng đọc AI',
                        err instanceof Error ? err.message : 'Vui lòng thử lại.'
                      );
                    } finally {
                      setTestingVoice(false);
                    }
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-700 bg-sky-100/80 hover:bg-sky-200/80 rounded-lg disabled:opacity-60 transition-colors"
                >
                  {testingVoice ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                  <span>{testingVoice ? 'Đang tạo & phát giọng AI...' : 'Tạo giọng đọc AI từ câu mẫu'}</span>
                </button>
              </div>

              {draft.aiVoiceEnabled && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-600">
                      Chọn giọng đọc Nam / Nữ người miền Nam:
                    </p>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {SOUTHERN_VOICE_OPTIONS.map((v) => {
                        const active = draft.aiVoiceId === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() =>
                              setDraft({ ...draft, aiVoiceId: v.id as SouthernVoiceId })
                            }
                            className={`w-full text-left p-2.5 rounded-xl border transition-colors ${
                              active
                                ? 'border-sky-600 bg-sky-50'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-900">
                                {v.name} · {v.regionLabel}
                              </span>
                              {active && <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
                            </div>
                            <p className="text-[11px] text-slate-600 mt-0.5">{v.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Optional Custom Correct / Wrong Feedback Samples (Empty by default) */}
                  <div className="pt-3 border-t border-slate-100 space-y-2.5">
                    <p className="text-xs font-semibold text-slate-600">
                      Câu mẫu phản hồi khi chơi (tùy chọn, không mặc định sẵn):
                    </p>
                    <div className="space-y-1">
                      <label htmlFor="g-voice-correct" className="text-[11px] font-medium text-emerald-700">
                        Câu mẫu khi học sinh trả lời Đúng
                      </label>
                      <input
                        id="g-voice-correct"
                        type="text"
                        maxLength={250}
                        value={draft.aiCorrectSample ?? ''}
                        onChange={(e) => setDraft({ ...draft, aiCorrectSample: e.target.value })}
                        placeholder="Nhập câu khen khi đúng (để trống nếu không đặt sẵn)..."
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="g-voice-wrong" className="text-[11px] font-medium text-rose-700">
                        Câu mẫu khi học sinh trả lời Sai
                      </label>
                      <input
                        id="g-voice-wrong"
                        type="text"
                        maxLength={250}
                        value={draft.aiWrongSample ?? ''}
                        onChange={(e) => setDraft({ ...draft, aiWrongSample: e.target.value })}
                        placeholder="Nhập câu khích lệ khi sai (để trống nếu không đặt sẵn)..."
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-slate-900">
                  Mức nhận xét tổng kết
                </h3>
                <button
                  type="button"
                  onClick={addEvaluationRule}
                  className="text-xs font-semibold text-sky-700 hover:underline"
                >
                  + Thêm mức
                </button>
              </div>

              {draft.evaluationRules.length === 0 ? (
                <p className="text-xs text-slate-500 leading-relaxed">
                  Chưa thêm mức nhận xét riêng. Bạn có thể bấm "+ Thêm mức" để tùy chỉnh lời nhận xét theo tỷ lệ % điểm đạt được.
                </p>
              ) : (
                <div className="space-y-3">
                  {draft.evaluationRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 shrink-0">Từ (%):</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={rule.minPercentage}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              evaluationRules: prev.evaluationRules.map((r) =>
                                r.id === rule.id
                                  ? { ...r, minPercentage: Number(e.target.value) }
                                  : r
                              ),
                            }))
                          }
                          className="w-16 px-2 py-1 text-xs bg-white border border-slate-200 rounded-md tabular-nums"
                        />
                        <input
                          type="text"
                          value={rule.label}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              evaluationRules: prev.evaluationRules.map((r) =>
                                r.id === rule.id ? { ...r, label: e.target.value } : r
                              ),
                            }))
                          }
                          placeholder="Xếp loại (VD: Xuất sắc)"
                          className="flex-1 px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              evaluationRules: prev.evaluationRules.filter(
                                (r) => r.id !== rule.id
                              ),
                            }))
                          }
                          className="text-slate-400 hover:text-red-600"
                          aria-label="Xóa mức nhận xét"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={rule.feedback}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            evaluationRules: prev.evaluationRules.map((r) =>
                              r.id === rule.id ? { ...r, feedback: e.target.value } : r
                            ),
                          }))
                        }
                        placeholder="Lời nhận xét hiển thị cho học sinh..."
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Tab 2: Question Management */
        <div className="space-y-5">
          {/* Toolbar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setEditingQuestion(null);
                  setIsQuestionModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm câu hỏi</span>
              </button>

              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>Nhập từ Excel / CSV</span>
              </button>

              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportSpreadsheet}
                className="hidden"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => downloadQuestionTemplate('xlsx')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tải mẫu Excel</span>
              </button>
              <button
                type="button"
                onClick={() => downloadQuestionTemplate('csv')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-sky-600" />
                <span>Tải mẫu CSV</span>
              </button>

              {draft.questions.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      exportQuestionsToSpreadsheet(
                        draft.questions,
                        draft.title || 'bo_cau_hoi',
                        'xlsx'
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Xuất Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      exportQuestionsToSpreadsheet(
                        draft.questions,
                        draft.title || 'bo_cau_hoi',
                        'csv'
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Xuất CSV</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Empty Question State */}
          {draft.questions.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="max-w-lg mx-auto space-y-1.5">
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Bộ câu hỏi đang trống
                </h3>
                <p className="text-sm text-slate-600">
                  Nhấn nút <strong>"Thêm câu hỏi"</strong> để tự soạn câu hỏi cho bài học, hoặc tải tệp mẫu Excel/CSV về điền danh sách câu hỏi rồi nhập lên hệ thống.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingQuestion(null);
                    setIsQuestionModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo câu hỏi đầu tiên</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {draft.questions.map((q, index) => {
                const correctLabels = q.options
                  .filter((o) => q.correctOptionIds.includes(o.id))
                  .map((o) => o.label)
                  .join(', ');

                return (
                  <div
                    key={q.id}
                    className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-900 tabular-nums">
                          Câu {index + 1}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{QUESTION_TYPE_LABELS[q.type]}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{q.timeLimit} giây</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{q.points} điểm</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-700 font-medium">
                          Đáp án đúng: {correctLabels}
                        </span>
                      </div>

                      <p className="text-base font-semibold text-slate-900 break-words">
                        {q.prompt}
                      </p>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 pt-1">
                        {q.options.map((opt) => (
                          <span
                            key={opt.id}
                            className={
                              q.correctOptionIds.includes(opt.id)
                                ? 'font-semibold text-emerald-700'
                                : ''
                            }
                          >
                            {opt.label}. {opt.text || '(Hình ảnh)'}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveQuestion(index, -1)}
                        className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 rounded-lg"
                        title="Di chuyển lên"
                        aria-label="Di chuyển câu hỏi lên"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={index === draft.questions.length - 1}
                        onClick={() => handleMoveQuestion(index, 1)}
                        className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 rounded-lg"
                        title="Di chuyển xuống"
                        aria-label="Di chuyển câu hỏi xuống"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewQuestion(q)}
                        className="p-2 text-slate-600 hover:text-sky-700 hover:bg-sky-50 rounded-lg"
                        title="Xem trước câu hỏi"
                        aria-label="Xem trước câu hỏi"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingQuestion(q);
                          setIsQuestionModalOpen(true);
                        }}
                        className="p-2 text-slate-600 hover:text-sky-700 hover:bg-sky-50 rounded-lg"
                        title="Chỉnh sửa"
                        aria-label="Chỉnh sửa câu hỏi"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateQuestion(q)}
                        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                        title="Sao chép"
                        aria-label="Sao chép câu hỏi"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Xóa"
                        aria-label="Xóa câu hỏi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {isQuestionModalOpen && (
        <QuestionFormModal
          initialQuestion={editingQuestion}
          defaultTimeLimit={Number(draft.defaultTimeLimit) || 20}
          onSave={handleSaveQuestion}
          onClose={() => {
            setIsQuestionModalOpen(false);
            setEditingQuestion(null);
          }}
        />
      )}

      {previewQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-slate-900">Xem trước câu hỏi</h3>
              <button
                type="button"
                onClick={() => setPreviewQuestion(null)}
                className="text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                Đóng
              </button>
            </div>
            <p className="text-base font-semibold text-slate-900">{previewQuestion.prompt}</p>
            {previewQuestion.mediaUrl && previewQuestion.mediaType === 'image' && (
              <img
                src={previewQuestion.mediaUrl}
                alt="Minh họa"
                referrerPolicy="no-referrer"
                className="max-h-48 rounded-xl mx-auto object-contain"
              />
            )}
            {previewQuestion.mediaUrl && previewQuestion.mediaType === 'audio' && (
              <audio controls src={previewQuestion.mediaUrl} className="w-full" />
            )}
            {previewQuestion.mediaUrl && previewQuestion.mediaType === 'video' && (
              <video controls src={previewQuestion.mediaUrl} className="max-h-48 mx-auto rounded-xl" />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {previewQuestion.options.map((opt) => {
                const isCorrect = previewQuestion.correctOptionIds.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    className={`p-3 rounded-xl border text-sm ${
                      isCorrect
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-900 font-semibold'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    {opt.label}. {opt.text}
                  </div>
                );
              })}
            </div>
            {previewQuestion.explanation && (
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg">
                Giải thích: {previewQuestion.explanation}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
