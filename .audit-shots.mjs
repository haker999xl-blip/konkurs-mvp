// Снимает скриншоты всех экранов для визуального аудита.
// Запуск: node .audit-shots.mjs [baseUrl]
import { chromium } from 'file:///C:/Users/%D0%91%D1%83%D0%BB%D0%B0%D1%82/.config/opencode/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:5173';
const OUT = 'audit/shots';
mkdirSync(OUT, { recursive: true });

// Берём уже установленный Chromium из кеша Playwright: версия пакета
// не совпадает с тем, что в ms-playwright, поэтому путь задаём явно.
const CHROME = process.env.LOCALAPPDATA + '/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const shot = async (name, full = true) => {
  await page.waitForTimeout(420);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log('shot', name);
};

const loginAs = async (nameRe) => {
  await page.goto(`${BASE}/login`);
  await page.getByRole('tab', { name: /Быстрый вход/ }).click();
  await page.getByRole('radio', { name: nameRe }).check({ force: true });
  await page.getByRole('button', { name: 'Войти' }).click();
  await page.waitForURL(/\/(cabinet|admin)/, { timeout: 15000 });
};

// --- Вход: три состояния ---
await page.goto(`${BASE}/login`);
await shot('01-login-quick-1440');
await page.getByRole('tab', { name: /Вход по паролю/ }).click();
await shot('02-login-password-1440');
await page.getByRole('button', { name: 'Регистрация', exact: true }).click();
await shot('03-login-register-1440');

// --- Ученик ---
await loginAs(/Мария Соколова/);
await shot('04-cabinet-1440');
await page.goto(`${BASE}/rating`);
await shot('05-rating-liceum-1440');
await page.getByRole('tab', { name: /По классам/ }).click();
await shot('06-rating-classes-1440');
await page.goto(`${BASE}/`);
await shot('07-poster-1440');
await page.locator('.card__link').first().click();
await shot('08-competition-1440');

// --- Организатор ---
await ctx.clearCookies();
await loginAs(/Анна Николаевна/);
await shot('09-admin-1440');

// --- Организатор: модалка сброса ---
const resetBtn = page.getByRole('button', { name: /Сбросить демо/ });
if (await resetBtn.count()) {
  await resetBtn.click();
  await shot('10-admin-reset-modal-1440', false);
  await page.getByRole('button', { name: 'Отмена' }).click();
}

// --- Адаптив: 1024 / 768 / 390 ---
for (const w of [1024, 768, 390]) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
  for (const [path, tag] of [['/', 'poster'], ['/rating', 'rating'], ['/cabinet', 'cabinet'], ['/admin', 'admin']]) {
    await page.goto(BASE + path);
    await shot(`1x-${tag}-${w}`);
  }
}

await browser.close();
console.log('done');
