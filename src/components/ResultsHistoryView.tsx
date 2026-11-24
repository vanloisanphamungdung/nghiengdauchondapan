import React, { useState } from 'react';
import {
  Trophy,
  RotateCcw,
  Download,
  Printer,
  Trash2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from 'lucide-react';
import { GameResult } from '../types/game';
import { exportResultsToSpreadsheet } from '../services/excelCsv';

interface ResultsHistoryViewProps {
  latestResult: GameResult | null;
  sessionResults: GameResult[];
  allResults: GameResult[];
  onReplayGame: (gameId: string) => void;
  onDeleteResult: (resultId: string) => void;
  onClearHistory: () => void;
  onGoHome: () => void;
}

export const ResultsHistoryView: React.FC<ResultsHistoryViewProps> = ({
  latestResult,
  sessionResults,
  allResults,
  onReplayGame,
  onDeleteResult,
  onClearHistory,
  onGoHome,
}) => {
  const [selectedResult, setSelectedResult] = useState<GameResult | null>(latestResult);
  const [showReview, setShowReview] = useState<boolean>(true);
  const [confirmClear, setConfirmClear] = useState(false);

  const displayed = selectedResult ?? latestResult ?? allResults[0] ?? null;

  const sortedSessionBoard =
    sessionResults.length > 1
      ? [...sessionResults].sort(
          (a, b) => b.totalScore - a.totalScore || a.completionTimeSeconds - b.completionTimeSeconds
        )
      : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            Kết quả & Thống kê học tập
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Xem chi tiết điểm số, đáp án từng câu và xuất báo cáo Excel, CSV hoặc bản in.
          </p>
        </div>

        {allResults.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                exportResultsToSpreadsheet(
                  displayed ? [displayed] : allResults,
                  displayed ? `ket_qua_${displayed.playerName}` : 'lich_su_ket_qua',
                  'xlsx'
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={() =>
                exportResultsToSpreadsheet(
                  displayed ? [displayed] : allResults,
                  displayed ? `ket_qua_${displayed.playerName}` : 'lich_su_ket_qua',
                  'csv'
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất CSV</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In kết quả</span>
            </button>
          </div>
        )}
      </div>

      {/* Empty State */}
      {allResults.length === 0 && !displayed ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <BarChart3 className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="font-display text-xl font-bold text-slate-900">
              Chưa có dữ liệu kết quả nào
            </h2>
            <p className="text-sm text-slate-600">
              Sau khi học sinh hoàn thành một lượt chơi, điểm số, tỷ lệ chính xác và chi tiết từng câu hỏi sẽ được lưu tại đây.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoHome}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl"
          >
            Quay về trang chủ
          </button>
        </div>
      ) : (
        <>
          {/* Multi-turn Competition Leaderboard (if current session had multiple turns) */}
          {sortedSessionBoard.length > 0 && (
            <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Bảng xếp hạng thi đấu vừa hoàn thành
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 pr-4">Hạng</th>
                      <th className="py-2.5 px-4">Học sinh</th>
                      <th className="py-2.5 px-4">Số câu đúng</th>
                      <th className="py-2.5 px-4">Tỷ lệ</th>
                      <th className="py-2.5 px-4">Thời gian</th>
                      <th className="py-2.5 pl-4 text-right">Tổng điểm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedSessionBoard.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-3 pr-4 font-bold tabular-nums">{idx + 1}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {item.playerName}
                        </td>
                        <td className="py-3 px-4 tabular-nums">
                          {item.correctCount}/{item.totalQuestions}
                        </td>
                        <td className="py-3 px-4 tabular-nums">{item.accuracyPercent}%</td>
                        <td className="py-3 px-4 tabular-nums">{item.completionTimeSeconds}s</td>
                        <td className="py-3 pl-4 text-right font-bold text-sky-700 tabular-nums">
                          {item.totalScore}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Detailed Summary Card */}
          {displayed && (
            <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">
                    {displayed.gameTitle} · {displayed.lesson} ·{' '}
                    {new Date(displayed.completedAt).toLocaleString('vi-VN')}
                  </p>
                  <h2 className="font-display text-2xl font-bold text-slate-900">
                    Người chơi: {displayed.playerName}
                  </h2>
                  <p className="text-sm font-semibold text-emerald-700">
                    Đánh giá: {displayed.evaluationLabel} — {displayed.evaluationFeedback}
                  </p>
                </div>

                <div className="flex items-center gap-2 no-print">
                  <button
                    type="button"
                    onClick={() => onReplayGame(displayed.gameId)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Chơi lại</span>
                  </button>
                </div>
              </div>

              {/* Required Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <MetricBox label="Tổng số câu" value={String(displayed.totalQuestions)} />
                <MetricBox label="Trả lời đúng" value={String(displayed.correctCount)} accent="emerald" />
                <MetricBox label="Trả lời sai" value={String(displayed.wrongCount)} accent="amber" />
                <MetricBox label="Chưa trả lời" value={String(displayed.unansweredCount)} />
                <MetricBox label="Tổng điểm" value={String(displayed.totalScore)} accent="sky" />
                <MetricBox label="Tỷ lệ đúng" value={`${displayed.accuracyPercent}%`} />
                <MetricBox label="Hoàn thành" value={`${displayed.completionTimeSeconds}s`} />
              </div>

              {/* Question-by-question review */}
              <div className="pt-2 space-y-3">
                <button
                  type="button"
                  onClick={() => setShowReview((r) => !r)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 hover:text-sky-700 no-print"
                >
                  {showReview ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  <span>Xem chi tiết từng câu hỏi ({displayed.records.length})</span>
                </button>

                {showReview && (
                  <div className="space-y-3">
                    {displayed.records.map((rec, idx) => (
                      <div
                        key={rec.questionId + idx}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2">
                            {rec.isCorrect ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            )}
                            <p className="text-sm font-semibold text-slate-900">
                              Câu {idx + 1}: {rec.questionPrompt}
                            </p>
                          </div>
                          <span className="text-xs font-mono font-semibold text-slate-600 shrink-0 tabular-nums">
                            +{rec.pointsEarned} điểm · {rec.timeSpentSeconds}s
                          </span>
                        </div>

                        <div className="pl-7 text-xs space-y-1">
                          <p className="text-slate-700">
                            Đã chọn:{' '}
                            <span className="font-semibold">
                              {rec.isUnanswered
                                ? '(Hết giờ / Chưa chọn)'
                                : rec.selectedTexts.join(', ')}
                            </span>
                          </p>
                          {!rec.isCorrect && (
                            <p className="text-emerald-700">
                              Đáp án đúng:{' '}
                              <span className="font-semibold">{rec.correctTexts.join(', ')}</span>
                            </p>
                          )}
                          {rec.explanation && (
                            <p className="text-slate-600">Giải thích: {rec.explanation}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Full History Table */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 no-print">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-lg font-bold text-slate-900">
                Lịch sử các lượt đã lưu ({allResults.length})
              </h3>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    exportResultsToSpreadsheet(allResults, 'toan_bo_lich_su_ket_qua', 'xlsx')
                  }
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Xuất toàn bộ lịch sử (.xlsx)
                </button>
                {confirmClear ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClearHistory();
                      setSelectedResult(null);
                      setConfirmClear(false);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg"
                  >
                    Xác nhận xóa tất cả?
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    Xóa lịch sử
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 pr-4">Học sinh</th>
                    <th className="py-2.5 px-4">Trò chơi</th>
                    <th className="py-2.5 px-4">Đúng / Tổng</th>
                    <th className="py-2.5 px-4">Điểm</th>
                    <th className="py-2.5 px-4">Thời gian</th>
                    <th className="py-2.5 px-4">Ngày hoàn thành</th>
                    <th className="py-2.5 pl-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allResults.map((res) => (
                    <tr
                      key={res.id}
                      className={`hover:bg-slate-50 ${
                        displayed?.id === res.id ? 'bg-sky-50/50' : ''
                      }`}
                    >
                      <td className="py-3 pr-4 font-semibold text-slate-900">{res.playerName}</td>
                      <td className="py-3 px-4 text-slate-700">{res.gameTitle}</td>
                      <td className="py-3 px-4 tabular-nums">
                        {res.correctCount}/{res.totalQuestions} ({res.accuracyPercent}%)
                      </td>
                      <td className="py-3 px-4 font-bold text-sky-700 tabular-nums">
                        {res.totalScore}
                      </td>
                      <td className="py-3 px-4 tabular-nums">{res.completionTimeSeconds}s</td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {new Date(res.completedAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-3 pl-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => setSelectedResult(res)}
                          className="text-xs font-semibold text-sky-700 hover:underline"
                        >
                          Xem
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedResult?.id === res.id) setSelectedResult(null);
                            onDeleteResult(res.id);
                          }}
                          className="text-slate-400 hover:text-red-600 align-middle"
                          aria-label="Xóa kết quả"
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

const MetricBox: React.FC<{
  label: string;
  value: string;
  accent?: 'sky' | 'emerald' | 'amber';
}> = ({ label, value, accent }) => {
  const valColor =
    accent === 'sky'
      ? 'text-sky-700'
      : accent === 'emerald'
      ? 'text-emerald-700'
      : accent === 'amber'
      ? 'text-amber-700'
      : 'text-slate-900';

  return (
    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`font-mono text-xl font-bold mt-1 tabular-nums ${valColor}`}>{value}</p>
    </div>
  );
};
