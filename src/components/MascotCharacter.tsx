import React from 'react';
import { CharacterId, HeadDirection } from '../types/game';

interface MascotCharacterProps {
  characterId: CharacterId;
  direction: HeadDirection;
  mood?: 'idle' | 'happy' | 'encourage';
  speed?: number; // 1..10
  tiltAngleDeg?: number;
  size?: number;
}

export const CHARACTER_LABELS: Record<CharacterId, string> = {
  owl: 'Cú Mèo Thông Thái',
  panda: 'Gấu Trúc Năng Động',
  robot: 'Robot Tí Hon',
};

export const MascotCharacter: React.FC<MascotCharacterProps> = ({
  characterId,
  direction,
  mood = 'idle',
  speed = 6,
  tiltAngleDeg = 0,
  size = 128,
}) => {
  const transitionMs = Math.max(90, 320 - speed * 22);

  let translateX = 0;
  let translateY = 0;
  let rotateDeg = Math.max(-22, Math.min(22, tiltAngleDeg));

  if (direction === 'left') {
    translateX = -28;
    if (Math.abs(tiltAngleDeg) < 2) rotateDeg = -14;
  } else if (direction === 'right') {
    translateX = 28;
    if (Math.abs(tiltAngleDeg) < 2) rotateDeg = 14;
  } else if (direction === 'up') {
    translateY = -20;
  } else if (direction === 'down') {
    translateY = 18;
  }

  if (mood === 'happy') {
    translateY -= 12;
  }

  const wrapperStyle: React.CSSProperties = {
    transform: `translate3d(${translateX}px, ${translateY}px, 0) rotate(${rotateDeg}deg) ${
      mood === 'happy' ? 'scale(1.08)' : mood === 'encourage' ? 'scale(0.97)' : 'scale(1)'
    }`,
    transition: `transform ${transitionMs}ms cubic-bezier(0.16, 1, 0.3, 1)`,
    width: size,
    height: size,
  };

  return (
    <div
      style={wrapperStyle}
      className="relative flex items-center justify-center select-none will-change-transform"
      aria-label={CHARACTER_LABELS[characterId]}
    >
      {characterId === 'owl' && <OwlSvg mood={mood} />}
      {characterId === 'panda' && <PandaSvg mood={mood} />}
      {characterId === 'robot' && <RobotSvg mood={mood} />}
    </div>
  );
};

const OwlSvg: React.FC<{ mood: 'idle' | 'happy' | 'encourage' }> = ({ mood }) => (
  <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-md">
    {/* Graduation Cap */}
    <polygon points="60,8 24,22 60,34 96,22" fill="#1e293b" />
    <rect x="44" y="25" width="32" height="8" rx="3" fill="#334155" />
    <path d="M90 24 L90 40" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
    <circle cx="90" cy="42" r="3.5" fill="#f59e0b" />

    {/* Body */}
    <ellipse cx="60" cy="74" rx="38" ry="36" fill="#0284c7" />
    <ellipse cx="60" cy="82" rx="25" ry="24" fill="#e0f2fe" />

    {/* Wings */}
    <ellipse
      cx="22"
      cy={mood === 'happy' ? '64' : '76'}
      rx="10"
      ry="20"
      transform={mood === 'happy' ? 'rotate(-28 22 64)' : 'rotate(10 22 76)'}
      fill="#0369a1"
    />
    <ellipse
      cx="98"
      cy={mood === 'happy' ? '64' : '76'}
      rx="10"
      ry="20"
      transform={mood === 'happy' ? 'rotate(28 98 64)' : 'rotate(-10 98 76)'}
      fill="#0369a1"
    />

    {/* Face discs */}
    <circle cx="44" cy="57" r="15" fill="#ffffff" />
    <circle cx="76" cy="57" r="15" fill="#ffffff" />

    {/* Eyes */}
    {mood === 'happy' ? (
      <>
        <path d="M37 57 Q44 49 51 57" fill="none" stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M69 57 Q76 49 83 57" fill="none" stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" />
      </>
    ) : mood === 'encourage' ? (
      <>
        <circle cx="44" cy="58" r="6" fill="#0f172a" />
        <circle cx="76" cy="58" r="6" fill="#0f172a" />
        <circle cx="46" cy="56" r="2" fill="#ffffff" />
        <circle cx="78" cy="56" r="2" fill="#ffffff" />
        <path d="M36 47 L50 50" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M84 47 L70 50" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
      </>
    ) : (
      <>
        <circle cx="44" cy="57" r="6.5" fill="#0f172a" />
        <circle cx="76" cy="57" r="6.5" fill="#0f172a" />
        <circle cx="46.5" cy="54.5" r="2.2" fill="#ffffff" />
        <circle cx="78.5" cy="54.5" r="2.2" fill="#ffffff" />
      </>
    )}

    {/* Beak */}
    <polygon points="55,64 65,64 60,73" fill="#f59e0b" />

    {/* Cheeks */}
    <circle cx="31" cy="67" r="4" fill="#fb7185" opacity="0.55" />
    <circle cx="89" cy="67" r="4" fill="#fb7185" opacity="0.55" />

    {/* Feet */}
    <rect x="44" y="106" width="10" height="6" rx="3" fill="#f59e0b" />
    <rect x="66" y="106" width="10" height="6" rx="3" fill="#f59e0b" />
  </svg>
);

