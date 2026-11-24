import * as XLSX from 'xlsx';
import { AnswerOption, GameConfig, GameResult, Question, QuestionType } from '../types/game';

const TEMPLATE_HEADERS = [
  'Loai_Cau_Hoi',
  'Noi_Dung_Cau_Hoi',
  'Dap_An_A',
  'Dap_An_B',
  'Dap_An_C',
  'Dap_An_D',
  'Dap_An_Dung',
  'Giai_Thich',
  'Thoi_Gian_Giay',
  'Diem_So',
  'Loai_Tu_Lieu',
  'Lien_Ket_Tu_Lieu',
];

const QUESTION_TYPE_MAP: Record<string, QuestionType> = {
  choice_2: 'choice_2',
  '2_dap_an': 'choice_2',
  choice_3: 'choice_3',
  '3_dap_an': 'choice_3',
  choice_4: 'choice_4',
  '4_dap_an': 'choice_4',
  multi_select: 'multi_select',
  nhieu_dap_an: 'multi_select',
  true_false: 'true_false',
  dung_sai: 'true_false',
  image_choice: 'image_choice',
  hinh_anh: 'image_choice',
  audio_choice: 'audio_choice',
  am_thanh: 'audio_choice',
  video_choice: 'video_choice',
  video: 'video_choice',
  text_image: 'text_image',
  van_ban_hinh_anh: 'text_image',
};

export function downloadQuestionTemplate(format: 'xlsx' | 'csv'): void {
  if (format === 'csv') {
    const csvContent = '\uFEFF' + TEMPLATE_HEADERS.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, 'mau_bo_cau_hoi.csv');
    return;
  }

  const wb = XLSX.utils.book_new();
  const wsQuestions = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
  wsQuestions['!cols'] = [
    { wch: 18 },
    { wch: 42 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 16 },
    { wch: 32 },
    { wch: 16 },
    { wch: 12 },
    { wch: 16 },
    { wch: 32 },
  ];

  const guideRows = [
    ['Cột', 'Ý nghĩa', 'Giá trị hợp lệ'],
    [
      'Loai_Cau_Hoi',
      'Dạng câu hỏi',
      'choice_2, choice_3, choice_4, multi_select, true_false, image_choice, audio_choice, video_choice, text_image',
    ],
    ['Noi_Dung_Cau_Hoi', 'Nội dung câu hỏi (bắt buộc)', 'Văn bản câu hỏi'],
    ['Dap_An_A', 'Nội dung đáp án A (bắt buộc)', 'Văn bản'],
    ['Dap_An_B', 'Nội dung đáp án B (bắt buộc)', 'Văn bản'],
    ['Dap_An_C', 'Nội dung đáp án C (nếu có 3-4 đáp án)', 'Văn bản hoặc để trống'],
    ['Dap_An_D', 'Nội dung đáp án D (nếu có 4 đáp án)', 'Văn bản hoặc để trống'],
    ['Dap_An_Dung', 'Chữ cái đáp án đúng (cách nhau dấu phẩy nếu nhiều đáp án)', 'A hoặc B hoặc A,C'],
    ['Giai_Thich', 'Lời giải thích sau khi trả lời (không bắt buộc)', 'Văn bản hoặc để trống'],
    ['Thoi_Gian_Giay', 'Thời gian trả lời tính bằng giây', 'Số nguyên dương, VD: 20'],
    ['Diem_So', 'Điểm cho câu hỏi', 'Số nguyên dương, VD: 10'],
    ['Loai_Tu_Lieu', 'Loại tư liệu đính kèm', 'none, image, audio, video'],
    ['Lien_Ket_Tu_Lieu', 'Đường dẫn ảnh/âm thanh/video (nếu có)', 'URL hợp lệ hoặc để trống'],
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 22 }, { wch: 46 }, { wch: 68 }];

  XLSX.utils.book_append_sheet(wb, wsQuestions, 'Cau_Hoi');
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Huong_Dan_Nhap');
  XLSX.writeFile(wb, 'mau_bo_cau_hoi.xlsx');
}

