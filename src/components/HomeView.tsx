import React, { useMemo, useRef, useState } from 'react';
import {
  Play,
  Plus,
  Upload,
  Edit3,
  Copy,
  Trash2,
  Download,
  Camera,
  FileSpreadsheet,
  Volume2,
  VolumeX,
  Search,
  FolderOpen,
} from 'lucide-react';
import { GameConfig, GradeLevel, PlayMode } from '../types/game';
import { MascotCharacter } from './MascotCharacter';
import { downloadQuestionTemplate } from '../services/excelCsv';

interface HomeViewProps {
  games: GameConfig[];
  soundEnabled: boolean;
  onToggleSound: () => void;
  onCreateNewGame: () => void;
  onEditGame: (game: GameConfig) => void;
  onPlayGame: (game: GameConfig) => void;
  onDuplicateGame: (game: GameConfig) => void;
  onDeleteGame: (gameId: string) => void;
  onExportGameJson: (game: GameConfig) => void;
  onImportGameJson: (file: File) => void;
  onGoCalibration: () => void;
}

const PLAY_MODE_LABELS: Record<Exclude<PlayMode, ''>, string> = {
  practice: 'Luyện tập',
  challenge: 'Thử thách',
  competition: 'Thi đấu',
  presentation: 'Trình chiếu',
};

