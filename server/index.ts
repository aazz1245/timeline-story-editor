import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEmptyStory, normalizeStory } from '../src/shared/domain/normalize';
import type { CompendiumItem, StoryArchive, StorySummary } from '../src/shared/types';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const settingsPath = path.join(root, '.timeline-settings.json');
const defaultDataRoot = path.resolve(path.join(root, 'data'));
let dataRoot = path.resolve(process.env.TIMELINE_DATA_DIR || defaultDataRoot);
let storiesRoot = path.join(dataRoot, 'stories');
let compendiumPath = path.join(dataRoot, 'compendium.json');
const port = Number(process.env.PORT || 4174);

if (!process.env.TIMELINE_DATA_DIR) {
  try {
    const configured = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
    if (typeof configured?.dataDirectory === 'string' && path.isAbsolute(configured.dataDirectory)) {
      const configuredRoot = path.resolve(configured.dataDirectory);
      try {
        const stats = await fs.stat(configuredRoot);
        if (stats.isDirectory()) dataRoot = configuredRoot;
      } catch { /* stale local settings fall back to the project data folder */ }
    }
  } catch { /* use the repository data folder */ }
  storiesRoot = path.join(dataRoot, 'stories');
  compendiumPath = path.join(dataRoot, 'compendium.json');
}
await fs.mkdir(storiesRoot, { recursive: true });

const safeFilePart = (value: string) => value
  .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
  .replace(/[. ]+$/g, '')
  .trim()
  .slice(0, 90) || '未命名故事';
const archiveFileName = (story: StoryArchive) => `${safeFilePart(story.storyName)}_${story.savedAt.replace(/[:.]/g, '-').replace(/[^\w-]/g, '')}.json`;
const archivePath = (story: StoryArchive) => path.join(storiesRoot, archiveFileName(story));

