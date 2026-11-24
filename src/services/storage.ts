import { CalibrationSettings, GameConfig, GameResult } from '../types/game';

const DB_NAME = 'TroChoiNghiengDauDB';
const DB_VERSION = 1;
const STORE_GAMES = 'games';
const STORE_RESULTS = 'results';
const STORE_SETTINGS = 'settings';

export const DEFAULT_CALIBRATION_SETTINGS: CalibrationSettings = {
  rollCenter: 0,
  pitchCenter: 0,
  sensitivity: 5,
  holdDurationMs: 1200,
  characterSpeed: 6,
  characterId: 'owl',
  soundEnabled: true,
  aiVoiceEnabled: true,
  aiVoiceId: 'south_female_mai',
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Trình duyệt không hỗ trợ IndexedDB.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_GAMES)) {
        const gameStore = db.createObjectStore(STORE_GAMES, { keyPath: 'id' });
        gameStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_RESULTS)) {
        const resultStore = db.createObjectStore(STORE_RESULTS, { keyPath: 'id' });
        resultStore.createIndex('gameId', 'gameId', { unique: false });
        resultStore.createIndex('completedAt', 'completedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Không thể mở cơ sở dữ liệu cục bộ.'));
  });
}

export async function getAllGames(): Promise<GameConfig[]> {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_GAMES, 'readonly');
      const store = tx.objectStore(STORE_GAMES);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as GameConfig[]) || [];
        items.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Lỗi đọc danh sách trò chơi:', err);
    const fallback = localStorage.getItem('tnd_games_fallback');
    return fallback ? (JSON.parse(fallback) as GameConfig[]) : [];
  }
}

export async function saveGame(game: GameConfig): Promise<void> {
  const payload: GameConfig = {
    ...game,
    updatedAt: Date.now(),
  };

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_GAMES, 'readwrite');
      const store = tx.objectStore(STORE_GAMES);
      const req = store.put(payload);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Lỗi lưu trò chơi vào IndexedDB:', err);
    const existing = await getAllGames();
    const filtered = existing.filter((g) => g.id !== payload.id);
    localStorage.setItem('tnd_games_fallback', JSON.stringify([payload, ...filtered]));
  }
}

export async function deleteGameById(gameId: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_GAMES, 'readwrite');
      const store = tx.objectStore(STORE_GAMES);
      const req = store.delete(gameId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Lỗi xóa trò chơi:', err);
    const existing = await getAllGames();
    localStorage.setItem(
      'tnd_games_fallback',
      JSON.stringify(existing.filter((g) => g.id !== gameId))
    );
  }
}

export async function getAllResults(): Promise<GameResult[]> {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_RESULTS, 'readonly');
      const store = tx.objectStore(STORE_RESULTS);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as GameResult[]) || [];
        items.sort((a, b) => b.completedAt - a.completedAt);
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Lỗi đọc kết quả:', err);
    const fallback = localStorage.getItem('tnd_results_fallback');
    return fallback ? (JSON.parse(fallback) as GameResult[]) : [];
  }
}

export async function saveGameResult(result: GameResult): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_RESULTS, 'readwrite');
      const store = tx.objectStore(STORE_RESULTS);
      const req = store.put(result);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Lỗi lưu kết quả:', err);
    const existing = await getAllResults();
    localStorage.setItem('tnd_results_fallback', JSON.stringify([result, ...existing]));
  }
}

export async function deleteResultById(resultId: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_RESULTS, 'readwrite');
      const store = tx.objectStore(STORE_RESULTS);
      const req = store.delete(resultId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Lỗi xóa kết quả:', err);
  }
}

export async function clearAllResults(): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_RESULTS, 'readwrite');
      const store = tx.objectStore(STORE_RESULTS);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Lỗi xóa lịch sử kết quả:', err);
  }
}

export async function getCalibrationSettings(): Promise<CalibrationSettings> {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readonly');
      const store = tx.objectStore(STORE_SETTINGS);
      const req = store.get('calibration');
      req.onsuccess = () => {
        if (req.result) {
          const { id: _id, ...rest } = req.result as CalibrationSettings & { id: string };
          resolve({ ...DEFAULT_CALIBRATION_SETTINGS, ...rest });
        } else {
          resolve(DEFAULT_CALIBRATION_SETTINGS);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return DEFAULT_CALIBRATION_SETTINGS;
  }
}

export async function saveCalibrationSettings(settings: CalibrationSettings): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readwrite');
      const store = tx.objectStore(STORE_SETTINGS);
      const req = store.put({ id: 'calibration', ...settings });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Lỗi lưu cài đặt hiệu chỉnh:', err);
  }
}
