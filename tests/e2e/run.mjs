import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'timeline-e2e-'));
let storiesDir = path.join(dataDir, 'stories');
let compendiumPath = path.join(dataDir, 'compendium.json');
await fs.mkdir(storiesDir, { recursive: true });
const story = {
  storyId: 'e2e-story', storyName: '验收故事',
  events: [
    { id: 'e1', title: '测试起点', date: '2030/03/10', time: '上午', location: '测试站', summary: '起点摘要', content: '起点正文', people: ['人物甲'], peopleData: {}, order: 1, branchId: null },
    { id: 'e2', title: '测试分歧', date: '2030/03/20', time: '下午', location: '测试站', summary: '分歧摘要', content: '分歧正文', people: ['人物甲'], peopleData: {}, order: 2, branchId: null },
    { id: 'e3', title: '测试支线结尾', date: '2030/05/01', time: '晚上', location: '测试站', summary: '支线摘要', content: '支线正文', people: ['人物乙'], peopleData: {}, order: 3, branchId: 'north' },
    { id: 'e4', title: '同日后续', date: '2030/05/01', time: '深夜', location: '测试站', summary: '同日第二事件', content: '第二段正文', people: ['人物甲'], peopleData: {}, order: 4, branchId: null },
  ],
  branches: [{ id: 'north', name: '北线', parentEventId: 'e2', themeColor: '#0891b2' }],
  mainCharacters: [{ name: '人物甲', notes: '验收人物', upperBust: 90, lowerBust: 82 }],
  semesters: [
    { id: 'act-one', name: '第一阶段', startDate: '2030/03/01', endDate: '2030/03/31' },
    { id: 'act-two', name: '第二阶段', startDate: '2030/04/01', endDate: '2030/05/31' },
  ],
  semesterGroups: [{ id: 'acts', name: '故事阶段', periods: ['act-one', 'act-two'] }], savedAt: new Date().toISOString(),
};
await fs.writeFile(path.join(storiesDir, 'e2e-story.json'), JSON.stringify(story, null, 2));
await fs.writeFile(compendiumPath, JSON.stringify([{ id: 'device', name: '测试联络器', category: '道具', details: '用于验证本机图鉴。' }]));

async function readArchive() {
  let files;
  try { files = await fs.readdir(storiesDir); } catch { throw new Error('Archive not found'); }
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const archive = JSON.parse(await fs.readFile(path.join(storiesDir, file), 'utf8'));
    if (archive.storyId === 'e2e-story') return archive;
  }
  throw new Error('Archive not found');
}

async function waitForArchive(predicate) {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const archive = await readArchive();
      if (predicate(archive)) return archive;
    } catch { /* destination directory may still be initializing */ }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Archive update timed out');
}

