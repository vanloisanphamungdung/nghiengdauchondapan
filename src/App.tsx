import { useCallback, useEffect, useState } from 'react';
import {
  AppRoute,
  CalibrationSettings,
  GameConfig,
  GameResult,
  ToastMessage,
} from './types/game';
import {
  clearAllResults,
  DEFAULT_CALIBRATION_SETTINGS,
  deleteGameById,
  deleteResultById,
  getAllGames,
  getAllResults,
  getCalibrationSettings,
  saveCalibrationSettings,
  saveGame,
  saveGameResult,
} from './services/storage';
import { exportGameAsJson, parseGameFromJson } from './services/excelCsv';
import { soundFX } from './services/sound';
import { TopNav } from './components/TopNav';
import { HomeView } from './components/HomeView';
import { GameEditorView } from './components/GameEditorView';
import { CalibrationView } from './components/CalibrationView';
import { GamePlayView } from './components/GamePlayView';
import { ResultsHistoryView } from './components/ResultsHistoryView';
import { ToastContainer } from './components/ToastContainer';

function createBlankGame(calibration?: CalibrationSettings): GameConfig {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: '',
    lesson: '',
    gradeLevel: '',
    gradeClass: '',
    subject: '',
    description: '',
    playMode: '',
    questionCountLimit: '',
    defaultTimeLimit: '',
    maxAttempts: '',
    showCorrectAnswerOnWrong: true,
    autoAdvance: true,
    autoAdvanceDelay: 3,
    aiVoiceEnabled: calibration?.aiVoiceEnabled ?? true,
    aiVoiceId: calibration?.aiVoiceId ?? 'south_female_mai',
    aiVoiceSampleText: '',
    aiCorrectSample: '',
    aiWrongSample: '',
    evaluationRules: [],
    questions: [],
    createdAt: now,
    updatedAt: now,
  };
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>('home');
  const [games, setGames] = useState<GameConfig[]>([]);
  const [results, setResults] = useState<GameResult[]>([]);
  const [calibration, setCalibration] = useState<CalibrationSettings>(
    DEFAULT_CALIBRATION_SETTINGS
  );
  const [loading, setLoading] = useState(true);

  const [editingGame, setEditingGame] = useState<GameConfig | null>(null);
  const [playingGame, setPlayingGame] = useState<GameConfig | null>(null);
  const [latestResult, setLatestResult] = useState<GameResult | null>(null);
  const [sessionResults, setSessionResults] = useState<GameResult[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback(
    (type: ToastMessage['type'], title: string, message?: string) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, type, title, message }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    let active = true;
    async function hydrate() {
      try {
        const [loadedGames, loadedResults, loadedCal] = await Promise.all([
          getAllGames(),
          getAllResults(),
          getCalibrationSettings(),
        ]);
        if (!active) return;
        const normalizedGames = loadedGames.map((g) => ({
          ...g,
          autoAdvance: g.autoAdvance ?? true,
          aiVoiceEnabled: g.aiVoiceEnabled ?? true,
          aiVoiceId: g.aiVoiceId ?? 'south_female_mai',
        }));
        setGames(normalizedGames);
        setResults(loadedResults);
        setCalibration(loadedCal);
        soundFX.setEnabled(loadedCal.soundEnabled);
      } catch (err) {
        console.error(err);
        if (active) {
          notify('error', 'Lỗi tải dữ liệu', 'Không thể đọc bộ nhớ trình duyệt.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    hydrate();
    return () => {
      active = false;
    };
  }, [notify]);

  const handleUpdateCalibration = async (next: CalibrationSettings) => {
    setCalibration(next);
    soundFX.setEnabled(next.soundEnabled);
    await saveCalibrationSettings(next);
  };

  const handleResetCalibration = async () => {
    await handleUpdateCalibration(DEFAULT_CALIBRATION_SETTINGS);
  };

  const handleCreateNewGame = () => {
    setEditingGame(createBlankGame(calibration));
    setRoute('editor');
  };

  const handleEditGame = (game: GameConfig) => {
    setEditingGame(game);
    setRoute('editor');
  };

  const handleSaveGame = async (gameToSave: GameConfig) => {
    try {
      const stamped: GameConfig = { ...gameToSave, updatedAt: Date.now() };
      await saveGame(stamped);
      setGames((prev) => {
        const filtered = prev.filter((g) => g.id !== stamped.id);
        return [stamped, ...filtered].sort((a, b) => b.updatedAt - a.updatedAt);
      });
      setEditingGame(stamped);
      notify('success', 'Đã lưu trò chơi thành công');
    } catch (err) {
      notify(
        'error',
        'Không thể lưu trò chơi',
        err instanceof Error ? err.message : 'Vui lòng thử lại.'
      );
    }
  };

  const handleDuplicateGame = async (game: GameConfig) => {
    const now = Date.now();
    const copy: GameConfig = {
      ...game,
      id: crypto.randomUUID(),
      title: `${game.title} (Bản sao)`,
      questions: game.questions.map((q) => {
        const idMap = new Map<string, string>();
        const newOpts = q.options.map((o) => {
          const nid = crypto.randomUUID();
          idMap.set(o.id, nid);
          return { ...o, id: nid };
        });
        return {
          ...q,
          id: crypto.randomUUID(),
          options: newOpts,
          correctOptionIds: q.correctOptionIds
            .map((id) => idMap.get(id))
            .filter((x): x is string => Boolean(x)),
        };
      }),
      createdAt: now,
      updatedAt: now,
    };
    await saveGame(copy);
    setGames((prev) => [copy, ...prev]);
    notify('success', 'Đã sao chép trò chơi');
  };

  const handleDeleteGame = async (gameId: string) => {
    await deleteGameById(gameId);
    setGames((prev) => prev.filter((g) => g.id !== gameId));
    notify('info', 'Đã xóa trò chơi');
  };

  const handleImportGameJson = async (file: File) => {
    try {
      const imported = await parseGameFromJson(file);
      await saveGame(imported);
      setGames((prev) => [imported, ...prev]);
      notify('success', `Đã tải lên trò chơi "${imported.title}"`);
    } catch (err) {
      notify(
        'error',
        'Không thể tải lên tệp trò chơi',
        err instanceof Error ? err.message : 'Tệp JSON không hợp lệ.'
      );
    }
  };

  const handleStartPlay = (game: GameConfig) => {
    if (game.questions.length === 0) {
      notify(
        'error',
        'Chưa có câu hỏi',
        'Trò chơi cần có ít nhất 1 câu hỏi hợp lệ trước khi bắt đầu.'
      );
      return;
    }
    setPlayingGame(game);
    setSessionResults([]);
    setRoute('play');
  };

  const handleCompleteResult = async (result: GameResult) => {
    await saveGameResult(result);
    setResults((prev) => [result, ...prev]);
  };

  const handleFinishAllTurns = (latest: GameResult, session: GameResult[]) => {
    setLatestResult(latest);
    setSessionResults(session);
    setPlayingGame(null);
    setRoute('results');
  };

  const handleReplayGame = (gameId: string) => {
    const found = games.find((g) => g.id === gameId);
    if (!found) {
      notify('error', 'Không tìm thấy trò chơi', 'Trò chơi này có thể đã bị xóa.');
      setRoute('home');
      return;
    }
    handleStartPlay(found);
  };

  const handleDeleteResult = async (resultId: string) => {
    await deleteResultById(resultId);
    setResults((prev) => prev.filter((r) => r.id !== resultId));
    if (latestResult?.id === resultId) setLatestResult(null);
    notify('info', 'Đã xóa bản ghi kết quả');
  };

  const handleClearHistory = async () => {
    await clearAllResults();
    setResults([]);
    setLatestResult(null);
    setSessionResults([]);
    notify('info', 'Đã xóa toàn bộ lịch sử kết quả');
  };

  const handleNavigate = (nextRoute: AppRoute) => {
    if (nextRoute === 'editor' && !editingGame) {
      setEditingGame(createBlankGame(calibration));
    }
    setRoute(nextRoute);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Đang khởi tạo ứng dụng...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {route !== 'play' && (
        <TopNav
          currentRoute={route}
          onNavigate={handleNavigate}
          onCreateNewGame={handleCreateNewGame}
        />
      )}

      <main className="flex-1">
        {route === 'home' && (
          <HomeView
            games={games}
            soundEnabled={calibration.soundEnabled}
            onToggleSound={() =>
              handleUpdateCalibration({
                ...calibration,
                soundEnabled: !calibration.soundEnabled,
              })
            }
            onCreateNewGame={handleCreateNewGame}
            onEditGame={handleEditGame}
            onPlayGame={handleStartPlay}
            onDuplicateGame={handleDuplicateGame}
            onDeleteGame={handleDeleteGame}
            onExportGameJson={(g) => {
              exportGameAsJson(g);
              notify('success', 'Đã tải xuống tệp trò chơi (.json)');
            }}
            onImportGameJson={handleImportGameJson}
            onGoCalibration={() => setRoute('calibration')}
          />
        )}

        {route === 'editor' && editingGame && (
          <GameEditorView
            key={editingGame.id}
            game={editingGame}
            onSaveGame={handleSaveGame}
            onStartPlay={handleStartPlay}
            onBackHome={() => setRoute('home')}
            onNotify={notify}
          />
        )}

        {route === 'calibration' && (
          <CalibrationView
            calibration={calibration}
            onUpdateCalibration={handleUpdateCalibration}
            onResetCalibration={handleResetCalibration}
            onNotify={notify}
          />
        )}

        {route === 'play' && playingGame && (
          <GamePlayView
            game={playingGame}
            calibration={calibration}
            onUpdateCalibration={handleUpdateCalibration}
            onCompleteResult={handleCompleteResult}
            onFinishAllTurns={handleFinishAllTurns}
            onExit={() => {
              setPlayingGame(null);
              setRoute('home');
            }}
            onNotify={notify}
          />
        )}

        {route === 'results' && (
          <ResultsHistoryView
            latestResult={latestResult}
            sessionResults={sessionResults}
            allResults={results}
            onReplayGame={handleReplayGame}
            onDeleteResult={handleDeleteResult}
            onClearHistory={handleClearHistory}
            onGoHome={() => setRoute('home')}
          />
        )}
      </main>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
