import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { normalizeStory } from '../src/shared/domain/normalize';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function migrateLegacyData(options: { sourceRoot?: string; archiveRoot?: string; compendiumSource?: string } = {}) {
  const sourceRoot = path.resolve(options.sourceRoot || path.join(root, 'data'));
  const archiveRoot = path.resolve(options.archiveRoot || process.env.TIMELINE_DATA_DIR || sourceRoot);
  const storiesRoot = path.join(archiveRoot, 'stories');
  await fs.mkdir(storiesRoot, { recursive: true });
  const report: string[] = [];
  const files = (await fs.readdir(sourceRoot)).filter(file => file.endsWith('.json') && !['compendium.json', 'migration-report.json'].includes(file));
  const seen = new Set<string>();
  for (const file of files) {
    const input = JSON.parse(await fs.readFile(path.join(sourceRoot, file), 'utf8'));
    if (!Array.isArray(input.events)) continue;
    const story = normalizeStory(input);
    if (seen.has(story.storyId)) { report.push(`跳过重复输入: ${story.storyName}`); continue; }
    seen.add(story.storyId);
    const destination = path.join(storiesRoot, `${story.storyId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
    try { await fs.access(destination); report.push(`跳过已存在故事: ${story.storyName}`); }
    catch { await fs.writeFile(destination, JSON.stringify(story, null, 2)); report.push(`迁移故事: ${story.storyName}`); }
  }
  const compendiumDestination = path.join(archiveRoot, 'compendium.json');
  try { await fs.access(compendiumDestination); report.push('跳过已有物品图鉴'); }
  catch {
    const compendiumSource = options.compendiumSource || path.join(root, '模板', '物品图鉴数据.json');
    try { await fs.copyFile(compendiumSource, compendiumDestination); report.push('迁移物品图鉴'); }
    catch { report.push('未找到物品图鉴源文件'); }
  }
  await fs.writeFile(path.join(archiveRoot, 'migration-report.txt'), `${new Date().toISOString()}\n${report.join('\n')}\n`);
  return report;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const report = await migrateLegacyData();
  console.log(report.join('\n') || '没有需要迁移的本机数据');
}
