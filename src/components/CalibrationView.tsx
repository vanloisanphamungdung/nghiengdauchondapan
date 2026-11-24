import React, { useEffect, useState } from 'react';
import {
  Camera,
  CameraOff,
  Crosshair,
  RotateCcw,
  Volume2,
  VolumeX,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { CalibrationSettings, HeadDirection, SouthernVoiceId } from '../types/game';
import { useHeadTracking } from '../hooks/useHeadTracking';
import { CHARACTER_LABELS, MascotCharacter } from './MascotCharacter';
import { soundFX } from '../services/sound';
import {
  playAiVoiceFeedback,
  SOUTHERN_VOICE_OPTIONS,
  stopActiveAiVoice,
} from '../services/aiVoice';

interface CalibrationViewProps {
  calibration: CalibrationSettings;
  onUpdateCalibration: (next: CalibrationSettings) => void;
  onResetCalibration: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

export const CalibrationView: React.FC<CalibrationViewProps> = ({
  calibration,
  onUpdateCalibration,
  onResetCalibration,
  onNotify,
}) => {
  const [testMode, setTestMode] = useState<'2' | '4'>('4');
  const [lastTriggered, setLastTriggered] = useState<string>('');
  const [manualDir, setManualDir] = useState<HeadDirection>('neutral');
  const [testingVoice, setTestingVoice] = useState(false);
  const [voiceSampleText, setVoiceSampleText] = useState('');
  const [voiceSampleError, setVoiceSampleError] = useState('');

  const allowedDirections: HeadDirection[] =
    testMode === '2' ? ['left', 'right'] : ['left', 'right', 'up', 'down'];

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
  } = useHeadTracking({
    calibration,
    allowedDirections,
    enabled: true,
    onDirectionHoldComplete: (dir) => {
      soundFX.playSelectLock();
      const map: Record<Exclude<HeadDirection, 'neutral'>, string> = {
        left: 'Đáp án A (Nghiêng trái)',
        right: 'Đáp án B (Nghiêng phải)',
        up: 'Đáp án C (Ngẩng đầu)',
        down: 'Đáp án D (Cúi đầu)',
      };
      setLastTriggered(map[dir]);
    },
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setManualDir('left');
      else if (e.key === 'ArrowRight') setManualDir('right');
      else if (e.key === 'ArrowUp' && testMode === '4') setManualDir('up');
      else if (e.key === 'ArrowDown' && testMode === '4') setManualDir('down');
    };
    const onKeyUp = () => setManualDir('neutral');
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [testMode]);

  const activeDir = pose.direction !== 'neutral' ? pose.direction : manualDir;

  const handleCaptureCenter = () => {
    const captured = captureNeutralCalibration();
    if (!captured) {
      onNotify(
        'error',
        'Chưa nhận diện được khuôn mặt',
        'Hãy bật camera và nhìn thẳng vào màn hình trước khi hiệu chỉnh vị trí trung tâm.'
      );
      return;
    }
    onUpdateCalibration({
      ...calibration,
      rollCenter: captured.rollCenter,
      pitchCenter: captured.pitchCenter,
    });
    onNotify(
      'success',
      'Đã hiệu chỉnh vị trí trung tâm',
      'Tư thế ngồi hiện tại đã được đặt làm vị trí cân bằng.'
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            Hiệu chỉnh & Kiểm tra nhận diện đầu
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Mọi xử lý nhận diện khuôn mặt chạy trực tiếp trên trình duyệt, không gửi hình ảnh lên máy chủ.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {cameraStatus !== 'active' && cameraStatus !== 'initializing' ? (
            <button
              type="button"
              onClick={startCamera}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors shadow-sm"
            >
              <Camera className="w-4 h-4" />
              <span>BẮT ĐẦU NHẬN DIỆN</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCamera}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors"
            >
              <CameraOff className="w-4 h-4" />
              <span>Tắt camera</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Live Camera Feed + Calibration Controls */}
        <div className="lg:col-span-6 space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Khung hình camera trực tiếp
              </h2>
              <span className="text-xs font-medium text-slate-600 tabular-nums">
                {cameraStatus === 'active'
                  ? pose.faceDetected
                    ? `Đã nhận diện · Góc nghiêng: ${pose.smoothedRollDeg.toFixed(1)}°`
                    : 'Đang tìm khuôn mặt...'
                  : cameraStatus === 'initializing'
                  ? 'Đang khởi động mô hình...'
                  : 'Camera đang tắt'}
              </span>
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

              {cameraStatus === 'idle' && (
                <div className="text-center p-6 space-y-3 text-slate-300">
                  <Camera className="w-10 h-10 mx-auto text-slate-400" />
                  <p className="text-sm font-medium text-white">
                    Nhấn "BẮT ĐẦU NHẬN DIỆN" để kiểm tra camera
                  </p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Trình duyệt sẽ hỏi quyền truy cập camera. Hình ảnh được xử lý hoàn toàn tại thiết bị của bạn.
                  </p>
                </div>
              )}

              {cameraStatus === 'initializing' && (
                <div className="text-center p-6 space-y-2 text-white">
                  <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm font-medium">Đang tải bộ nhận diện khuôn mặt...</p>
                </div>
              )}

              {(cameraStatus === 'denied' ||
                cameraStatus === 'unavailable' ||
                cameraStatus === 'error') && (
                <div className="text-center p-6 space-y-3 max-w-md">
                  <AlertTriangle className="w-10 h-10 mx-auto text-amber-400" />
                  <p className="text-sm font-semibold text-white">Không thể sử dụng camera</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{errorMessage}</p>
                  <p className="text-xs text-sky-300">
                    Mẹo: Giáo viên và học sinh vẫn có thể chơi đầy đủ bằng phím mũi tên, chuột hoặc chạm trên màn hình.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleCaptureCenter}
                disabled={cameraStatus !== 'active' || !pose.faceDetected}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  cameraStatus === 'active' && pose.faceDetected
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Crosshair className="w-4 h-4" />
                <span>Hiệu chỉnh vị trí trung tâm</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onResetCalibration();
                  onNotify('info', 'Đã đặt lại thông số hiệu chỉnh mặc định.');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi phục mặc định</span>
              </button>
            </div>
          </div>

          {/* Sliders & Preferences */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Thông số điều khiển & Nhân vật
            </h2>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <label htmlFor="cal-sensitivity" className="font-medium text-slate-700">
                    Độ nhạy nghiêng đầu
                  </label>
                  <span className="font-mono text-xs font-semibold text-sky-700 tabular-nums">
                    Mức {calibration.sensitivity} / 10
                  </span>
                </div>
                <input
                  id="cal-sensitivity"
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={calibration.sensitivity}
                  onChange={(e) =>
                    onUpdateCalibration({ ...calibration, sensitivity: Number(e.target.value) })
                  }
                  className="w-full accent-sky-600"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>Nghiêng nhiều mới nhận (ít nhạy)</span>
                  <span>Nghiêng nhẹ đã nhận (rất nhạy)</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <label htmlFor="cal-hold" className="font-medium text-slate-700">
                    Thời gian giữ để xác nhận đáp án
                  </label>
                  <span className="font-mono text-xs font-semibold text-sky-700 tabular-nums">
                    {(calibration.holdDurationMs / 1000).toFixed(1)} giây
                  </span>
                </div>
                <input
                  id="cal-hold"
                  type="range"
                  min={400}
                  max={3000}
                  step={100}
                  value={calibration.holdDurationMs}
                  onChange={(e) =>
                    onUpdateCalibration({
                      ...calibration,
                      holdDurationMs: Number(e.target.value),
                    })
                  }
                  className="w-full accent-sky-600"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>Nhanh (0.4s)</span>
                  <span>Chống chọn nhầm (3.0s)</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <label htmlFor="cal-speed" className="font-medium text-slate-700">
                    Tốc độ di chuyển nhân vật
                  </label>
                  <span className="font-mono text-xs font-semibold text-sky-700 tabular-nums">
                    Mức {calibration.characterSpeed} / 10
                  </span>
                </div>
                <input
                  id="cal-speed"
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={calibration.characterSpeed}
                  onChange={(e) =>
                    onUpdateCalibration({
                      ...calibration,
                      characterSpeed: Number(e.target.value),
                    })
                  }
                  className="w-full accent-sky-600"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Chọn nhân vật đồng hành</span>
                  <button
                    type="button"
                    onClick={() => {
                      const nextSound = !calibration.soundEnabled;
                      soundFX.setEnabled(nextSound);
                      onUpdateCalibration({ ...calibration, soundEnabled: nextSound });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    {calibration.soundEnabled ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Âm thanh: Bật</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                        <span>Âm thanh: Tắt</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {(['owl', 'panda', 'robot'] as const).map((charId) => {
                    const selected = calibration.characterId === charId;
                    return (
                      <button
                        key={charId}
                        type="button"
                        onClick={() => onUpdateCalibration({ ...calibration, characterId: charId })}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                          selected
                            ? 'border-sky-600 bg-sky-50 text-sky-900'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <MascotCharacter characterId={charId} direction="neutral" size={56} />
                        <span className="text-xs font-semibold text-center">
                          {CHARACTER_LABELS[charId]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Southern Vietnamese AI Voice Default */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={calibration.aiVoiceEnabled}
                      onChange={(e) =>
                        onUpdateCalibration({ ...calibration, aiVoiceEnabled: e.target.checked })
                      }
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span>Bật giọng đọc AI phản hồi (Miền Nam)</span>
                  </label>
                  {testingVoice && (
                    <button
                      type="button"
                      onClick={() => {
                        stopActiveAiVoice();
                        setTestingVoice(false);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                    >
                      Dừng đọc
                    </button>
                  )}
                </div>

                {calibration.aiVoiceEnabled && (
                  <select
                    value={calibration.aiVoiceId}
                    onChange={(e) =>
                      onUpdateCalibration({
                        ...calibration,
                        aiVoiceId: e.target.value as SouthernVoiceId,
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {SOUTHERN_VOICE_OPTIONS.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.regionLabel}) — {v.description}
                      </option>
                    ))}
                  </select>
                )}

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <label
                    htmlFor="cal-voice-sample"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Nhập câu mẫu để tạo giọng đọc AI
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id="cal-voice-sample"
                      type="text"
                      maxLength={600}
                      value={voiceSampleText}
                      onChange={(e) => {
                        setVoiceSampleText(e.target.value);
                        if (voiceSampleError) setVoiceSampleError('');
                      }}
                      placeholder="Nhập câu tiếng Việt muốn AI đọc thử..."
                      className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button
                      type="button"
                      disabled={testingVoice}
                      onClick={async () => {
                        const clean = voiceSampleText.trim();
                        if (!clean) {
                          const msg = 'Vui lòng nhập câu mẫu trước khi tạo giọng đọc AI.';
                          setVoiceSampleError(msg);
                          onNotify('error', 'Chưa có câu mẫu', msg);
                          return;
                        }
                        setVoiceSampleError('');
                        try {
                          setTestingVoice(true);
                          stopActiveAiVoice();
                          await playAiVoiceFeedback(clean, calibration.aiVoiceId);
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
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-700 bg-sky-100/80 hover:bg-sky-200/80 rounded-lg disabled:opacity-60 shrink-0"
                    >
                      {testingVoice ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                      <span>{testingVoice ? 'Đang tạo...' : 'Tạo giọng đọc AI'}</span>
                    </button>
                  </div>
                  {voiceSampleError && (
                    <p className="text-[11px] font-medium text-red-600">{voiceSampleError}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Interactive Live Test Arena */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Kiểm tra thử chuyển động
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Nghiêng đầu (hoặc bấm phím mũi tên) và giữ để xem thanh xác nhận hoạt động.
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setTestMode('2')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  testMode === '2' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                2 hướng (Trái / Phải)
              </button>
              <button
                type="button"
                onClick={() => setTestMode('4')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  testMode === '4' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                4 hướng (Trái / Phải / Ngẩng / Cúi)
              </button>
            </div>
          </div>

          {/* Test Stage */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 min-h-[360px] flex flex-col justify-between gap-4">
            {testMode === '4' && (
              <div className="flex justify-center">
                <DirectionTestTile
                  label="C · Ngẩng đầu"
                  icon={<ArrowUp className="w-4 h-4" />}
                  active={activeDir === 'up'}
                  progress={holdDirection === 'up' ? holdProgress : 0}
                  onPressStart={() => setManualDir('up')}
                  onPressEnd={() => setManualDir('neutral')}
                />
              </div>
            )}

            <div className="grid grid-cols-3 items-center gap-3 my-auto">
              <DirectionTestTile
                label="A · Nghiêng trái"
                icon={<ArrowLeft className="w-4 h-4" />}
                active={activeDir === 'left'}
                progress={holdDirection === 'left' ? holdProgress : 0}
                onPressStart={() => setManualDir('left')}
                onPressEnd={() => setManualDir('neutral')}
              />

              <div className="flex flex-col items-center justify-center py-4">
                <MascotCharacter
                  characterId={calibration.characterId}
                  direction={activeDir}
                  speed={calibration.characterSpeed}
                  tiltAngleDeg={pose.faceDetected ? pose.smoothedRollDeg : 0}
                  mood={lastTriggered ? 'happy' : 'idle'}
                  size={112}
                />
              </div>

              <DirectionTestTile
                label="B · Nghiêng phải"
                icon={<ArrowRight className="w-4 h-4" />}
                active={activeDir === 'right'}
                progress={holdDirection === 'right' ? holdProgress : 0}
                onPressStart={() => setManualDir('right')}
                onPressEnd={() => setManualDir('neutral')}
              />
            </div>

            {testMode === '4' && (
              <div className="flex justify-center">
                <DirectionTestTile
                  label="D · Cúi đầu"
                  icon={<ArrowDown className="w-4 h-4" />}
                  active={activeDir === 'down'}
                  progress={holdDirection === 'down' ? holdProgress : 0}
                  onPressStart={() => setManualDir('down')}
                  onPressEnd={() => setManualDir('neutral')}
                />
              </div>
            )}
          </div>

          {lastTriggered ? (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Đã xác nhận thành công: {lastTriggered}</span>
              </div>
              <button
                type="button"
                onClick={() => setLastTriggered('')}
                className="text-xs font-semibold text-emerald-700 hover:underline"
              >
                Xóa
              </button>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">Hướng dẫn học sinh thao tác:</p>
              <p>
                1. Ngồi chính diện trước camera ở nơi đủ sáng. 2. Nghiêng đầu sang hướng muốn chọn và giữ yên đến khi thanh màu xanh chạy đầy. 3. Trả đầu về thẳng giữa trước khi chọn câu tiếp theo.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface DirectionTestTileProps {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  progress: number;
  onPressStart: () => void;
  onPressEnd: () => void;
}

const DirectionTestTile: React.FC<DirectionTestTileProps> = ({
  label,
  icon,
  active,
  progress,
  onPressStart,
  onPressEnd,
}) => (
  <button
    type="button"
    onMouseDown={onPressStart}
    onMouseUp={onPressEnd}
    onMouseLeave={onPressEnd}
    onTouchStart={onPressStart}
    onTouchEnd={onPressEnd}
    className={`relative overflow-hidden px-4 py-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-all min-w-[140px] ${
      active
        ? 'border-sky-600 bg-sky-50 text-sky-900 shadow-sm scale-[1.02]'
        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
    }`}
  >
    <span
      className="absolute inset-y-0 left-0 bg-emerald-500/20 transition-none pointer-events-none"
      style={{ width: `${Math.round(progress * 100)}%` }}
    />
    <span className="relative flex items-center gap-1.5">
      {icon}
      <span>{label}</span>
    </span>
  </button>
);
