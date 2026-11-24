export type GradeLevel = string; // e.g. '', 'Mầm non', 'Tiểu học', 'THCS', 'THPT', or custom

export type PlayMode = '' | 'practice' | 'challenge' | 'competition' | 'presentation';

export type QuestionType =
  | 'choice_2'
  | 'choice_3'
  | 'choice_4'
  | 'multi_select'
  | 'true_false'
  | 'image_choice'
  | 'audio_choice'
  | 'video_choice'
  | 'text_image';

export type MediaType = 'none' | 'image' | 'audio' | 'video';

export type HeadDirection = 'neutral' | 'left' | 'right' | 'up' | 'down';

export type CharacterId = 'owl' | 'panda' | 'robot';

export type SouthernVoiceId =
  | 'south_female_mai'
  | 'south_female_linh'
  | 'south_female_ngoc'
  | 'south_male_nam'
  | 'south_male_minh'
  | 'south_male_hung';

export interface AnswerOption {
  id: string;
  label: string; // 'A', 'B', 'C', 'D'
  text: string;
  imageUrl?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  mediaType: MediaType;
  mediaUrl?: string;
  mediaName?: string;
  options: AnswerOption[];
  correctOptionIds: string[];
  explanation?: string;
  timeLimit: number; // seconds, 0 means unlimited in practice
  points: number;
  order: number;
}

export interface EvaluationRule {
  id: string;
  minPercentage: number;
  label: string;
  feedback: string;
}

export interface GameConfig {
  id: string;
  title: string;
  lesson: string;
  gradeLevel: GradeLevel;
  gradeClass: string;
  subject: string;
  description: string;
  playMode: PlayMode;
  questionCountLimit: number | ''; // empty or 0 means play all questions
  defaultTimeLimit: number | ''; // seconds per question
  maxAttempts: number | ''; // number of turns/players
  showCorrectAnswerOnWrong: boolean;
  autoAdvance: boolean;
  autoAdvanceDelay: number; // seconds fallback when AI voice is off
  aiVoiceEnabled: boolean;
  aiVoiceId: SouthernVoiceId;
  aiVoiceSampleText?: string;
  aiCorrectSample?: string;
  aiWrongSample?: string;
  evaluationRules: EvaluationRule[];
  questions: Question[];
  createdAt: number;
  updatedAt: number;
}

export interface CalibrationSettings {
  rollCenter: number; // degrees
  pitchCenter: number; // normalized ratio
  sensitivity: number; // 1 to 10
  holdDurationMs: number; // milliseconds required to lock answer
  characterSpeed: number; // 1 to 10
  characterId: CharacterId;
  soundEnabled: boolean;
  aiVoiceEnabled: boolean;
  aiVoiceId: SouthernVoiceId;
}

export interface QuestionAnswerRecord {
  questionId: string;
  questionPrompt: string;
  selectedOptionIds: string[];
  selectedTexts: string[];
  correctOptionIds: string[];
  correctTexts: string[];
  isCorrect: boolean;
  isUnanswered: boolean;
  pointsEarned: number;
  timeSpentSeconds: number;
  explanation?: string;
}

export interface GameResult {
  id: string;
  gameId: string;
  gameTitle: string;
  lesson: string;
  subject: string;
  gradeLevel: string;
  gradeClass: string;
  playMode: Exclude<PlayMode, ''>;
  playerName: string;
  turnNumber: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  totalScore: number;
  maxPossibleScore: number;
  accuracyPercent: number;
  completionTimeSeconds: number;
  evaluationLabel: string;
  evaluationFeedback: string;
  records: QuestionAnswerRecord[];
  completedAt: number;
}

export type AppRoute = 'home' | 'editor' | 'calibration' | 'play' | 'results';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}