async function writeJson(target: string, value: unknown) {
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(temporary, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(temporary, target);
}

async function listStoryFiles() {
  return (await fs.readdir(storiesRoot)).filter(file => file.endsWith('.json')).sort();
}

async function readStoryFile(file: string): Promise<StoryArchive> {
  return normalizeStory(JSON.parse(await fs.readFile(path.join(storiesRoot, file), 'utf8')));
}

async function findStoryEntry(id: string) {
  for (const file of await listStoryFiles()) {
    try {
      const story = await readStoryFile(file);
      if (story.storyId === id) return { file, story };
    } catch { /* ignore malformed files while listing */ }
  }
  return undefined;
}

async function readStory(id: string): Promise<StoryArchive> {
  const entry = await findStoryEntry(id);
  if (!entry) throw Object.assign(new Error('故事档案不存在'), { code: 'ENOENT' });
  return entry.story;
}

async function copyArchiveData(fromRoot: string, toRoot: string) {
  if (path.resolve(fromRoot) === path.resolve(toRoot)) return;
  const fromStories = path.join(fromRoot, 'stories');
  const toStories = path.join(toRoot, 'stories');
  await fs.mkdir(toStories, { recursive: true });
  try {
    for (const file of await fs.readdir(fromStories)) {
      if (!file.endsWith('.json')) continue;
      const target = path.join(toStories, file);
      try { await fs.access(target); } catch { await fs.copyFile(path.join(fromStories, file), target); }
    }
  } catch { /* source may not have a stories folder */ }
  try {
    const sourceCompendium = path.join(fromRoot, 'compendium.json');
    const targetCompendium = path.join(toRoot, 'compendium.json');
    try { await fs.access(targetCompendium); } catch { await fs.copyFile(sourceCompendium, targetCompendium); }
  } catch { /* compendium is optional */ }
}

async function setDataRoot(nextRoot: string) {
  const resolved = path.resolve(nextRoot);
  if (resolved === path.parse(resolved).root) throw new Error('档案目录不能是磁盘根目录');
  await copyArchiveData(dataRoot, resolved);
  dataRoot = resolved;
  storiesRoot = path.join(dataRoot, 'stories');
  compendiumPath = path.join(dataRoot, 'compendium.json');
  await fs.mkdir(storiesRoot, { recursive: true });
  await writeJson(settingsPath, { dataDirectory: dataRoot });
}

async function readCompendium(): Promise<CompendiumItem[]> {
  try {
    const value = JSON.parse(await fs.readFile(compendiumPath, 'utf8'));
    return Array.isArray(value) ? value : Object.values(value);
  } catch { return []; }
}

const app = express();
app.use(express.json({ limit: '8mb' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, dataDirectory: dataRoot }));
app.get('/api/settings', (_req, res) => res.json({ dataDirectory: dataRoot }));
app.put('/api/settings', async (req, res, next) => {
  try {
    if (typeof req.body?.dataDirectory !== 'string' || !req.body.dataDirectory.trim()) return res.status(400).json({ message: '档案目录不能为空' });
    await setDataRoot(req.body.dataDirectory.trim());
    res.json({ dataDirectory: dataRoot });
  } catch (error) { next(error); }
});

app.get('/api/stories', async (_req, res, next) => {
  try {
    const summaries: StorySummary[] = [];
    for (const file of await listStoryFiles()) {
      try {
        const story = await readStoryFile(file);
        summaries.push({ storyId: story.storyId, storyName: story.storyName, eventCount: story.events.length, branchCount: story.branches.length, savedAt: story.savedAt });
      } catch { /* skip malformed local files */ }
    }
    res.json(summaries.sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
  } catch (error) { next(error); }
});

app.get('/api/stories/:id', async (req, res, next) => {
  try { res.json(await readStory(req.params.id)); } catch (error) { next(error); }
});

app.post('/api/stories', async (req, res, next) => {
  try {
    const story = normalizeStory({ ...createEmptyStory(String(req.body?.storyName || '未命名故事')), ...req.body });
    if (await findStoryEntry(story.storyId)) return res.status(409).json({ message: '故事 ID 已存在' });
    await writeJson(archivePath(story), story);
    res.status(201).json(story);
  } catch (error) { next(error); }
});

app.put('/api/stories/:id', async (req, res, next) => {
  try {
    const story = normalizeStory({ ...req.body, storyId: req.params.id, savedAt: new Date().toISOString() });
    const previous = await findStoryEntry(req.params.id);
    const target = archivePath(story);
    await writeJson(target, story);
    if (previous && path.resolve(path.join(storiesRoot, previous.file)) !== path.resolve(target)) await fs.rm(path.join(storiesRoot, previous.file), { force: true });
    res.json(story);
  } catch (error) { next(error); }
});

app.delete('/api/stories/:id', async (req, res, next) => {
  try {
    const entry = await findStoryEntry(req.params.id);
    if (!entry) return res.status(404).json({ message: '故事档案不存在' });
    await fs.rm(path.join(storiesRoot, entry.file));
    res.status(204).end();
  } catch (error) { next(error); }
});

app.get('/api/compendium', async (_req, res, next) => {
  try { res.json(await readCompendium()); } catch (error) { next(error); }
});
app.put('/api/compendium', async (req, res, next) => {
  try {
    if (!Array.isArray(req.body)) return res.status(400).json({ message: '图鉴数据必须是数组' });
    await writeJson(compendiumPath, req.body);
    res.json({ count: req.body.length });
  } catch (error) { next(error); }
});

app.use(express.static(path.join(root, 'dist')));
app.get('*', async (_req, res) => {
  try { res.sendFile(path.join(root, 'dist', 'index.html')); }
  catch { res.status(404).json({ message: '请先执行 npm run build' }); }
});
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : '请求失败';
  const status = error instanceof Error && 'code' in error && error.code === 'ENOENT' ? 404 : 500;
  res.status(status).json({ message });
});

app.listen(port, '127.0.0.1', () => console.log(`Timeline Story Editor listening on http://127.0.0.1:${port}`));
