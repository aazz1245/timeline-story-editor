import { describe, expect, it } from 'vitest';
import { calculateBranchDepths } from '../../src/shared/domain/timeline';
import type { TimelineBranch, TimelineEvent } from '../../src/shared/types';

const event = (id: string, branchId: string | null): TimelineEvent => ({
  id,
  title: id,
  date: '2030/01/01',
  time: '上午',
  location: '',
  summary: '',
  content: '',
  people: [],
  peopleData: {},
  order: 1,
  branchId,
});

describe('timeline branch depth', () => {
  it('resolves nested branches through their parent events', () => {
    const branches: TimelineBranch[] = [
      { id: 'north', name: '北线', parentEventId: 'root' },
      { id: 'north-after', name: '北线后续', parentEventId: 'north-event' },
      { id: 'north-final', name: '北线终局', parentEventId: 'north-after-event' },
    ];
    const events = [
      event('root', null),
      event('north-event', 'north'),
      event('north-after-event', 'north-after'),
    ];

    expect([...calculateBranchDepths(branches, events).entries()]).toEqual([
      ['north', 1],
      ['north-after', 2],
      ['north-final', 3],
    ]);
  });

  it('stays finite when a parent reference is missing or cyclic', () => {
    const branches: TimelineBranch[] = [
      { id: 'missing-parent', name: '缺失父级', parentEventId: 'missing-event' },
      { id: 'cycle-a', name: '循环 A', parentEventId: 'cycle-a-event' },
      { id: 'cycle-b', name: '循环 B', parentEventId: 'cycle-b-event' },
    ];
    const events = [event('cycle-a-event', 'cycle-b'), event('cycle-b-event', 'cycle-a')];

    expect(calculateBranchDepths(branches, events).get('missing-parent')).toBe(1);
    expect(calculateBranchDepths(branches, events).get('cycle-a')).toBeLessThan(4);
    expect(calculateBranchDepths(branches, events).get('cycle-b')).toBeLessThan(4);
  });
});
