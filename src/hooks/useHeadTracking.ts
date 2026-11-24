import { useCallback, useEffect, useRef, useState } from 'react';
import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import { CalibrationSettings, HeadDirection } from '../types/game';

export type CameraStatus =
  | 'idle'
  | 'initializing'
  | 'active'
  | 'denied'
  | 'unavailable'
  | 'error';

export interface HeadPoseTelemetry {
  faceDetected: boolean;
  rawRollDeg: number;
  rawPitchRatio: number;
  smoothedRollDeg: number; // relative to rollCenter
  smoothedPitchDelta: number; // relative to pitchCenter
  direction: HeadDirection;
}

interface UseHeadTrackingOptions {
  calibration: CalibrationSettings;
  allowedDirections: HeadDirection[];
  enabled?: boolean;
  onDirectionHoldComplete?: (direction: Exclude<HeadDirection, 'neutral'>) => void;
}

let tfliteFilterRefCount = 0;
let originalConsoleError: typeof console.error | null = null;

function isBenignTfliteLog(args: unknown[]): boolean {
  return args.some((arg) => {
    if (typeof arg !== 'string') return false;
    return (
      arg.startsWith('INFO:') ||
      arg.includes('Created TensorFlow Lite XNNPACK delegate')
    );
  });
}

function retainTfliteInfoFilter(): void {
  if (tfliteFilterRefCount === 0) {
    originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      if (isBenignTfliteLog(args)) {
        console.debug(...args);
        return;
      }
      originalConsoleError?.apply(console, args);
    };
  }
  tfliteFilterRefCount += 1;
}

function releaseTfliteInfoFilter(): void {
  if (tfliteFilterRefCount <= 0) return;
  tfliteFilterRefCount -= 1;
  if (tfliteFilterRefCount === 0 && originalConsoleError) {
    console.error = originalConsoleError;
    originalConsoleError = null;
  }
}

