import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Camera,
  CameraOff,
  Pause,
  Play,
  LogOut,
  Volume2,
  VolumeX,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Trophy,
  Crosshair,
  AlertCircle,
  Maximize2,
  Minimize2,
  Loader2,
} from 'lucide-react';
import {
  CalibrationSettings,
  GameConfig,
  GameResult,
  HeadDirection,
  Question,
  QuestionAnswerRecord,
  SouthernVoiceId,
} from '../types/game';
import { useHeadTracking } from '../hooks/useHeadTracking';
import { MascotCharacter } from './MascotCharacter';
import { soundFX } from '../services/sound';
import {
  buildFeedbackSpeechText,
  playAiVoiceFeedback,
  SOUTHERN_VOICE_OPTIONS,
  stopActiveAiVoice,
} from '../services/aiVoice';

interface GamePlayViewProps {
  game: GameConfig;
  calibration: CalibrationSettings;
  onUpdateCalibration: (next: CalibrationSettings) => void;
  onCompleteResult: (result: GameResult) => Promise<void>;
  onFinishAllTurns: (latestResult: GameResult, sessionResults: GameResult[]) => void;
  onExit: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

const DIRECTION_BY_INDEX_2: Exclude<HeadDirection, 'neutral'>[] = ['left', 'right'];
const DIRECTION_BY_INDEX_3: Exclude<HeadDirection, 'neutral'>[] = ['left', 'up', 'right'];
const DIRECTION_BY_INDEX_4: Exclude<HeadDirection, 'neutral'>[] = ['left', 'right', 'up', 'down'];

const DIRECTION_META: Record<
  Exclude<HeadDirection, 'neutral'>,
  { label: string; icon: React.ReactNode }
> = {
  left: { label: 'Nghiêng trái', icon: <ArrowLeft className="w-4 h-4" /> },
  right: { label: 'Nghiêng phải', icon: <ArrowRight className="w-4 h-4" /> },
  up: { label: 'Ngẩng đầu', icon: <ArrowUp className="w-4 h-4" /> },
  down: { label: 'Cúi đầu', icon: <ArrowDown className="w-4 h-4" /> },
};

export const GamePlayView: React.FC<GamePlayViewProps> = ({
  game,
  calibration,
  onUpdateCalibration,
  onCompleteResult,
  onFinishAllTurns,
  onExit,
  onNotify,
}) => {
  const maxTurns = Math.max(1, Number(game.maxAttempts) || 1);
  const isPractice = game.playMode === 'practice';
  const isPresentation = game.playMode === 'presentation';
  const isCompetition = game.playMode === 'competition';

  const activeQuestions = useMemo(() => {
    const sorted = [...game.questions].sort((a, b) => a.order - b.order);
    const limit = Number(game.questionCountLimit);
    if (limit > 0 && limit < sorted.length) {
      return sorted.slice(0, limit);
    }
    return sorted;
  }, [game]);

  const arenaRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Per-session AI voice controls initialized from game config
  const [aiVoiceEnabled, setAiVoiceEnabled] = useState<boolean>(
    game.aiVoiceEnabled ?? calibration.aiVoiceEnabled ?? true
  );
  const [aiVoiceId, setAiVoiceId] = useState<SouthernVoiceId>(
    game.aiVoiceId ?? calibration.aiVoiceId ?? 'south_female_mai'
  );

  // Turn & player state (strictly empty initially, no fake player name)
  const [phase, setPhase] = useState<'ready' | 'playing' | 'turn_end'>('ready');
  const [currentTurn, setCurrentTurn] = useState(1);
  const [playerName, setPlayerName] = useState('');
  const [nameError, setNameError] = useState('');
  const [sessionResults, setSessionResults] = useState<GameResult[]>([]);

  // Active question state
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isPaused, setIsPaused] = useState(false);
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{
    submitted: boolean;
    isCorrect: boolean;
    isUnanswered: boolean;
    pointsEarned: number;
    selectedIds: string[];
    speechText: string;
  } | null>(null);
  const [voiceState, setVoiceState] = useState<'idle' | 'speaking' | 'done' | 'error'>('idle');
  const [voiceErrorMsg, setVoiceErrorMsg] = useState<string>('');
  const [records, setRecords] = useState<QuestionAnswerRecord[]>([]);
  const [manualDir, setManualDir] = useState<HeadDirection>('neutral');

  const turnStartTimeRef = useRef<number>(Date.now());
  const questionStartTimeRef = useRef<number>(Date.now());
  const advanceTimerRef = useRef<number | null>(null);
  const feedbackCycleIdRef = useRef<number>(0);

  const currentQuestion: Question | undefined = activeQuestions[qIndex];

