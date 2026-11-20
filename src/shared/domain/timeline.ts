import type { TimelineBranch, TimelineEvent } from '../types';

export function calculateBranchDepths(branches: TimelineBranch[], events: TimelineEvent[]) {
  const branchById = new Map(branches.map(branch => [branch.id, branch]));
  const eventById = new Map(events.map(event => [String(event.id), event]));
  const depths = new Map<string, number>();

  function resolve(branchId: string, seen = new Set<string>()): number {
    const cached = depths.get(branchId);
    if (cached != null) return cached;
    if (seen.has(branchId)) return 1;

    const branch = branchById.get(branchId);
    if (branch?.parentEventId == null) {
      depths.set(branchId, 1);
      return 1;
    }

    const parentEvent = eventById.get(String(branch.parentEventId));
    const parentBranchId = parentEvent?.branchId;
    if (!parentBranchId || parentBranchId === branchId || !branchById.has(parentBranchId)) {
      depths.set(branchId, 1);
      return 1;
    }

    const nextSeen = new Set(seen);
    nextSeen.add(branchId);
    const depth = resolve(parentBranchId, nextSeen) + 1;
    depths.set(branchId, depth);
    return depth;
  }

  for (const branch of branches) resolve(branch.id);
  return depths;
}