export function useHeadTracking({
  calibration,
  allowedDirections,
  enabled = true,
  onDirectionHoldComplete,
}: UseHeadTrackingOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [pose, setPose] = useState<HeadPoseTelemetry>({
    faceDetected: false,
    rawRollDeg: 0,
    rawPitchRatio: 0,
    smoothedRollDeg: 0,
    smoothedPitchDelta: 0,
    direction: 'neutral',
  });
  const [holdDirection, setHoldDirection] = useState<HeadDirection>('neutral');
  const [holdProgress, setHoldProgress] = useState<number>(0); // 0 to 1

  // Mutable refs for animation loop without re-binding callbacks
  const calibrationRef = useRef(calibration);
  calibrationRef.current = calibration;

  const allowedRef = useRef(allowedDirections);
  allowedRef.current = allowedDirections;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const onHoldCompleteRef = useRef(onDirectionHoldComplete);
  onHoldCompleteRef.current = onDirectionHoldComplete;

  const smoothRollRef = useRef(0);
  const smoothPitchRef = useRef(0);
  const rawRollRef = useRef(0);
  const rawPitchRef = useRef(0);
  const currentDirRef = useRef<HeadDirection>('neutral');
  const holdStartTimeRef = useRef<number | null>(null);
  const holdTriggeredRef = useRef(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    currentDirRef.current = 'neutral';
    holdStartTimeRef.current = null;
    holdTriggeredRef.current = false;
    setHoldDirection('neutral');
    setHoldProgress(0);
    setPose((prev) => ({
      ...prev,
      faceDetected: false,
      direction: 'neutral',
    }));
    setCameraStatus('idle');
    setErrorMessage('');
  }, []);

  const ensureLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;

    const vision = await import('@mediapipe/tasks-vision');
    const { FilesetResolver, FaceLandmarker } = vision;

    retainTfliteInfoFilter();
    try {
      const filesetResolver = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
      const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      landmarkerRef.current = landmarker;
      return landmarker;
    } finally {
      releaseTfliteInfoFilter();
    }
  }, []);

  const drawOverlay = useCallback(
    (
      landmarks: Array<{ x: number; y: number; z: number }> | null,
      direction: HeadDirection
    ) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!landmarks || landmarks.length < 400) return;

      const w = canvas.width;
      const h = canvas.height;
      // Draw subtle tracking guide points (mirrored X to match video CSS scaleX(-1))
      const keyIndices = [33, 263, 1, 10, 152];
      const leftEye = landmarks[33];
      const rightEye = landmarks[263];

      const lx = (1 - leftEye.x) * w;
      const ly = leftEye.y * h;
      const rx = (1 - rightEye.x) * w;
      const ry = rightEye.y * h;

      // Eye axis line
      ctx.save();
      ctx.strokeStyle = direction === 'neutral' ? '#38bdf8' : '#10b981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(rx, ry);
      ctx.stroke();

      keyIndices.forEach((idx) => {
        const pt = landmarks[idx];
        if (!pt) return;
        const px = (1 - pt.x) * w;
        const py = pt.y * h;
        ctx.fillStyle = idx === 1 ? '#f59e0b' : '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, idx === 1 ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      });
      ctx.restore();
    },
    []
  );

  const runDetectionLoop = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !landmarker || !streamRef.current) {
      return;
    }

    const now = performance.now();

    if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;

      try {
        retainTfliteInfoFilter();
        let result;
        try {
          result = landmarker.detectForVideo(video, now);
        } finally {
          releaseTfliteInfoFilter();
        }
        const face = result.faceLandmarks?.[0];

        if (face && face.length > 300) {
          // Mirror X so user's physical left aligns with screen left
          const pLeft = face[33]; // user's right eye in raw, mirrored -> right side; wait: let's compute via actual mirrored X
          const pRight = face[263];
          const nose = face[1];
          const forehead = face[10];
          const chin = face[152];

          const eyeA = { x: 1 - pLeft.x, y: pLeft.y };
          const eyeB = { x: 1 - pRight.x, y: pRight.y };

          // Ensure leftEye is the one on the left side of mirrored screen (smaller x)
          const leftScreenEye = eyeA.x < eyeB.x ? eyeA : eyeB;
          const rightScreenEye = eyeA.x < eyeB.x ? eyeB : eyeA;

          const dx = rightScreenEye.x - leftScreenEye.x;
          const dy = rightScreenEye.y - leftScreenEye.y;
          // Tilting head to physical left -> leftScreenEye drops (larger y), rightScreenEye rises (smaller y) -> dy < 0 -> negative degrees
          const rawRollDeg = (Math.atan2(dy, Math.max(0.001, dx)) * 180) / Math.PI;

          // Pitch ratio: nose Y relative to eye midpoint, normalized by face vertical height
          const eyeMidY = (leftScreenEye.y + rightScreenEye.y) / 2;
          const faceHeight = Math.max(0.05, Math.abs(chin.y - forehead.y));
          const rawPitchRatio = (nose.y - eyeMidY) / faceHeight;

          rawRollRef.current = rawRollDeg;
          rawPitchRef.current = rawPitchRatio;

          const cal = calibrationRef.current;
          const relRoll = rawRollDeg - cal.rollCenter;
          const relPitch = rawPitchRatio - cal.pitchCenter;

          // EMA smoothing to eliminate jitter
          const alpha = 0.28;
          smoothRollRef.current = smoothRollRef.current * (1 - alpha) + relRoll * alpha;
          smoothPitchRef.current = smoothPitchRef.current * (1 - alpha) + relPitch * alpha;

          const sRoll = smoothRollRef.current;
          const sPitch = smoothPitchRef.current;

          // Sensitivity 1..10 maps enter threshold from 21 deg down to 7.5 deg
          const enterRollThresh = 22.5 - cal.sensitivity * 1.5;
          const exitRollThresh = enterRollThresh * 0.65;

          const enterPitchUpThresh = -(0.095 - cal.sensitivity * 0.0055);
          const exitPitchUpThresh = enterPitchUpThresh * 0.6;

          const enterPitchDownThresh = 0.095 - cal.sensitivity * 0.0055;
          const exitPitchDownThresh = enterPitchDownThresh * 0.6;

          const allowed = allowedRef.current;
          const prevDir = currentDirRef.current;
          let nextDir: HeadDirection = 'neutral';

          // Hysteresis check on current active direction first
          if (prevDir === 'left' && allowed.includes('left') && sRoll < -exitRollThresh) {
            nextDir = 'left';
          } else if (prevDir === 'right' && allowed.includes('right') && sRoll > exitRollThresh) {
            nextDir = 'right';
          } else if (prevDir === 'up' && allowed.includes('up') && sPitch < exitPitchUpThresh) {
            nextDir = 'up';
          } else if (prevDir === 'down' && allowed.includes('down') && sPitch > exitPitchDownThresh) {
            nextDir = 'down';
          } else {
            // Check fresh entry based on dominant axis
            const rollStrength = Math.abs(sRoll) / enterRollThresh;
            const pitchUpStrength = allowed.includes('up') && sPitch < 0 ? Math.abs(sPitch) / Math.abs(enterPitchUpThresh) : 0;
            const pitchDownStrength = allowed.includes('down') && sPitch > 0 ? Math.abs(sPitch) / enterPitchDownThresh : 0;

            if (sRoll < -enterRollThresh && allowed.includes('left') && rollStrength >= Math.max(pitchUpStrength, pitchDownStrength)) {
              nextDir = 'left';
            } else if (sRoll > enterRollThresh && allowed.includes('right') && rollStrength >= Math.max(pitchUpStrength, pitchDownStrength)) {
              nextDir = 'right';
            } else if (sPitch < enterPitchUpThresh && allowed.includes('up')) {
              nextDir = 'up';
            } else if (sPitch > enterPitchDownThresh && allowed.includes('down')) {
              nextDir = 'down';
            } else {
              nextDir = 'neutral';
            }
          }

          if (!enabledRef.current) {
            nextDir = 'neutral';
          }

          if (nextDir !== prevDir) {
            currentDirRef.current = nextDir;
            holdStartTimeRef.current = nextDir !== 'neutral' ? now : null;
            holdTriggeredRef.current = false;
            setHoldDirection(nextDir);
            setHoldProgress(0);
          } else if (nextDir !== 'neutral' && enabledRef.current) {
            if (holdStartTimeRef.current === null) {
              holdStartTimeRef.current = now;
            }
            const elapsed = now - holdStartTimeRef.current;
            const progress = Math.min(1, elapsed / Math.max(300, cal.holdDurationMs));
            setHoldProgress(progress);

            if (progress >= 1 && !holdTriggeredRef.current) {
              holdTriggeredRef.current = true;
              onHoldCompleteRef.current?.(nextDir);
            }
          } else {
            setHoldProgress(0);
          }

          drawOverlay(face, nextDir);

          setPose({
            faceDetected: true,
            rawRollDeg,
            rawPitchRatio,
            smoothedRollDeg: sRoll,
            smoothedPitchDelta: sPitch,
            direction: nextDir,
          });
        } else {
          drawOverlay(null, 'neutral');
          currentDirRef.current = 'neutral';
          holdStartTimeRef.current = null;
          holdTriggeredRef.current = false;
          setHoldDirection('neutral');
          setHoldProgress(0);
          setPose((prev) => ({
            ...prev,
            faceDetected: false,
            direction: 'neutral',
          }));
        }
      } catch (err) {
        console.warn('Face detection frame skipped:', err);
      }
    }

    rafRef.current = requestAnimationFrame(runDetectionLoop);
  }, [drawOverlay]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('unavailable');
      setErrorMessage('Trình duyệt hoặc thiết bị hiện tại không hỗ trợ truy cập camera.');
      return;
    }

    setCameraStatus('initializing');
    setErrorMessage('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      await ensureLandmarker();

      setCameraStatus('active');
      lastVideoTimeRef.current = -1;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(runDetectionLoop);
    } catch (err) {
      stopCamera();
      const domErr = err as DOMException;
      if (domErr?.name === 'NotAllowedError' || domErr?.name === 'PermissionDeniedError') {
        setCameraStatus('denied');
        setErrorMessage(
          'Quyền sử dụng camera đã bị từ chối. Vui lòng cấp quyền camera trên trình duyệt hoặc dùng phím mũi tên / chuột để chơi.'
        );
      } else if (domErr?.name === 'NotFoundError' || domErr?.name === 'DevicesNotFoundError') {
        setCameraStatus('unavailable');
        setErrorMessage(
          'Không tìm thấy camera trên thiết bị. Bạn vẫn có thể chơi bằng bàn phím, chuột hoặc chạm màn hình.'
        );
      } else {
        setCameraStatus('error');
        setErrorMessage(
          'Không thể khởi động bộ nhận diện khuôn mặt. Vui lòng kiểm tra kết nối mạng (để tải mô hình lần đầu) hoặc dùng chế độ điều khiển thay thế.'
        );
      }
    }
  }, [ensureLandmarker, runDetectionLoop, stopCamera]);

  const captureNeutralCalibration = useCallback((): { rollCenter: number; pitchCenter: number } | null => {
    if (!pose.faceDetected) return null;
    smoothRollRef.current = 0;
    smoothPitchRef.current = 0;
    return {
      rollCenter: Number(rawRollRef.current.toFixed(2)),
      pitchCenter: Number(rawPitchRef.current.toFixed(4)),
    };
  }, [pose.faceDetected]);

  const resetHoldState = useCallback(() => {
    holdStartTimeRef.current = null;
    holdTriggeredRef.current = false;
    currentDirRef.current = 'neutral';
    setHoldDirection('neutral');
    setHoldProgress(0);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Re-attach stream if video element mounts after camera started
  const attachVideoElement = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  return {
    videoRef,
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
  };
}