  // Sync fullscreen state
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      stopActiveAiVoice();
      if (advanceTimerRef.current !== null) {
        window.clearTimeout(advanceTimerRef.current);
      }
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        const target = arenaRef.current ?? document.documentElement;
        await target.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      onNotify(
        'info',
        'Trình duyệt hạn chế chế độ toàn màn hình',
        'Bạn có thể nhấn phím F11 trên bàn phím để mở rộng toàn màn hình.'
      );
    }
  }, [onNotify]);

  // Map options to head directions
  const optionDirectionMap = useMemo(() => {
    const map = new Map<Exclude<HeadDirection, 'neutral'>, string>();
    if (!currentQuestion) return map;
    const count = currentQuestion.options.length;
    const dirs =
      count === 2
        ? DIRECTION_BY_INDEX_2
        : count === 3
        ? DIRECTION_BY_INDEX_3
        : DIRECTION_BY_INDEX_4;
    currentQuestion.options.forEach((opt, idx) => {
      if (dirs[idx]) {
        map.set(dirs[idx], opt.id);
      }
    });
    return map;
  }, [currentQuestion]);

  const allowedDirections = useMemo<HeadDirection[]>(
    () => Array.from(optionDirectionMap.keys()),
    [optionDirectionMap]
  );

  const clearPendingAdvance = useCallback(() => {
    feedbackCycleIdRef.current += 1;
    stopActiveAiVoice();
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  const evaluateAnswer = useCallback(
    (chosenIds: string[], unanswered = false) => {
      if (!currentQuestion || feedback?.submitted) return;

      const correctSet = new Set(currentQuestion.correctOptionIds);
      const chosenSet = new Set(chosenIds);
      const isCorrect =
        !unanswered &&
        chosenSet.size === correctSet.size &&
        [...correctSet].every((id) => chosenSet.has(id));

      const elapsedSec = Math.max(
        1,
        Math.round((Date.now() - questionStartTimeRef.current) / 1000)
      );

      let pointsEarned = 0;
      if (isCorrect) {
        pointsEarned = currentQuestion.points;
        if (
          (game.playMode === 'challenge' || game.playMode === 'competition') &&
          currentQuestion.timeLimit > 0
        ) {
          const ratio = Math.max(0, timeLeft / currentQuestion.timeLimit);
          pointsEarned += Math.round(currentQuestion.points * 0.5 * ratio);
        }
      }

      if (isCorrect) {
        soundFX.playCorrect();
        confetti({
          particleCount: 55,
          spread: 65,
          origin: { y: 0.65 },
        });
      } else {
        soundFX.playWrong();
      }

      const selectedTexts = currentQuestion.options
        .filter((o) => chosenIds.includes(o.id))
        .map((o) => `${o.label}. ${o.text}`);
      const correctTexts = currentQuestion.options
        .filter((o) => currentQuestion.correctOptionIds.includes(o.id))
        .map((o) => `${o.label}. ${o.text}`);

      const speechText = buildFeedbackSpeechText({
        isCorrect,
        isUnanswered: unanswered,
        correctAnswerTexts: currentQuestion.options
          .filter((o) => currentQuestion.correctOptionIds.includes(o.id))
          .map((o) => o.text || o.label),
        explanation: currentQuestion.explanation,
        showCorrectAnswer: game.showCorrectAnswerOnWrong,
        customCorrectSample: game.aiCorrectSample,
        customWrongSample: game.aiWrongSample,
      });

      const record: QuestionAnswerRecord = {
        questionId: currentQuestion.id,
        questionPrompt: currentQuestion.prompt,
        selectedOptionIds: chosenIds,
        selectedTexts,
        correctOptionIds: currentQuestion.correctOptionIds,
        correctTexts,
        isCorrect,
        isUnanswered: unanswered,
        pointsEarned,
        timeSpentSeconds: elapsedSec,
        explanation: currentQuestion.explanation,
      };

      setScore((prev) => prev + pointsEarned);
      setRecords((prev) => {
        const filtered = prev.filter((r) => r.questionId !== currentQuestion.id);
        return [...filtered, record];
      });
      setVoiceErrorMsg('');
      setVoiceState('idle');
      setFeedback({
        submitted: true,
        isCorrect,
        isUnanswered: unanswered,
        pointsEarned,
        selectedIds: chosenIds,
        speechText,
      });
    },
    [
      currentQuestion,
      feedback?.submitted,
      game.aiCorrectSample,
      game.aiWrongSample,
      game.playMode,
      game.showCorrectAnswerOnWrong,
      timeLeft,
    ]
  );

  const handleOptionTrigger = useCallback(
    (optionId: string) => {
      if (!currentQuestion || phase !== 'playing' || isPaused || feedback?.submitted) return;

      if (currentQuestion.type === 'multi_select') {
        soundFX.playSelectLock();
        setMultiSelectedIds((prev) =>
          prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
        );
      } else {
        evaluateAnswer([optionId], false);
      }
    },
    [currentQuestion, evaluateAnswer, feedback?.submitted, isPaused, phase]
  );

  const {
    attachVideoElement,
    canvasRef,
    cameraStatus,
    errorMessage,
    pose,
    holdDirection,
    holdProgress,
    startCamera,
    stopCamera,
    captureNeutralCalibration,
    resetHoldState,
  } = useHeadTracking({
    calibration,
    allowedDirections,
    enabled: phase === 'playing' && !isPaused && !feedback?.submitted,
    onDirectionHoldComplete: (dir) => {
      const optId = optionDirectionMap.get(dir);
      if (optId) {
        handleOptionTrigger(optId);
        if (currentQuestion?.type === 'multi_select') {
          resetHoldState();
        }
      }
    },
  });

  // Initialize timer whenever qIndex or phase changes to playing
  useEffect(() => {
    if (phase !== 'playing' || !currentQuestion) return;
    clearPendingAdvance();
    questionStartTimeRef.current = Date.now();
    const limit = isPractice
      ? 0
      : currentQuestion.timeLimit || Number(game.defaultTimeLimit) || 0;
    setTimeLeft(limit);
    setMultiSelectedIds([]);
    setFeedback(null);
    setVoiceState('idle');
    setVoiceErrorMsg('');
    resetHoldState();
  }, [phase, qIndex, currentQuestion, isPractice, game.defaultTimeLimit, resetHoldState, clearPendingAdvance]);

  // Countdown tick
  useEffect(() => {
    if (phase !== 'playing' || isPaused || feedback?.submitted || isPractice) return;
    if (!currentQuestion) return;
    const limit = currentQuestion.timeLimit || Number(game.defaultTimeLimit) || 0;
    if (limit <= 0) return;

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          evaluateAnswer([], true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    phase,
    isPaused,
    feedback?.submitted,
    isPractice,
    currentQuestion,
    game.defaultTimeLimit,
    evaluateAnswer,
  ]);

  const computeEvaluation = (accuracy: number): { label: string; feedback: string } => {
    if (game.evaluationRules.length > 0) {
      const sorted = [...game.evaluationRules].sort((a, b) => b.minPercentage - a.minPercentage);
      const matched = sorted.find((r) => accuracy >= r.minPercentage);
      if (matched) {
        return {
          label: matched.label || `Đạt ${accuracy}%`,
          feedback: matched.feedback || 'Hoàn thành bài học.',
        };
      }
    }
    if (accuracy >= 90) return { label: 'Xuất sắc', feedback: 'Nắm vững kiến thức bài học rất tốt!' };
    if (accuracy >= 70) return { label: 'Khá tốt', feedback: 'Kết quả tích cực, tiếp tục phát huy!' };
    if (accuracy >= 50) return { label: 'Đạt yêu cầu', feedback: 'Cần ôn tập thêm một số nội dung.' };
    return { label: 'Cần cố gắng thêm', feedback: 'Hãy luyện tập lại để ghi nhớ bài học tốt hơn.' };
  };

  const finishTurn = useCallback(async () => {
    clearPendingAdvance();
    const completionSec = Math.max(1, Math.round((Date.now() - turnStartTimeRef.current) / 1000));
    const correctCount = records.filter((r) => r.isCorrect).length;
    const unansweredCount = records.filter((r) => r.isUnanswered).length;
    const wrongCount = records.filter((r) => !r.isCorrect && !r.isUnanswered).length;
    const totalQuestions = activeQuestions.length;
    const accuracyPercent =
      totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const maxPossibleScore = activeQuestions.reduce((sum, q) => sum + q.points, 0);
    const evalResult = computeEvaluation(accuracyPercent);

    const result: GameResult = {
      id: crypto.randomUUID(),
      gameId: game.id,
      gameTitle: game.title,
      lesson: game.lesson,
      subject: game.subject,
      gradeLevel: game.gradeLevel,
      gradeClass: game.gradeClass,
      playMode: (game.playMode || 'challenge') as Exclude<GameConfig['playMode'], ''>,
      playerName: playerName.trim(),
      turnNumber: currentTurn,
      totalQuestions,
      correctCount,
      wrongCount,
      unansweredCount,
      totalScore: score,
      maxPossibleScore,
      accuracyPercent,
      completionTimeSeconds: completionSec,
      evaluationLabel: evalResult.label,
      evaluationFeedback: evalResult.feedback,
      records,
      completedAt: Date.now(),
    };

    soundFX.playComplete();
    confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });

    await onCompleteResult(result);
    const nextSession = [...sessionResults, result];
    setSessionResults(nextSession);

    if (currentTurn < maxTurns && isCompetition) {
      setPhase('turn_end');
    } else {
      stopCamera();
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      onFinishAllTurns(result, nextSession);
    }
  }, [
    activeQuestions,
    clearPendingAdvance,
    currentTurn,
    game,
    isCompetition,
    maxTurns,
    onCompleteResult,
    onFinishAllTurns,
    playerName,
    records,
    score,
    sessionResults,
    stopCamera,
  ]);

  const handleNextQuestion = useCallback(() => {
    clearPendingAdvance();
    if (qIndex + 1 < activeQuestions.length) {
      setQIndex((prev) => prev + 1);
    } else {
      finishTurn();
    }
  }, [clearPendingAdvance, qIndex, activeQuestions.length, finishTurn]);

  // AI Voice Feedback + Auto-Advance AFTER Voice Completes
  useEffect(() => {
    if (!feedback?.submitted || isPaused) return;

    const cycleId = ++feedbackCycleIdRef.current;
    const shouldAutoAdvance = game.autoAdvance !== false; // Always auto-advance unless explicitly disabled by teacher

    const runFeedbackAndAdvance = async () => {
      if (aiVoiceEnabled && calibration.soundEnabled) {
        setVoiceState('speaking');
        try {
          await playAiVoiceFeedback(feedback.speechText, aiVoiceId);
          if (feedbackCycleIdRef.current !== cycleId) return;
          setVoiceState('done');
          if (shouldAutoAdvance) {
            advanceTimerRef.current = window.setTimeout(() => {
              if (feedbackCycleIdRef.current === cycleId) {
                handleNextQuestion();
              }
            }, 700);
          }
        } catch (err) {
          if (feedbackCycleIdRef.current !== cycleId) return;
          const msg = err instanceof Error ? err.message : 'Không thể phát giọng đọc AI.';
          setVoiceState('error');
          setVoiceErrorMsg(msg);
          if (shouldAutoAdvance) {
            const fallbackMs = Math.max(1.5, game.autoAdvanceDelay || 2.5) * 1000;
            advanceTimerRef.current = window.setTimeout(() => {
              if (feedbackCycleIdRef.current === cycleId) {
                handleNextQuestion();
              }
            }, fallbackMs);
          }
        }
      } else if (shouldAutoAdvance) {
        const delayMs = Math.max(1.5, game.autoAdvanceDelay || 2.5) * 1000;
        advanceTimerRef.current = window.setTimeout(() => {
          if (feedbackCycleIdRef.current === cycleId) {
            handleNextQuestion();
          }
        }, delayMs);
      }
    };

    runFeedbackAndAdvance();

    return () => {
      feedbackCycleIdRef.current += 1;
      stopActiveAiVoice();
      if (advanceTimerRef.current !== null) {
        window.clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, [
    feedback,
    isPaused,
    aiVoiceEnabled,
    aiVoiceId,
    calibration.soundEnabled,
    game.autoAdvance,
    game.autoAdvanceDelay,
    handleNextQuestion,
  ]);

  // Keyboard fallback controls (Arrow keys, 1-4, Enter)
  useEffect(() => {
    if (phase !== 'playing' || isPaused) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (feedback?.submitted) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleNextQuestion();
        }
        return;
      }

      let dir: Exclude<HeadDirection, 'neutral'> | null = null;
      if (e.key === 'ArrowLeft') dir = 'left';
      else if (e.key === 'ArrowRight') dir = 'right';
      else if (e.key === 'ArrowUp') dir = 'up';
      else if (e.key === 'ArrowDown') dir = 'down';

      if (dir && optionDirectionMap.has(dir)) {
        e.preventDefault();
        setManualDir(dir);
        const optId = optionDirectionMap.get(dir);
        if (optId) handleOptionTrigger(optId);
        window.setTimeout(() => setManualDir('neutral'), 220);
        return;
      }

      if (['1', '2', '3', '4'].includes(e.key) && currentQuestion) {
        const idx = Number(e.key) - 1;
        const opt = currentQuestion.options[idx];
        if (opt) {
          e.preventDefault();
          handleOptionTrigger(opt.id);
        }
      }

      if (
        (e.key === 'Enter' || e.key === ' ') &&
        currentQuestion?.type === 'multi_select' &&
        multiSelectedIds.length > 0
      ) {
        e.preventDefault();
        evaluateAnswer(multiSelectedIds, false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    phase,
    isPaused,
    feedback?.submitted,
    optionDirectionMap,
    handleOptionTrigger,
    handleNextQuestion,
    currentQuestion,
    multiSelectedIds,
    evaluateAnswer,
  ]);

  const beginTurn = async (requestFull: boolean) => {
    if (!playerName.trim()) {
      setNameError('Vui lòng nhập tên học sinh hoặc người chơi trước khi bắt đầu.');
      return;
    }
    setNameError('');
    setQIndex(0);
    setScore(0);
    setRecords([]);
    setFeedback(null);
    turnStartTimeRef.current = Date.now();
    if (requestFull && !document.fullscreenElement) {
      try {
        await (arenaRef.current ?? document.documentElement).requestFullscreen();
      } catch {
        // Ignore if browser blocks programmatic fullscreen
      }
    }
    setPhase('playing');
  };

  const handleStartTurn = (e: React.FormEvent) => {
    e.preventDefault();
    beginTurn(false);
  };

  const handleRetryQuestion = () => {
    if (!currentQuestion) return;
    clearPendingAdvance();
    setScore((prev) => prev - (feedback?.pointsEarned ?? 0));
    setRecords((prev) => prev.filter((r) => r.questionId !== currentQuestion.id));
    setFeedback(null);
    setVoiceState('idle');
    setVoiceErrorMsg('');
    setMultiSelectedIds([]);
    questionStartTimeRef.current = Date.now();
    resetHoldState();
  };

  const handleQuickCalibrate = () => {
    const cap = captureNeutralCalibration();
    if (!cap) {
      onNotify('error', 'Chưa thấy khuôn mặt', 'Hãy nhìn thẳng vào camera để hiệu chỉnh.');
      return;
    }
    onUpdateCalibration({
      ...calibration,
      rollCenter: cap.rollCenter,
      pitchCenter: cap.pitchCenter,
    });
    onNotify('success', 'Đã hiệu chỉnh vị trí đầu trung tâm');
  };

  const activeDir = pose.direction !== 'neutral' ? pose.direction : manualDir;

  // Ready / Player Entry Screen
  if (phase === 'ready') {
    return (
      <div ref={arenaRef} className="min-h-screen bg-slate-50 overflow-y-auto py-8 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-sky-700">
                  {[
                    game.gradeLevel,
                    game.gradeClass ? `Lớp ${game.gradeClass}` : '',
                    game.subject,
                    `${activeQuestions.length} câu hỏi`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
                  {game.title}
                </h1>
                <p className="text-sm text-slate-600">Bài học: {game.lesson}</p>
              </div>
              <MascotCharacter characterId={calibration.characterId} direction="neutral" size={84} />
            </div>

            {game.description && (
              <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-4">
                {game.description}
              </p>
            )}

            {/* AI Southern Voice Selector right before play */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aiVoiceEnabled}
                    onChange={(e) => setAiVoiceEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span>Giọng đọc AI phản hồi đúng / sai (Tiếng Việt - Miền Nam)</span>
                </label>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg"
                >
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5" />
                      <span>Thoát toàn màn hình</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Mở toàn màn hình</span>
                    </>
                  )}
                </button>
              </div>

              {aiVoiceEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SOUTHERN_VOICE_OPTIONS.map((v) => {
                    const active = aiVoiceId === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setAiVoiceId(v.id)}
                        className={`p-2.5 rounded-xl border text-left transition-colors ${
                          active
                            ? 'border-sky-600 bg-white ring-1 ring-sky-600'
                            : 'border-slate-200 bg-white hover:bg-slate-100'
                        }`}
                      >
                        <p className="text-xs font-bold text-slate-900">
                          {v.name} · {v.regionLabel}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                          {v.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Camera Pre-flight */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Nhận diện chuyển động đầu qua camera
                  </p>
                  <p className="text-xs text-slate-600">
                    {cameraStatus === 'active'
                      ? pose.faceDetected
                        ? 'Camera đã sẵn sàng và đã nhận diện khuôn mặt.'
                        : 'Camera đang bật — hãy ngồi chính diện trước ống kính.'
                      : 'Bạn có thể bật camera ngay bây giờ hoặc chơi bằng bàn phím / chuột.'}
                  </p>
                </div>
                {cameraStatus !== 'active' ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg"
                  >
                    <Camera className="w-4 h-4" />
                    <span>BẮT ĐẦU NHẬN DIỆN</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg"
                  >
                    <CameraOff className="w-4 h-4" />
                    <span>Tắt camera</span>
                  </button>
                )}
              </div>

              {cameraStatus === 'active' && (
                <div className="flex items-center gap-4">
                  <div className="relative w-40 aspect-video rounded-lg overflow-hidden bg-slate-900 shrink-0">
                    <video
                      ref={attachVideoElement}
                      playsInline
                      muted
                      className="w-full h-full object-cover -scale-x-100"
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleQuickCalibrate}
                    disabled={!pose.faceDetected}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-50 rounded-lg"
                  >
                    <Crosshair className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Hiệu chỉnh vị trí trung tâm</span>
                  </button>
                </div>
              )}

              {(cameraStatus === 'denied' ||
                cameraStatus === 'unavailable' ||
                cameraStatus === 'error') && (
                <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            <form onSubmit={handleStartTurn} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="player-name" className="block text-sm font-semibold text-slate-800">
                  {isCompetition
                    ? `Tên học sinh lượt ${currentTurn} / ${maxTurns}`
                    : 'Tên học sinh / Người chơi'}{' '}
                  <span className="text-red-600">*</span>
                </label>
                <input
                  id="player-name"
                  type="text"
                  value={playerName}
                  onChange={(e) => {
                    setPlayerName(e.target.value);
                    setNameError('');
                  }}
                  placeholder="Nhập họ và tên người chơi..."
                  className="w-full px-4 py-3 text-base bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  autoFocus
                />
                {nameError && <p className="text-xs text-red-600 font-medium">{nameError}</p>}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    if (document.fullscreenElement) {
                      document.exitFullscreen().catch(() => {});
                    }
                    onExit();
                  }}
                  className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Quay lại
                </button>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => beginTurn(true)}
                    className="inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition-colors"
                  >
                    <Maximize2 className="w-4 h-4" />
                    <span>Chơi toàn màn hình</span>
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors shadow-sm"
                  >
                    <Play className="w-4 h-4" />
                    <span>Bắt đầu chơi ngay</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Turn transition screen for Competition mode
  if (phase === 'turn_end') {
    const sortedBoard = [...sessionResults].sort(
      (a, b) => b.totalScore - a.totalScore || a.completionTimeSeconds - b.completionTimeSeconds
    );
    const latest = sessionResults[sessionResults.length - 1];

    return (
      <div ref={arenaRef} className="min-h-screen bg-slate-50 overflow-y-auto py-10 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <Trophy className="w-10 h-10 text-amber-500 mx-auto" />
              <h2 className="font-display text-2xl font-bold text-slate-900">
                Hoàn thành lượt {currentTurn} / {maxTurns}
              </h2>
              <p className="text-sm text-slate-600">
                {latest.playerName} đạt{' '}
                <strong className="text-sky-700 tabular-nums">{latest.totalScore} điểm</strong> (
                {latest.correctCount}/{latest.totalQuestions} câu đúng)
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 border-b border-slate-200">
                Bảng xếp hạng tạm thời
              </div>
              <div className="divide-y divide-slate-100">
                {sortedBoard.map((item, idx) => (
                  <div key={item.id} className="px-4 py-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-center tabular-nums">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-900">{item.playerName}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-600 tabular-nums">
                      <span>
                        {item.correctCount}/{item.totalQuestions} đúng
                      </span>
                      <span className="font-bold text-sky-700 text-sm">{item.totalScore} điểm</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  if (document.fullscreenElement) {
                    document.exitFullscreen().catch(() => {});
                  }
                  onFinishAllTurns(latest, sessionResults);
                }}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
              >
                Kết thúc sớm & Xem tổng kết
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentTurn((t) => t + 1);
                  setPlayerName('');
                  setPhase('ready');
                }}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl"
              >
                Chuyển sang lượt {currentTurn + 1} →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  const optionCount = currentQuestion.options.length;
  const activeVoiceInfo = SOUTHERN_VOICE_OPTIONS.find((v) => v.id === aiVoiceId);

  const renderOptionCard = (optIndex: number, dir: Exclude<HeadDirection, 'neutral'>) => {
    const opt = currentQuestion.options[optIndex];
    if (!opt) return null;

    const isHeadActive = activeDir === dir && !feedback?.submitted;
    const progress = holdDirection === dir && !feedback?.submitted ? holdProgress : 0;
    const isMultiChecked = multiSelectedIds.includes(opt.id);
    const isCorrectOpt = currentQuestion.correctOptionIds.includes(opt.id);
    const wasSelected = feedback?.selectedIds.includes(opt.id);

    let cardStyle = 'border-slate-200 bg-white hover:border-sky-400';
    if (feedback?.submitted) {
      if (isCorrectOpt && (feedback.isCorrect || game.showCorrectAnswerOnWrong)) {
        cardStyle = 'border-emerald-500 bg-emerald-50 text-emerald-950';
      } else if (wasSelected && !isCorrectOpt) {
        cardStyle = 'border-red-400 bg-red-50 text-red-950';
      } else {
        cardStyle = 'border-slate-200 bg-slate-50 opacity-70';
      }
    } else if (isMultiChecked) {
      cardStyle = 'border-sky-600 bg-sky-50 ring-2 ring-sky-200';
    } else if (isHeadActive) {
      cardStyle = 'border-sky-600 bg-sky-50 shadow-md scale-[1.02]';
    }

    return (
      <button
        key={opt.id}
        type="button"
        disabled={Boolean(feedback?.submitted) || isPaused}
        onClick={() => handleOptionTrigger(opt.id)}
        className={`relative overflow-hidden w-full text-left rounded-2xl border-2 p-4 sm:p-5 transition-all select-none ${cardStyle}`}
      >
        {progress > 0 && (
          <div
            className="absolute inset-y-0 left-0 bg-emerald-500/20 pointer-events-none"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        )}

        <div className="relative flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl font-display font-bold text-base flex items-center justify-center shrink-0 ${
              isMultiChecked || isHeadActive
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 text-slate-800'
            }`}
          >
            {opt.label}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                {DIRECTION_META[dir].icon}
                <span>{DIRECTION_META[dir].label}</span>
              </span>
              {isMultiChecked && !feedback?.submitted && (
                <span className="text-xs font-bold text-sky-700">Đã chọn</span>
              )}
            </div>

            {opt.imageUrl && (
              <img
                src={opt.imageUrl}
                alt={`Đáp án ${opt.label}`}
                referrerPolicy="no-referrer"
                className="max-h-28 rounded-lg object-contain bg-white border border-slate-200"
              />
            )}

            <p
              className={`font-semibold text-slate-900 break-words ${
                isPresentation || isFullscreen ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'
              }`}
            >
              {opt.text}
            </p>
          </div>
        </div>
      </button>
    );
  };

  const mascotMood = feedback?.submitted
    ? feedback.isCorrect
      ? 'happy'
      : 'encourage'
    : 'idle';

  return (
    <div
      ref={arenaRef}
      className={`min-h-screen bg-slate-50 overflow-y-auto ${
        isFullscreen ? 'p-4 sm:p-6 flex flex-col justify-between' : ''
      }`}
    >
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5">
        {/* Top HUD */}
        <header className="bg-white border border-slate-200 rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-base sm:text-lg font-bold text-slate-900 truncate">
              {game.title}
            </h1>
            <p className="text-xs text-slate-500 truncate">
              {[
                game.lesson ? `Bài: ${game.lesson}` : '',
                game.subject,
                game.gradeClass ? `Lớp ${game.gradeClass}` : game.gradeLevel,
                `Người chơi: ${playerName}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="text-center">
              <p className="text-[11px] font-medium text-slate-500">Tiến trình</p>
              <p className="font-mono text-base sm:text-lg font-bold text-slate-900 tabular-nums">
                {qIndex + 1} / {activeQuestions.length}
              </p>
            </div>

            <div className="text-center">
              <p className="text-[11px] font-medium text-slate-500">Điểm số</p>
              <p className="font-mono text-base sm:text-lg font-bold text-sky-700 tabular-nums">
                {score}
              </p>
            </div>

            {!isPractice && (
              <div className="text-center">
                <p className="text-[11px] font-medium text-slate-500">Thời gian</p>
                <p
                  className={`font-mono text-base sm:text-lg font-bold tabular-nums ${
                    timeLeft <= 5 && timeLeft > 0 ? 'text-red-600' : 'text-slate-900'
                  }`}
                >
                  {timeLeft}s
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              title={isFullscreen ? 'Thoát toàn màn hình' : 'Chế độ toàn màn hình'}
              aria-label={isFullscreen ? 'Thoát toàn màn hình' : 'Chế độ toàn màn hình'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Thu nhỏ</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Toàn màn hình</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Main Arena */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-9 bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 space-y-6 relative">
            {/* Pause Overlay */}
            {isPaused && (
              <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center gap-4 p-6 text-center">
                <h2 className="font-display text-2xl font-bold text-slate-900">
                  Trò chơi đang tạm dừng
                </h2>
                <p className="text-sm text-slate-600">
                  Bộ đếm thời gian và nhận diện đầu đang được tạm nghỉ.
                </p>
                <button
                  type="button"
                  onClick={() => setIsPaused(false)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl"
                >
                  <Play className="w-4 h-4" />
                  <span>Tiếp tục chơi</span>
                </button>
              </div>
            )}

            {/* Question Prompt & Media */}
            <div className="text-center space-y-4">
              {currentQuestion.type === 'multi_select' && (
                <p className="text-xs font-semibold text-sky-700">
                  Câu hỏi nhiều đáp án: Hãy nghiêng đầu giữ để chọn từng đáp án, sau đó nhấn Xác nhận
                </p>
              )}

              <h2
                className={`font-display font-bold text-slate-900 text-balance mx-auto max-w-3xl ${
                  isPresentation || isFullscreen ? 'text-2xl sm:text-4xl' : 'text-xl sm:text-2xl'
                }`}
              >
                {currentQuestion.prompt}
              </h2>

              {currentQuestion.mediaUrl && currentQuestion.mediaType === 'image' && (
                <img
                  src={currentQuestion.mediaUrl}
                  alt="Hình ảnh minh họa câu hỏi"
                  referrerPolicy="no-referrer"
                  className="max-h-60 mx-auto rounded-xl border border-slate-200 object-contain bg-slate-50"
                />
              )}
              {currentQuestion.mediaUrl && currentQuestion.mediaType === 'audio' && (
                <audio controls src={currentQuestion.mediaUrl} className="mx-auto w-full max-w-md" />
              )}
              {currentQuestion.mediaUrl && currentQuestion.mediaType === 'video' && (
                <video
                  controls
                  src={currentQuestion.mediaUrl}
                  className="max-h-60 mx-auto rounded-xl bg-black"
                />
              )}
            </div>

            {/* Options + Central Mascot Layout */}
            {optionCount === 2 && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-5">{renderOptionCard(0, 'left')}</div>
                <div className="md:col-span-2 flex justify-center py-2">
                  <MascotCharacter
                    characterId={calibration.characterId}
                    direction={activeDir}
                    mood={mascotMood}
                    speed={calibration.characterSpeed}
                    tiltAngleDeg={pose.faceDetected ? pose.smoothedRollDeg : 0}
                    size={isPresentation || isFullscreen ? 120 : 100}
                  />
                </div>
                <div className="md:col-span-5">{renderOptionCard(1, 'right')}</div>
              </div>
            )}

            {optionCount === 3 && (
              <div className="space-y-4">
                <div className="max-w-md mx-auto">{renderOptionCard(1, 'up')}</div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  <div className="md:col-span-5">{renderOptionCard(0, 'left')}</div>
                  <div className="md:col-span-2 flex justify-center py-2">
                    <MascotCharacter
                      characterId={calibration.characterId}
                      direction={activeDir}
                      mood={mascotMood}
                      speed={calibration.characterSpeed}
                      tiltAngleDeg={pose.faceDetected ? pose.smoothedRollDeg : 0}
                      size={96}
                    />
                  </div>
                  <div className="md:col-span-5">{renderOptionCard(2, 'right')}</div>
                </div>
              </div>
            )}

            {optionCount >= 4 && (
              <div className="space-y-4">
                <div className="max-w-md mx-auto">{renderOptionCard(2, 'up')}</div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  <div className="md:col-span-5">{renderOptionCard(0, 'left')}</div>
                  <div className="md:col-span-2 flex justify-center py-2">
                    <MascotCharacter
                      characterId={calibration.characterId}
                      direction={activeDir}
                      mood={mascotMood}
                      speed={calibration.characterSpeed}
                      tiltAngleDeg={pose.faceDetected ? pose.smoothedRollDeg : 0}
                      size={96}
                    />
                  </div>
                  <div className="md:col-span-5">{renderOptionCard(1, 'right')}</div>
                </div>
                <div className="max-w-md mx-auto">{renderOptionCard(3, 'down')}</div>
              </div>
            )}

            {/* Multi-select Confirm Button */}
            {currentQuestion.type === 'multi_select' && !feedback?.submitted && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  disabled={multiSelectedIds.length === 0}
                  onClick={() => evaluateAnswer(multiSelectedIds, false)}
                  className="px-6 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 rounded-xl transition-colors"
                >
                  Xác nhận đáp án đã chọn ({multiSelectedIds.length})
                </button>
              </div>
            )}

            {/* Answer Feedback Banner (Always displays Right/Wrong + AI Voice Status) */}
            {feedback?.submitted && (
              <div
                className={`rounded-2xl border p-5 space-y-3 ${
                  feedback.isCorrect
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50 border-amber-200 text-amber-950'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {feedback.isCorrect ? (
                      <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-7 h-7 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <p className="font-display text-lg sm:text-xl font-bold">
                        {feedback.isCorrect
                          ? 'CHÍNH XÁC!'
                          : feedback.isUnanswered
                          ? 'HẾT THỜI GIAN!'
                          : 'CHƯA CHÍNH XÁC!'}
                      </p>
                      <p className="text-xs font-medium">
                        {feedback.isCorrect
                          ? `Kết quả đúng · Bạn nhận được +${feedback.pointsEarned} điểm thưởng.`
                          : 'Kết quả chưa đúng · Đừng lo lắng, hãy xem lại đáp án nhé!'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isPractice && !feedback.isCorrect && (
                      <button
                        type="button"
                        onClick={handleRetryQuestion}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-amber-900 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Làm lại câu này</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleNextQuestion}
                      className="px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl"
                    >
                      {qIndex + 1 < activeQuestions.length
                        ? voiceState === 'speaking'
                          ? 'Bỏ qua & sang câu tiếp →'
                          : 'Câu tiếp theo →'
                        : 'Xem kết quả tổng kết'}
                    </button>
                  </div>
                </div>

                {!feedback.isCorrect && game.showCorrectAnswerOnWrong && (
                  <p className="text-sm font-semibold">
                    Đáp án đúng:{' '}
                    {currentQuestion.options
                      .filter((o) => currentQuestion.correctOptionIds.includes(o.id))
                      .map((o) => `${o.label}. ${o.text}`)
                      .join(' · ')}
                  </p>
                )}

                {currentQuestion.explanation && (
                  <p className="text-sm leading-relaxed opacity-90">
                    Giải thích: {currentQuestion.explanation}
                  </p>
                )}

                {/* AI Voice Playback Indicator */}
                {aiVoiceEnabled && calibration.soundEnabled && (
                  <div className="pt-2 border-t border-black/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                    {voiceState === 'speaking' && (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-sky-800">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>
                          Giọng đọc AI ({activeVoiceInfo?.name}) đang phản hồi... Sau khi đọc xong sẽ tự động chuyển câu.
                        </span>
                      </span>
                    )}
                    {voiceState === 'done' && (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800">
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Đã phản hồi xong, đang chuyển sang câu tiếp theo...</span>
                      </span>
                    )}
                    {voiceState === 'error' && (
                      <span className="inline-flex items-center gap-1.5 font-medium text-red-700">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{voiceErrorMsg} (Đang tự động chuyển câu...)</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Side Column: Live Camera Widget & Voice Control */}
          <aside className="lg:col-span-3 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">Camera nhận diện</span>
                {cameraStatus !== 'active' ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="text-xs font-semibold text-sky-700 hover:underline"
                  >
                    Bật camera
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="text-xs font-semibold text-red-600 hover:underline"
                  >
                    Tắt camera
                  </button>
                )}
              </div>

              <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
                <video
                  ref={attachVideoElement}
                  playsInline
                  muted
                  className={`w-full h-full object-cover -scale-x-100 ${
                    cameraStatus === 'active' ? 'block' : 'hidden'
                  }`}
                />
                <canvas
                  ref={canvasRef}
                  className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${
                    cameraStatus === 'active' ? 'block' : 'hidden'
                  }`}
                />

                {cameraStatus !== 'active' && (
                  <div className="p-3 text-center space-y-2">
                    <Camera className="w-6 h-6 text-slate-400 mx-auto" />
                    <p className="text-[11px] text-slate-300">
                      {cameraStatus === 'initializing'
                        ? 'Đang mở camera...'
                        : 'Chế độ bàn phím / chuột đang sẵn sàng'}
                    </p>
                  </div>
                )}
              </div>

              {cameraStatus === 'active' && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-600 truncate">
                    {pose.faceDetected ? 'Đã nhận diện khuôn mặt' : 'Chưa thấy khuôn mặt'}
                  </span>
                  <button
                    type="button"
                    onClick={handleQuickCalibrate}
                    disabled={!pose.faceDetected}
                    className="text-emerald-700 font-semibold hover:underline disabled:opacity-40 shrink-0"
                  >
                    Đặt tâm
                  </button>
                </div>
              )}
            </div>

            {/* In-game Southern AI Voice Switcher */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800">Giọng đọc AI miền Nam</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = !aiVoiceEnabled;
                    if (!next) stopActiveAiVoice();
                    setAiVoiceEnabled(next);
                  }}
                  className={`text-xs font-semibold ${
                    aiVoiceEnabled ? 'text-emerald-700' : 'text-slate-500'
                  }`}
                >
                  {aiVoiceEnabled ? 'Đang bật' : 'Đang tắt'}
                </button>
              </div>
              {aiVoiceEnabled && (
                <select
                  value={aiVoiceId}
                  onChange={(e) => setAiVoiceId(e.target.value as SouthernVoiceId)}
                  className="w-full px-2.5 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {SOUTHERN_VOICE_OPTIONS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.regionLabel})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">Cách điều khiển</p>
              <p>
                • Camera: Nghiêng đầu trái/phải{optionCount >= 3 ? ', ngẩng/cúi đầu' : ''} và giữ{' '}
                {(calibration.holdDurationMs / 1000).toFixed(1)}s.
              </p>
              <p>
                • Dự phòng: Nhấn phím mũi tên (← → ↑ ↓), phím số 1–4, hoặc bấm trực tiếp vào đáp án.
              </p>
            </div>
          </aside>
        </div>

        {/* Bottom Controls Bar */}
        <footer className="bg-white border border-slate-200 rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-600">
            {isPractice
              ? 'Chế độ Luyện tập · Không giới hạn thời gian'
              : isCompetition
              ? `Chế độ Thi đấu · Lượt ${currentTurn} / ${maxTurns}`
              : isPresentation
              ? 'Chế độ Trình chiếu lớp học'
              : 'Chế độ Thử thách · Cộng điểm theo tốc độ'}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Thoát toàn màn hình</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Toàn màn hình</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                const next = !calibration.soundEnabled;
                if (!next) stopActiveAiVoice();
                soundFX.setEnabled(next);
                onUpdateCalibration({ ...calibration, soundEnabled: next });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg"
            >
              {calibration.soundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Âm thanh</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                  <span>Tắt tiếng</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isPaused) stopActiveAiVoice();
                setIsPaused((p) => !p);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              {isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Tiếp tục</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Tạm dừng</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                clearPendingAdvance();
                stopCamera();
                if (document.fullscreenElement) {
                  document.exitFullscreen().catch(() => {});
                }
                onExit();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Thoát trò chơi</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