export const HomeView: React.FC<HomeViewProps> = ({
  games,
  soundEnabled,
  onToggleSound,
  onCreateNewGame,
  onEditGame,
  onPlayGame,
  onDuplicateGame,
  onDeleteGame,
  onExportGameJson,
  onImportGameJson,
  onGoCalibration,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState<'all' | Exclude<GradeLevel, ''>>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredGames = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return games.filter((g) => {
      if (gradeFilter !== 'all' && g.gradeLevel !== gradeFilter) return false;
      if (!q) return true;
      return (
        g.title.toLowerCase().includes(q) ||
        g.lesson.toLowerCase().includes(q) ||
        g.subject.toLowerCase().includes(q) ||
        g.gradeClass.toLowerCase().includes(q)
      );
    });
  }, [games, searchTerm, gradeFilter]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportGameJson(file);
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* Hero Banner */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 space-y-5">
          <p className="text-sm font-semibold text-sky-700">
            Ứng dụng học tập tương tác bằng chuyển động đầu
          </p>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight text-balance">
            Biến mỗi bài học thành trò chơi vận động hứng thú
          </h1>
          <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
            Học sinh nghiêng đầu sang trái, sang phải, ngẩng đầu hoặc cúi đầu trước camera để điều khiển nhân vật chọn đáp án. Giáo viên chủ động biên soạn bộ câu hỏi cho mọi môn học, mọi chủ đề từ Mầm non đến THPT.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onCreateNewGame}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo trò chơi mới</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Tải lên bộ trò chơi (.json)</span>
            </button>

            <button
              type="button"
              onClick={onGoCalibration}
              className="inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
            >
              <Camera className="w-4 h-4 text-sky-600" />
              <span>Kiểm tra & Hiệu chỉnh camera</span>
            </button>

            <button
              type="button"
              onClick={onToggleSound}
              className="inline-flex items-center gap-2 px-3.5 py-3 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
              aria-label={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-600" />
                  <span>Âm thanh: Bật</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-400" />
                  <span>Âm thanh: Tắt</span>
                </>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {/* Visual Showcase of Head-Tilt Mechanic */}
        <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center space-y-4">
          <div className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 px-2">
            <span>⬅ Nghiêng trái: Đáp án A</span>
            <span>Nghiêng phải: Đáp án B ➡</span>
          </div>
          <div className="py-2 animate-float-slow">
            <MascotCharacter characterId="owl" direction="neutral" mood="happy" size={120} />
          </div>
          <div className="w-full grid grid-cols-2 gap-3 text-center">
            <div className="bg-white border border-slate-200 rounded-xl py-2.5 px-3">
              <p className="text-xs text-slate-500">Xử lý tại trình duyệt</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">Bảo mật camera 100%</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl py-2.5 px-3">
              <p className="text-xs text-slate-500">Hỗ trợ dự phòng</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">Phím mũi tên & Chạm</p>
            </div>
          </div>
        </div>
      </section>

      {/* Saved Games Library */}
      <section className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              Kho trò chơi của giáo viên
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {games.length === 0
                ? 'Chưa có trò chơi nào được tạo. Hãy bắt đầu tạo trò chơi mới hoặc tải tệp bộ câu hỏi.'
                : `Hiện có ${games.length} trò chơi được lưu trên trình duyệt của bạn.`}
            </p>
          </div>

          {games.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm tên trò chơi, môn học..."
                  className="pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 w-56"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['all', 'Mầm non', 'Tiểu học', 'THCS', 'THPT'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setGradeFilter(lvl)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      gradeFilter === lvl
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lvl === 'all' ? 'Tất cả' : lvl}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Strict Empty State (No Sample Games) */}
        {games.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 sm:p-12 text-center space-y-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <FolderOpen className="w-7 h-7" />
            </div>
            <div className="max-w-xl mx-auto space-y-2">
              <h3 className="font-display text-xl font-bold text-slate-900">
                Chưa có trò chơi hoặc bộ câu hỏi nào
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Hệ thống khởi tạo hoàn toàn trống để giáo viên chủ động biên soạn nội dung theo đúng bài học thực tế. Thực hiện theo 3 bước sau để bắt đầu:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto text-left">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <p className="text-xs font-semibold text-sky-700">Bước 01</p>
                <p className="text-sm font-semibold text-slate-900">Thiết lập trò chơi</p>
                <p className="text-xs text-slate-600">
                  Nhập tên trò chơi, bài học, cấp học, môn học và chọn hình thức chơi phù hợp.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <p className="text-xs font-semibold text-sky-700">Bước 02</p>
                <p className="text-sm font-semibold text-slate-900">Soạn hoặc nhập câu hỏi</p>
                <p className="text-xs text-slate-600">
                  Tạo câu hỏi trắc nghiệm 2–4 đáp án, đúng/sai, kèm ảnh/âm thanh/video hoặc nhập từ Excel, CSV.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <p className="text-xs font-semibold text-sky-700">Bước 03</p>
                <p className="text-sm font-semibold text-slate-900">Hiệu chỉnh & Chơi ngay</p>
                <p className="text-xs text-slate-600">
                  Kiểm tra nhận diện khuôn mặt qua camera hoặc dùng bàn phím, chuột, cảm ứng để tham gia.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onCreateNewGame}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Bắt đầu tạo trò chơi</span>
              </button>

              <button
                type="button"
                onClick={() => downloadQuestionTemplate('xlsx')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Tải mẫu Excel (.xlsx)</span>
              </button>
            </div>
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-sm text-slate-600">
              Không tìm thấy trò chơi nào khớp với bộ lọc hiện tại.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredGames.map((game) => {
              const hasQuestions = game.questions.length > 0;
              const modeLabel = game.playMode ? PLAY_MODE_LABELS[game.playMode] : 'Chưa chọn chế độ';
              const metadataParts = [
                game.gradeLevel || 'Chưa chọn cấp',
                game.gradeClass ? `Lớp ${game.gradeClass}` : null,
                game.subject || null,
                `${game.questions.length} câu hỏi`,
                modeLabel,
              ].filter(Boolean);

              return (
                <article
                  key={game.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-sky-300 transition-colors"
                >
                  <div className="space-y-2.5">
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                      {metadataParts.map((part, idx) => (
                        <React.Fragment key={idx}>
                          {idx > 0 && <span aria-hidden="true">·</span>}
                          <span>{part}</span>
                        </React.Fragment>
                      ))}
                    </div>

                    <h3 className="font-display text-lg font-bold text-slate-900 line-clamp-2">
                      {game.title || 'Trò chơi chưa đặt tên'}
                    </h3>

                    {game.lesson && (
                      <p className="text-sm font-medium text-sky-700 line-clamp-1">
                        Bài học: {game.lesson}
                      </p>
                    )}

                    {game.description && (
                      <p className="text-xs text-slate-600 line-clamp-2">{game.description}</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    {!hasQuestions && (
                      <p className="text-xs text-amber-700 font-medium">
                        Cần thêm ít nhất 1 câu hỏi trước khi bắt đầu chơi.
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!hasQuestions}
                        onClick={() => onPlayGame(game)}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg transition-colors ${
                          hasQuestions
                            ? 'bg-sky-600 hover:bg-sky-700 text-white'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <Play className="w-4 h-4" />
                        <span>Bắt đầu chơi</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onEditGame(game)}
                        className="p-2 text-slate-600 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors"
                        title="Chỉnh sửa trò chơi & câu hỏi"
                        aria-label="Chỉnh sửa trò chơi"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDuplicateGame(game)}
                        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Sao chép trò chơi"
                        aria-label="Sao chép trò chơi"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onExportGameJson(game)}
                        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Tải xuống tệp trò chơi (.json)"
                        aria-label="Tải xuống tệp trò chơi"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {confirmDeleteId === game.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteGame(game.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-2.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                        >
                          Xóa?
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(game.id)}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Xóa trò chơi"
                          aria-label="Xóa trò chơi"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
