import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { migrateLegacyData } from '../../scripts/migrate-legacy-data';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true }))); });

describe('legacy archive migration', () => {
  it('is idempotent, deduplicates by storyId, and never overwrites an existing archive', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'timeline-migration-'));
    directories.push(root);
    const source = path.join(root, 'source'), archive = path.join(root, 'archive'), catalog = path.join(root, 'catalog.json');
    await fs.mkdir(source, { recursive: true });
    await fs.mkdir(path.join(archive, 'stories'), { recursive: true });
    const story = { storyId: 'story-one', storyName: 'First', events: [{ id: 1, title: 'One', date: '2030/03/01' }] };
    await fs.writeFile(path.join(source, 'first.json'), JSON.stringify(story));
    await fs.writeFile(path.join(source, 'duplicate.json'), JSON.stringify({ ...story, storyName: 'Duplicate' }));
    await fs.writeFile(path.join(source, 'existing.json'), JSON.stringify({ ...story, storyId: 'story-existing', storyName: 'Old value' }));
    await fs.writeFile(path.join(archive, 'stories', 'story-existing.json'), JSON.stringify({ ...story, storyId: 'story-existing', storyName: 'Protected value' }));
    await fs.writeFile(catalog, '[]');

    await migrateLegacyData({ sourceRoot: source, archiveRoot: archive, compendiumSource: catalog });
    await migrateLegacyData({ sourceRoot: source, archiveRoot: archive, compendiumSource: catalog });
    const stories = await fs.readdir(path.join(archive, 'stories'));
    expect(stories.sort()).toEqual(['story-existing.json', 'story-one.json']);
    const protectedStory = JSON.parse(await fs.readFile(path.join(archive, 'stories', 'story-existing.json'), 'utf8'));
    expect(protectedStory.storyName).toBe('Protected value');
    expect(JSON.parse(await fs.readFile(path.join(archive, 'compendium.json'), 'utf8'))).toEqual([]);
  });
});
