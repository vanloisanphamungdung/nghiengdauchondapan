import React from 'react';
import { AppRoute } from '../types/game';

interface TopNavProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onCreateNewGame: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  currentRoute,
  onNavigate,
  onCreateNewGame,
}) => {
  const navItems: { id: AppRoute; label: string }[] = [
    { id: 'home', label: 'Trang chủ' },
    { id: 'editor', label: 'Thiết lập trò chơi' },
    { id: 'calibration', label: 'Nhận diện đầu' },
    { id: 'results', label: 'Kết quả & Thống kê' },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-sky-700 transition-colors text-left"
        >
          Trò Chơi Nghiêng Đầu Chọn Đáp Án
        </button>

        {/* Zone 2: Single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Điều hướng chính">
          {navItems.map((item) => {
            const active = currentRoute === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                  active
                    ? 'border-sky-600 text-sky-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary CTA */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onCreateNewGame}
            className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 active:scale-[0.99] rounded-lg transition-all whitespace-nowrap shrink-0 shadow-sm"
          >
            Tạo trò chơi mới
          </button>
        </div>
      </div>

      {/* Mobile secondary single-row nav */}
      <div className="md:hidden border-t border-slate-100 px-3 py-2 flex items-center justify-around gap-2 overflow-x-auto">
        {navItems.map((item) => {
          const active = currentRoute === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`text-xs font-medium whitespace-nowrap shrink-0 px-2.5 py-1.5 rounded-md transition-colors ${
                active ? 'bg-sky-50 text-sky-700' : 'text-slate-600'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
