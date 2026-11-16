import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEmptyStory, normalizeStory } from '../src/shared/domain/normalize';
import type { CompendiumItem, StoryArchive, StorySummary } from '../src/shared/types';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataRoot = path.resolve(process.env.TIMELINE_DATA_DIR || path.join(root, 'data'));
const storiesRoot = path.join(dataRoot, 'stories');
const compendiumPath = path.join(dataRoot, 'compendium.json');
const port = Number(process.env.PORT || 4174);

await fs.mkdir(storiesRoot, { recursive: true });

const safeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_');
const storyPath = (id: string) => path.join(storiesRoot, `${safeId(id)}.json`);
async function writeJson(target: string, value: unknown) {
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(temporary, target);
}

async function listStoryFiles() {
  return (await fs.readdir(storiesRoot)).filter(file => file.endsWith('.json')).sort();
}

async function readStory(id: string): Promise<StoryArchive> {
  return normalizeStory(JSON.parse(await fs.readFile(storyPath(id), 'utf8')));
}

async function readCompendium(): Promise<CompendiumItem[]> {
  try {
    const value = JSON.parse(await fs.readFile(compendiumPath, 'utf8'));
    return Array.isArray(value) ? value : Object.values(value);
  } catch {
    return [];
  }
}

const app = express();
app.use(express.json({ limit: '8mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/stories', async (_req, res, next) => {
  try {
    const summaries: StorySummary[] = [];
    for (const file of await listStoryFiles()) {
      const story = await readStory(path.basename(file, '.json'));
      summaries.push({ storyId: story.storyId, storyName: story.storyName, eventCount: story.events.length, branchCount: story.branches.length, savedAt: story.savedAt });
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
    try { await fs.access(storyPath(story.storyId)); return res.status(409).json({ message: '故事 ID 已存在' }); } catch { /* new archive */ }
    await writeJson(storyPath(story.storyId), story);
    res.status(201).json(story);
  } catch (error) { next(error); }
});

app.put('/api/stories/:id', async (req, res, next) => {
  try {
    const story = normalizeStory({ ...req.body, storyId: req.params.id, savedAt: new Date().toISOString() });
    await writeJson(storyPath(req.params.id), story);
    res.json(story);
  } catch (error) { next(error); }
});

app.delete('/api/stories/:id', async (req, res, next) => {
  try { await fs.rm(storyPath(req.params.id)); res.status(204).end(); } catch (error) { next(error); }
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
