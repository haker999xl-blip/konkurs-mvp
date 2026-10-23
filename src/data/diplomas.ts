import { escapeHtml } from '../data/utils';

export interface DiplomaData {
  studentName: string;
  grade: string;
  competitionTitle: string;
  score: number;
  maxScore: number;
  date: string;
}

/** SVG-шаблон диплома: «Классика» — строгий, с рамкой и печатью. */
function classicTemplate(data: DiplomaData): string {
  const percent = Math.round((data.score / Math.max(1, data.maxScore)) * 100);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 720" width="1000" height="720" role="img" aria-label="Диплом ${escapeHtml(data.studentName)}">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FBF7EF"/>
      <stop offset="1" stop-color="#F3EAD8"/>
    </linearGradient>
  </defs>
  <rect width="1000" height="720" fill="url(#paper)"/>
  <rect x="26" y="26" width="948" height="668" fill="none" stroke="#1E3440" stroke-width="2"/>
  <rect x="38" y="38" width="924" height="644" fill="none" stroke="#C08A4E" stroke-width="1"/>
  <path d="M38 38 H200 M38 38 V200 M962 38 H800 M962 38 V200 M38 682 H200 M38 682 V520 M962 682 H800 M962 682 V520" stroke="#C08A4E" stroke-width="3" fill="none"/>

  <text x="500" y="118" text-anchor="middle" font-family="Georgia, serif" font-size="17" letter-spacing="7" fill="#8A6D4A">ШКОЛЬНЫЙ КОНКУРСНЫЙ ДОМ</text>
  <text x="500" y="196" text-anchor="middle" font-family="Georgia, serif" font-size="58" letter-spacing="10" fill="#1E3440">ДИПЛОМ</text>
  <text x="500" y="232" text-anchor="middle" font-family="Georgia, serif" font-size="16" letter-spacing="6" fill="#8A6D4A">ЗА УЧАСТИЕ И РЕЗУЛЬТАТ</text>
  <line x1="360" y1="258" x2="640" y2="258" stroke="#C08A4E" stroke-width="1"/>

  <text x="500" y="332" text-anchor="middle" font-family="Georgia, serif" font-size="20" fill="#6B5A45">награждается</text>
  <text x="500" y="404" text-anchor="middle" font-family="Georgia, serif" font-size="46" fill="#1E3440">${escapeHtml(data.studentName)}</text>
  <text x="500" y="440" text-anchor="middle" font-family="Verdana, sans-serif" font-size="16" fill="#6B5A45">${escapeHtml(data.grade)} класс</text>

  <text x="500" y="504" text-anchor="middle" font-family="Verdana, sans-serif" font-size="18" fill="#3D4F58">участник конкурса</text>
  <text x="500" y="544" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#1E3440">«${escapeHtml(data.competitionTitle)}»</text>
  <text x="500" y="588" text-anchor="middle" font-family="Verdana, sans-serif" font-size="17" fill="#3D4F58">результат ${data.score} из ${data.maxScore} — ${percent}%  ·  ${escapeHtml(data.date)}</text>

  <circle cx="846" cy="612" r="52" fill="none" stroke="#B04A3A" stroke-width="2.5" opacity="0.85"/>
  <circle cx="846" cy="612" r="40" fill="none" stroke="#B04A3A" stroke-width="1" opacity="0.7"/>
  <text x="846" y="606" text-anchor="middle" font-family="Verdana, sans-serif" font-size="10" fill="#B04A3A" letter-spacing="1">ШКОЛЬНЫЕ</text>
  <text x="846" y="620" text-anchor="middle" font-family="Verdana, sans-serif" font-size="10" fill="#B04A3A" letter-spacing="1">КОНКУРСЫ</text>
  <text x="160" y="628" font-family="Georgia, serif" font-size="15" fill="#6B5A45">Председатель жюри</text>
  <line x1="160" y1="640" x2="340" y2="640" stroke="#8A6D4A" stroke-width="1"/>
</svg>`;
}

/** SVG-шаблон диплома: «Современный» — тёмный, контрастный, с крупным акцентом. */
function modernTemplate(data: DiplomaData): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 720" width="1000" height="720" role="img" aria-label="Диплом ${escapeHtml(data.studentName)}">
  <rect width="1000" height="720" fill="#1E3440"/>
  <rect x="0" y="0" width="1000" height="10" fill="#E0A96D"/>
  <rect x="700" y="10" width="300" height="710" fill="#223D4B"/>
  <text x="80" y="110" font-family="Verdana, sans-serif" font-size="15" letter-spacing="8" fill="#E0A96D">ШКОЛЬНЫЕ КОНКУРСЫ · ДИПЛОМ</text>
  <text x="80" y="220" font-family="Verdana, sans-serif" font-size="64" font-weight="700" fill="#F4EFE6">ПОДТВЕРЖДАЕМ</text>
  <text x="80" y="290" font-family="Verdana, sans-serif" font-size="20" fill="#A9BEC7">участие и результат</text>
  <rect x="80" y="330" width="64" height="3" fill="#E0A96D"/>

  <text x="80" y="410" font-family="Verdana, sans-serif" font-size="44" font-weight="700" fill="#FFFFFF">${escapeHtml(data.studentName)}</text>
  <text x="80" y="446" font-family="Verdana, sans-serif" font-size="16" fill="#A9BEC7">${escapeHtml(data.grade)} класс</text>

  <text x="80" y="520" font-family="Verdana, sans-serif" font-size="16" fill="#A9BEC7">конкурс</text>
  <text x="80" y="556" font-family="Georgia, serif" font-size="26" fill="#F4EFE6">«${escapeHtml(data.competitionTitle)}»</text>

  <text x="760" y="180" font-family="Verdana, sans-serif" font-size="16" fill="#A9BEC7">БАЛЛЫ</text>
  <text x="760" y="270" font-family="Verdana, sans-serif" font-size="72" font-weight="700" fill="#E0A96D">${data.score}</text>
  <text x="760" y="306" font-family="Verdana, sans-serif" font-size="18" fill="#A9BEC7">из ${data.maxScore}</text>
  <line x1="760" y1="350" x2="940" y2="350" stroke="#3D5A68" stroke-width="1"/>
  <text x="760" y="400" font-family="Verdana, sans-serif" font-size="16" fill="#A9BEC7">ДАТА</text>
  <text x="760" y="436" font-family="Verdana, sans-serif" font-size="20" fill="#F4EFE6">${escapeHtml(data.date)}</text>

  <text x="80" y="640" font-family="Verdana, sans-serif" font-size="13" fill="#7E97A2">Выдан автоматически платформой школьных конкурсов · 2026</text>
</svg>`;
}

export type DiplomaVariant = 'classic' | 'modern';

export const DIPLOMA_TEMPLATES: { id: DiplomaVariant; name: string; note: string }[] = [
  { id: 'classic', name: 'Классика', note: 'Тёплая бумага, рамка, печать' },
  { id: 'modern', name: 'Контраст', note: 'Тёмный фон, крупный акцент' },
];

/** Скачивание диплома выбранным шаблоном. */
export function downloadDiploma(data: DiplomaData, variant: DiplomaVariant): void {
  const svg = variant === 'classic' ? classicTemplate(data) : modernTemplate(data);
  const name = `diplom-${data.studentName.toLowerCase().replace(/\s+/g, '-')}.svg`;
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Предпросмотр диплома как data-url для <img>. */
export function diplomaPreviewUrl(data: DiplomaData, variant: DiplomaVariant): string {
  const svg = variant === 'classic' ? classicTemplate(data) : modernTemplate(data);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
