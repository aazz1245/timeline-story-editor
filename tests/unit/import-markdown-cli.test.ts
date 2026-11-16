import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createEmptyStory } from '../../src/shared/domain/normalize';
import { importMarkdownFile } from '../../scripts/import-markdown';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true }))); });

describe('Markdown CLI archive selection', () => {
  it('defaults to the most recently saved story and honors an explicit story ID', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'timeline-markdown-cli-'));
    directories.push(root);
    const stories = path.join(root, 'stories');
    await fs.mkdir(stories, { recursive: true });
    const older = { ...createEmptyStory('旧故事'), storyId: 'older', savedAt: '2030-01-01T00:00:00.000Z' };
    const newer = { ...createEmptyStory('新故事'), storyId: 'newer', savedAt: '2031-01-01T00:00:00.000Z' };
    await fs.writeFile(path.join(stories, 'a-older.json'), JSON.stringify(older));
    await fs.writeFile(path.join(stories, 'z-newer.json'), JSON.stringify(newer));
    const markdown = path.join(root, 'events.md');
    await fs.writeFile(markdown, '### 2032/01/01 上午 - CLI 导入\n\n测试正文');

    const defaultResult = await importMarkdownFile(markdown, undefined, root);
    expect(defaultResult.story.storyId).toBe('newer');
    expect(defaultResult.story.events[0].title).toBe('CLI 导入');
    const explicitResult = await importMarkdownFile(markdown, 'older', root);
    expect(explicitResult.story.storyId).toBe('older');
    expect(JSON.parse(await fs.readFile(path.join(stories, 'a-older.json'), 'utf8')).events).toHaveLength(1);
    expect(JSON.parse(await fs.readFile(path.join(stories, 'z-newer.json'), 'utf8')).events).toHaveLength(1);
  });

  it('rejects an unknown story ID without creating or changing an archive', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'timeline-markdown-cli-'));
    directories.push(root);
    const markdown = path.join(root, 'events.md');
    await fs.writeFile(markdown, '### 2032/01/01 上午 - CLI 导入\n\n测试正文');
    await expect(importMarkdownFile(markdown, 'missing-story', root)).rejects.toThrow('找不到故事档案');
    expect(await fs.readdir(path.join(root, 'stories'))).toEqual([]);
  });
});
