import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseMarkdown } from '../src/shared/domain/markdown';
import { createEmptyStory, normalizeStory } from '../src/shared/domain/normalize';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function importMarkdownFile(markdownPath: string, requestedStoryId?: string, dataRoot = process.env.TIMELINE_DATA_DIR || path.join(root, 'data')) {
  const storiesRoot = path.join(path.resolve(dataRoot), 'stories');
  await fs.mkdir(storiesRoot, { recursive: true });
  const files = (await fs.readdir(storiesRoot)).filter(file => file.endsWith('.json')).sort((a, b) => a.localeCompare(b));
  const archives = await Promise.all(files.map(async file => ({
    file,
    story: normalizeStory(JSON.parse(await fs.readFile(path.join(storiesRoot, file), 'utf8'))),
  })));
  const selected = requestedStoryId
    ? archives.find(item => item.story.storyId === requestedStoryId)
    : archives.slice().sort((a, b) => b.story.savedAt.localeCompare(a.story.savedAt) || a.file.localeCompare(b.file))[0];
  if (requestedStoryId && !selected) throw new Error(`找不到故事档案: ${requestedStoryId}`);
  const base = selected?.story || createEmptyStory();
  const result = parseMarkdown(await fs.readFile(markdownPath, 'utf8'), base);
  const safeName = result.story.storyName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').trim().slice(0, 90) || '未命名故事';
  const archiveStamp = result.story.savedAt.replace(/[:.]/g, '-').replace(/[^\w-]/g, '');
  const targetFile = `${safeName}_${archiveStamp}.json`;
  const target = path.join(storiesRoot, targetFile);
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(result.story, null, 2), 'utf8');
  await fs.rename(temporary, target);
  if (selected?.file && selected.file !== targetFile) await fs.rm(path.join(storiesRoot, selected.file), { force: true });
  return result;
}

async function runCli() {
  const args = process.argv.slice(2);
  const storyIndex = args.indexOf('--story');
  const requestedStoryId = storyIndex >= 0 ? args[storyIndex + 1] : undefined;
  if (storyIndex >= 0 && (!requestedStoryId || requestedStoryId.startsWith('--'))) throw new Error('--story 后需要故事 ID');
  const markdownArg = args.find((arg, index) => !arg.startsWith('--') && (storyIndex < 0 || index !== storyIndex + 1));
  const markdownPath = path.resolve(markdownArg || path.join(root, 'import_temp.md'));
  const result = await importMarkdownFile(markdownPath, requestedStoryId);
  console.log(`导入 ${result.importedCount} 个事件到 ${result.story.storyName}`);
  if (result.warnings.length) console.warn(result.warnings.join('\n'));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await runCli();
}
