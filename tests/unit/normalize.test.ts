import { describe, expect, it } from 'vitest';
import { normalizeDate, normalizeStory } from '../../src/shared/domain/normalize';

describe('story normalization', () => {
  it('normalizes legacy date separators and missing collections', () => {
    const story = normalizeStory({ storyId: 'a', storyName: 'Legacy', events: [{ id: 1, title: 'A', date: '2030-3-2' }] });
    expect(normalizeDate('2030-3-2')).toBe('2030/03/02');
    expect(story.events[0].date).toBe('2030/03/02');
    expect(story.branches).toEqual([]);
    expect(story.mainCharacters).toEqual([]);
  });
});
