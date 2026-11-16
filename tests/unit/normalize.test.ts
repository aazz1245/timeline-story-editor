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

  it('preserves legacy event body data with stable defaults', () => {
    const story = normalizeStory({ storyId: 'body-data', events: [{ id: 'e1', title: '档案', date: '2030/01/01', people: ['甲'], peopleData: { 甲: { underwear: '测试内衣', bustSize: 92, specialAccessories: ['耳机'] } } }] });
    expect(story.events[0].peopleData['甲'].underwear).toBe('测试内衣');
    expect(story.events[0].peopleData['甲'].bustSize).toBe(92);
    expect(story.events[0].peopleData['甲'].specialAccessories).toEqual([{ type: '耳机' }]);
    expect(story.events[0].peopleData['甲'].penisState).toBe('未勃起');
  });
});