export async function parseQuestionsFromFile(file: File, defaultTime = 20): Promise<Question[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Tệp không có trang tính hợp lệ.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  if (rows.length === 0) {
    throw new Error('Tệp chưa có dòng câu hỏi nào. Vui lòng điền câu hỏi theo cấu trúc cột mẫu.');
  }

  const questions: Question[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const lineNum = index + 2;
    const prompt = String(row['Noi_Dung_Cau_Hoi'] ?? row['Cau_Hoi'] ?? '').trim();
    if (!prompt) {
      errors.push(`Dòng ${lineNum}: Thiếu nội dung câu hỏi.`);
      return;
    }

    const rawType = String(row['Loai_Cau_Hoi'] ?? 'choice_2').trim().toLowerCase();
    const qType: QuestionType = QUESTION_TYPE_MAP[rawType] ?? 'choice_4';

    const optValues = [
      { label: 'A', text: String(row['Dap_An_A'] ?? '').trim() },
      { label: 'B', text: String(row['Dap_An_B'] ?? '').trim() },
      { label: 'C', text: String(row['Dap_An_C'] ?? '').trim() },
      { label: 'D', text: String(row['Dap_An_D'] ?? '').trim() },
    ].filter((o) => o.text.length > 0);

    if (optValues.length < 2) {
      errors.push(`Dòng ${lineNum}: Cần ít nhất 2 đáp án (A và B).`);
      return;
    }

    const options: AnswerOption[] = optValues.map((o) => ({
      id: crypto.randomUUID(),
      label: o.label,
      text: o.text,
    }));

    const rawCorrect = String(row['Dap_An_Dung'] ?? '')
      .toUpperCase()
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const correctOptionIds = options
      .filter((o) => rawCorrect.includes(o.label))
      .map((o) => o.id);

    if (correctOptionIds.length === 0) {
      errors.push(`Dòng ${lineNum}: Chưa xác định đáp án đúng hợp lệ (A, B, C hoặc D).`);
      return;
    }

    const timeLimit = Number(row['Thoi_Gian_Giay']) || defaultTime || 20;
    const points = Number(row['Diem_So']) || 10;
    const explanation = String(row['Giai_Thich'] ?? '').trim();
    const rawMediaType = String(row['Loai_Tu_Lieu'] ?? 'none').trim().toLowerCase();
    const mediaUrl = String(row['Lien_Ket_Tu_Lieu'] ?? '').trim();

    let mediaType: Question['mediaType'] = 'none';
    if (rawMediaType === 'image' || rawMediaType === 'audio' || rawMediaType === 'video') {
      mediaType = rawMediaType;
    } else if (mediaUrl) {
      mediaType = 'image';
    }

    let resolvedType = qType;
    if (!QUESTION_TYPE_MAP[rawType]) {
      if (options.length === 2) resolvedType = 'choice_2';
      else if (options.length === 3) resolvedType = 'choice_3';
      else resolvedType = 'choice_4';
    }
    if (correctOptionIds.length > 1) {
      resolvedType = 'multi_select';
    }

    questions.push({
      id: crypto.randomUUID(),
      type: resolvedType,
      prompt,
      mediaType: mediaUrl ? mediaType : 'none',
      mediaUrl: mediaUrl || undefined,
      options,
      correctOptionIds,
      explanation: explanation || undefined,
      timeLimit: Math.max(0, timeLimit),
      points: Math.max(1, points),
      order: questions.length,
    });
  });

  if (errors.length > 0 && questions.length === 0) {
    throw new Error(errors.slice(0, 3).join(' '));
  }

  return questions;
}