const PandaSvg: React.FC<{ mood: 'idle' | 'happy' | 'encourage' }> = ({ mood }) => (
  <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-md">
    {/* Ears */}
    <circle cx="28" cy="30" r="14" fill="#1e293b" />
    <circle cx="92" cy="30" r="14" fill="#1e293b" />
    {/* Body */}
    <ellipse cx="60" cy="95" rx="30" ry="20" fill="#1e293b" />
    <ellipse cx="60" cy="97" rx="18" ry="14" fill="#f8fafc" />
    {/* Head */}
    <circle cx="60" cy="58" r="36" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
    {/* Eye patches */}
    <ellipse cx="43" cy="56" rx="11" ry="13" transform="rotate(-15 43 56)" fill="#1e293b" />
    <ellipse cx="77" cy="56" rx="11" ry="13" transform="rotate(15 77 56)" fill="#1e293b" />
    {/* Eyes */}
    {mood === 'happy' ? (
      <>
        <path d="M38 56 Q43 50 48 56" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
        <path d="M72 56 Q77 50 82 56" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
      </>
    ) : (
      <>
        <circle cx="43" cy="56" r="4.5" fill="#ffffff" />
        <circle cx="77" cy="56" r="4.5" fill="#ffffff" />
        <circle cx="44" cy="55" r="2" fill="#0f172a" />
        <circle cx="78" cy="55" r="2" fill="#0f172a" />
      </>
    )}
    {/* Nose & Mouth */}
    <ellipse cx="60" cy="68" rx="6" ry="4" fill="#1e293b" />
    {mood === 'encourage' ? (
      <path d="M53 77 Q60 74 67 77" fill="none" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
    ) : (
      <path d="M51 75 Q60 83 69 75" fill="none" stroke="#1e293b" strokeWidth="2.8" strokeLinecap="round" />
    )}
    {/* Cheeks */}
    <circle cx="32" cy="68" r="5" fill="#fb7185" opacity="0.55" />
    <circle cx="88" cy="68" r="5" fill="#fb7185" opacity="0.55" />
  </svg>
);

const RobotSvg: React.FC<{ mood: 'idle' | 'happy' | 'encourage' }> = ({ mood }) => (
  <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-md">
    {/* Antenna */}
    <line x1="60" y1="14" x2="60" y2="28" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
    <circle cx="60" cy="12" r="6" fill={mood === 'happy' ? '#10b981' : '#f59e0b'} />
    {/* Ears */}
    <rect x="14" y="50" width="10" height="22" rx="4" fill="#0284c7" />
    <rect x="96" y="50" width="10" height="22" rx="4" fill="#0284c7" />
    {/* Head */}
    <rect x="22" y="28" width="76" height="62" rx="18" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" />
    {/* Visor */}
    <rect x="31" y="40" width="58" height="34" rx="10" fill="#0f172a" />
    {/* Eyes */}
    {mood === 'happy' ? (
      <>
        <path d="M39 58 Q46 49 53 58" fill="none" stroke="#34d399" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M67 58 Q74 49 81 58" fill="none" stroke="#34d399" strokeWidth="3.5" strokeLinecap="round" />
      </>
    ) : mood === 'encourage' ? (
      <>
        <circle cx="46" cy="57" r="5.5" fill="#fbbf24" />
        <circle cx="74" cy="57" r="5.5" fill="#fbbf24" />
      </>
    ) : (
      <>
        <circle cx="46" cy="57" r="6" fill="#38bdf8" />
        <circle cx="74" cy="57" r="6" fill="#38bdf8" />
        <circle cx="48" cy="55" r="2" fill="#ffffff" />
        <circle cx="76" cy="55" r="2" fill="#ffffff" />
      </>
    )}
    {/* Mouth */}
    <rect x="44" y="80" width="32" height="5" rx="2.5" fill="#64748b" />
    {/* Neck & Shoulders */}
    <rect x="48" y="90" width="24" height="8" fill="#94a3b8" />
    <path d="M30 112 C30 98 90 98 90 112 Z" fill="#0284c7" />
  </svg>
);