const portProbe = net.createServer();
await new Promise(resolve => portProbe.listen(0, '127.0.0.1', resolve));
const port = portProbe.address().port;
await new Promise(resolve => portProbe.close(resolve));
const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
  cwd: root,
  env: { ...process.env, TIMELINE_DATA_DIR: dataDir, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
server.stdout.on('data', chunk => { serverOutput += String(chunk); });
server.stderr.on('data', chunk => { serverOutput += String(chunk); });
const baseUrl = `http://127.0.0.1:${port}`;
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { ready = (await fetch(`${baseUrl}/api/health`)).ok; } catch { /* server starting */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(ready, `Local archive server did not start: ${serverOutput}`);
  browser = await chromium.launch({ executablePath: process.env.PROPULS_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.app-shell');
  assert(await page.locator('.sidebar').isVisible());
  await page.getByRole('button', { name: '收起侧边栏' }).click();
  assert(await page.locator('.app-shell').evaluate(element => element.classList.contains('sidebar-collapsed')));
  await page.getByRole('button', { name: '展开侧边栏' }).click();
  await page.getByRole('button', { name: '本机设置' }).click();
  await page.getByRole('dialog', { name: '本机设置' }).waitFor();
  assert(await page.getByRole('dialog', { name: '本机设置' }).isVisible());
  const movedDataDir = path.join(dataDir, 'archive-target');
  storiesDir = path.join(movedDataDir, 'stories');
  compendiumPath = path.join(movedDataDir, 'compendium.json');
  await page.getByLabel('默认存档文件夹').fill(movedDataDir);
  await page.getByRole('button', { name: '保存目录' }).click();
  await page.getByRole('button', { name: '时间线', exact: true }).waitFor();
  assert.equal((await waitForArchive(archive => archive.storyName === '验收故事')).storyName, '验收故事');
  assert.equal(await page.locator('.stage-toggle, .stage-focus').count(), 0);
  assert(await page.locator('.save-status').isVisible());
  assert.equal(await page.getByRole('button', { name: '导入 JSON' }).count(), 0);
  assert.equal(await page.getByRole('button', { name: '导出 JSON' }).count(), 0);
  assert.equal(await page.locator('.event-card').count(), 2);
  assert.equal(await page.locator('.stage-summary').count(), 1);
  const may = page.locator('.month-section').filter({ hasText: '2030年05月' });
  assert.equal(await may.locator('.month-header').getAttribute('aria-expanded'), 'true');
  assert.deepEqual(await may.locator('.event-title').allTextContents(), ['测试支线结尾', '同日后续']);
  assert((await may.locator('.event-card').filter({ hasText: '测试支线结尾' }).evaluate(element => parseFloat(getComputedStyle(element).marginLeft))) > 0);
  const eventCard = may.locator('.event-card').filter({ hasText: '测试支线结尾' });
  await eventCard.getByRole('button', { name: '展开 测试支线结尾 详情' }).click();
  assert(await eventCard.locator('.event-detail').isVisible());
  assert.equal(await eventCard.locator('.event-date').evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)');
  const detailLayers = await eventCard.evaluate(element => ({ detailLeft: parseFloat(getComputedStyle(element.querySelector('.event-detail')).left), axisLeft: parseFloat(getComputedStyle(element, '::before').left) }));
  assert(detailLayers.detailLeft > detailLayers.axisLeft);
  await eventCard.getByRole('button', { name: '收起 测试支线结尾 详情' }).click();
  await page.getByRole('button', { name: '阶段设置' }).click();
  await page.getByRole('button', { name: '添加阶段' }).click();
  const newStage = page.locator('.stage-editor-row').last().locator('input');
  await newStage.nth(0).fill('第三阶段');
  await newStage.nth(1).fill('2030/06/01');
  await newStage.nth(2).fill('2030/06/30');
  await page.getByRole('button', { name: '保存阶段' }).click();
  assert.equal((await waitForArchive(archive => archive.semesters.length === 3)).semesters.length, 3);

  await page.locator('.stage-summary').filter({ hasText: '第一阶段' }).getByRole('button', { name: '展开阶段' }).click();
  assert.equal(await page.locator('.stage-summary').count(), 2);
  assert.deepEqual(await page.locator('.stage-heading-title').allTextContents(), ['第一阶段']);
  assert.equal(await page.getByRole('button', { name: '收起阶段 第一阶段' }).count(), 1);
  assert.equal(await page.locator('.timeline > .stage-section').first().locator('.stage-heading-title').textContent(), '第一阶段');
  const march = page.locator('.month-section').filter({ hasText: '2030年03月' });
  assert.equal(await march.locator('.month-header').getAttribute('aria-expanded'), 'true');
  assert.equal(await march.locator('.event-card').count(), 2);

  await page.getByRole('button', { name: '新建事件' }).click();
  await page.locator('#event-title').fill('新增分支事件');
  await page.locator('#event-date').fill('2030/05/02');
  await page.locator('#event-time').selectOption('凌晨');
  await page.locator('#event-branch').selectOption('__create_branch__');
  await page.locator('#branch-name').fill('南线');
  await page.locator('#branch-parent').selectOption('e2');
  await page.locator('#event-summary').fill('由浏览器验收创建');
  await page.locator('#event-people').fill('人物甲');
  await page.locator('.profile-disclosure').first().locator('summary').click();
  assert.equal(await page.locator('.profile-disclosure').first().locator('output').textContent(), 'C');
  assert.equal(await page.locator('.profile-disclosure').first().locator('input[aria-label*="罩杯"]').count(), 0);
  await page.locator('.body-data-form input:not([type="checkbox"])').first().evaluate(element => { const input = element; input.value = '测试内衣'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  const npcToggle = page.locator('.profile-disclosure').first().getByRole('checkbox');
  await npcToggle.check();
  assert.equal(await page.locator('.profile-disclosure').first().locator('input:not([type="checkbox"])').first().isDisabled(), true);
  await npcToggle.uncheck();
  await page.getByRole('button', { name: '保存事件' }).click();
  await page.locator('.stage-summary').filter({ hasText: '第二阶段' }).getByRole('button', { name: '展开阶段' }).click();
  await page.getByRole('heading', { name: '新增分支事件' }).waitFor();
  const saved = await waitForArchive(archive => archive.events.length === 5);
  assert.equal(saved.events.length, 5);
  assert.equal(saved.branches.length, 2);
  const newBranch = saved.branches.find(branch => branch.name === '南线');
  assert.equal(newBranch.parentEventId, 'e2');
  assert.equal(saved.events.find(event => event.title === '新增分支事件').branchId, newBranch.id);
  assert.equal(saved.events.find(event => event.title === '新增分支事件').peopleData['人物甲'].underwear, '测试内衣');

  await page.getByRole('button', { name: '时间流', exact: true }).click();
  assert(await page.locator('.flow-board').isVisible());
  assert(await page.locator('.flow-line').count() >= 2);
  assert.equal(await page.locator('.flow-stage-chip[aria-expanded="true"]').count(), 1);
  await page.locator('.flow-stage-chip').filter({ hasText: '第一阶段' }).click();
  assert.equal(await page.locator('.flow-stage-chip').filter({ hasText: '第一阶段' }).getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('.flow-stage-chip').filter({ hasText: '第二阶段' }).getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('.flow-date').filter({ hasText: '2030年03月' }).count() > 0, true);
  assert.equal(await page.locator('.flow-date').filter({ hasText: '2030年05月' }).count(), 0);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '删除线路 北线' }).click();
  await waitForArchive(archive => archive.branches.length === 1 && archive.branches[0].name === '南线');
  await page.getByRole('button', { name: '人物基础数据档案', exact: true }).click();
  assert(await page.locator('.body-table').isVisible());
  await page.getByLabel('身高').first().fill('175');
  await page.getByLabel('上胸围').first().fill('85');
  await page.getByLabel('下胸围').first().fill('78');
  await page.getByRole('button', { name: '时间线', exact: true }).click();
  const savedBaseData = await waitForArchive(archive => archive.mainCharacters?.[0]?.height === 175 && archive.mainCharacters?.[0]?.upperBust === 85 && archive.mainCharacters?.[0]?.lowerBust === 78);
  assert.equal(savedBaseData.mainCharacters[0].upperBust, 85);
  assert.equal(savedBaseData.mainCharacters[0].lowerBust, 78);
  await page.getByRole('button', { name: '人物基础数据档案', exact: true }).click();
  assert.equal(await page.locator('.body-table tbody tr').first().locator('output').textContent(), 'C');
  await page.getByRole('button', { name: '图鉴', exact: true }).click();
  assert(await page.locator('.compendium-card').filter({ hasText: '测试联络器' }).isVisible());
  await page.locator('.compendium-card').filter({ hasText: '测试联络器' }).getByRole('button', { name: '编辑图鉴 测试联络器' }).click();
  await page.locator('#compendium-details').fill('已修改图鉴内容');
  await page.getByRole('button', { name: '保存条目' }).click();
  let compendiumArchive;
  for (let attempt = 0; attempt < 40; attempt++) {
    compendiumArchive = JSON.parse(await fs.readFile(compendiumPath, 'utf8'));
    if (compendiumArchive[0]?.details === '已修改图鉴内容') break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(compendiumArchive[0].details, '已修改图鉴内容');

  await page.getByRole('button', { name: '时间线', exact: true }).click();
  const markdown = '### 2030/05/03 下午 - Markdown 导入事件\n**线路**: 分支:南线\n**地点**: 港口\n**人物**: 人物乙\n\n> Markdown 摘要\n\nMarkdown 正文\n\n#### 人物档案\n\n##### 人物乙\n- **内衣款式**: 导入内衣\n- **罩杯**: B\n- **胸围**: 88cm';
  await page.locator('input[type=file][accept*="markdown"]').setInputFiles({ name: 'import.md', mimeType: 'text/markdown', buffer: Buffer.from(markdown) });
  const imported = await waitForArchive(archive => archive.events.some(event => event.title === 'Markdown 导入事件' && event.branchId === newBranch.id));
  assert(imported.events.some(event => event.title === 'Markdown 导入事件' && event.branchId === newBranch.id));
  const importedMarkdownEvent = imported.events.find(event => event.title === 'Markdown 导入事件');
  assert.equal(importedMarkdownEvent.peopleData['人物乙'].underwear, '导入内衣');
  assert.equal(importedMarkdownEvent.peopleData['人物乙'].cup, 'B');
  await page.keyboard.press('Control+S');
  await waitForArchive(archive => archive.savedAt);
  assert((await fs.readdir(storiesDir)).some(file => file.startsWith('验收故事_') && file.endsWith('.json')));

  const profileEventDownloadPromise = page.waitForEvent('download');
  await page.locator('.event-card').filter({ hasText: '新增分支事件' }).getByRole('button', { name: '导出 新增分支事件' }).click();
  const profileEventDownload = await profileEventDownloadPromise;
  const profileEventMarkdown = await fs.readFile(await profileEventDownload.path(), 'utf8');
  assert(profileEventMarkdown.includes('#### 人物档案'));
  assert(profileEventMarkdown.includes('测试内衣'));
  const [storyMarkdownDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '导出 Markdown', exact: true }).click(),
  ]);
  const storyMarkdown = await fs.readFile(await storyMarkdownDownload.path(), 'utf8');
  assert(storyMarkdown.includes('人物甲'));
  assert(storyMarkdown.includes('测试内衣'));

  await page.locator('.stage-summary').filter({ hasText: '第一阶段' }).getByRole('button', { name: '展开阶段' }).click();
  const eventDownloadPromise = page.waitForEvent('download');
  await page.locator('.event-card').filter({ hasText: '测试起点' }).getByRole('button', { name: '导出 测试起点' }).click();
  const eventDownload = await eventDownloadPromise;
  assert(eventDownload.suggestedFilename().endsWith('.md'));

  page.once('dialog', dialog => dialog.accept('改名验收故事'));
  const originalStoryRow = page.locator('.story-row').filter({ hasText: '验收故事' });
  await originalStoryRow.hover();
  await originalStoryRow.getByRole('button', { name: '重命名 验收故事' }).click();
  await page.getByRole('heading', { name: '改名验收故事' }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert(await page.locator('.app-shell').isVisible());
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: path.join(dataDir, 'mobile.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS archive API, month/stage folding, ordered same-day events, event overlays, story/event/stage CRUD, timeline flow, body data, compendium editing, Markdown, single-event export and mobile layout');
} finally {
  await browser?.close();
  server.kill();
  await new Promise(resolve => server.once('exit', resolve));
  await fs.rm(dataDir, { recursive: true, force: true });
}