export function exportQuestionsToSpreadsheet(
  questions: Question[],
  fileNameBase: string,
  format: 'xlsx' | 'csv'
): void {
  const rows = questions.map((q) => {
    const byLabel = (lbl: string) => q.options.find((o) => o.label === lbl)?.text ?? '';
    const correctLabels = q.options
      .filter((o) => q.correctOptionIds.includes(o.id))
      .map((o) => o.label)
      .join(',');

    return {
      Loai_Cau_Hoi: q.type,
      Noi_Dung_Cau_Hoi: q.prompt,
      Dap_An_A: byLabel('A'),
      Dap_An_B: byLabel('B'),
      Dap_An_C: byLabel('C'),
      Dap_An_D: byLabel('D'),
      Dap_An_Dung: correctLabels,
      Giai_Thich: q.explanation ?? '',
      Thoi_Gian_Giay: q.timeLimit,
      Diem_So: q.points,
      Loai_Tu_Lieu: q.mediaType,
      Lien_Ket_Tu_Lieu: q.mediaUrl && !q.mediaUrl.startsWith('data:') ? q.mediaUrl : '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows, { header: TEMPLATE_HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cau_Hoi');

  const safeName = sanitizeFilename(fileNameBase || 'bo_cau_hoi');
  if (format === 'csv') {
    const csv = '\uFEFF' + XLSX.utils.sheet_to_csv(ws);
    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${safeName}.csv`);
  } else {
    XLSX.writeFile(wb, `${safeName}.xlsx`);
  }
}

export function exportResultsToSpreadsheet(
  results: GameResult[],
  fileNameBase: string,
  format: 'xlsx' | 'csv'
): void {
  const rows = results.map((r, idx) => ({
    STT: idx + 1,
    Hoc_Sinh: r.playerName,
    Tro_Choi: r.gameTitle,
    Bai_Hoc: r.lesson,
    Mon_Hoc: r.subject,
    Cap_Hoc: r.gradeLevel,
    Lop_Hoc: r.gradeClass,
    Tong_Cau_Hoi: r.totalQuestions,
    So_Cau_Dung: r.correctCount,
    So_Cau_Sai: r.wrongCount,
    Chua_Tra_Loi: r.unansweredCount,
    Tong_Diem: r.totalScore,
    Ty_Le_Dung_Phan_Tram: r.accuracyPercent,
    Thoi_Gian_Hoan_Thanh_Giay: r.completionTimeSeconds,
    Xep_Loai: r.evaluationLabel,
    Nhan_Xet: r.evaluationFeedback,
    Ngay_Gio: new Date(r.completedAt).toLocaleString('vi-VN'),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ket_Qua');

  const safeName = sanitizeFilename(fileNameBase || 'ket_qua_tro_choi');
  if (format === 'csv') {
    const csv = '\uFEFF' + XLSX.utils.sheet_to_csv(ws);
    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${safeName}.csv`);
  } else {
    XLSX.writeFile(wb, `${safeName}.xlsx`);
  }
}

export function exportGameAsJson(game: GameConfig): void {
  const json = JSON.stringify(game, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  triggerDownload(blob, `${sanitizeFilename(game.title || 'tro_choi')}.json`);
}

export async function parseGameFromJson(file: File): Promise<GameConfig> {
  const text = await file.text();
  const parsed = JSON.parse(text) as Partial<GameConfig>;
  if (!parsed || typeof parsed.title !== 'string' || !Array.isArray(parsed.questions)) {
    throw new Error('Tệp JSON không đúng định dạng bộ trò chơi của ứng dụng.');
  }
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: parsed.title,
    lesson: parsed.lesson ?? '',
    gradeLevel: parsed.gradeLevel ?? '',
    gradeClass: parsed.gradeClass ?? '',
    subject: parsed.subject ?? '',
    description: parsed.description ?? '',
    playMode: parsed.playMode ?? 'challenge',
    questionCountLimit: parsed.questionCountLimit ?? '',
    defaultTimeLimit: parsed.defaultTimeLimit ?? 20,
    maxAttempts: parsed.maxAttempts ?? 1,
    showCorrectAnswerOnWrong: parsed.showCorrectAnswerOnWrong ?? true,
    autoAdvance: parsed.autoAdvance ?? true,
    autoAdvanceDelay: parsed.autoAdvanceDelay ?? 3,
    aiVoiceEnabled: parsed.aiVoiceEnabled ?? true,
    aiVoiceId: parsed.aiVoiceId ?? 'south_female_mai',
    evaluationRules: Array.isArray(parsed.evaluationRules) ? parsed.evaluationRules : [],
    questions: parsed.questions.map((q, idx) => ({
      ...q,
      id: crypto.randomUUID(),
      order: idx,
      options: q.options.map((o) => ({ ...o })),
    })),
    createdAt: now,
    updatedAt: now,
  };
}

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
