import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAutoSave } from '../../src/shared/composables/useAutoSave';

afterEach(() => vi.useRealTimers());

async function flushPromises() {
  for (let index = 0; index < 8; index++) await Promise.resolve();
}

describe('auto-save queue', () => {
  it('queues edits made during an in-flight save and keeps the newest state', async () => {
    vi.useFakeTimers();
    let currentValue = 'initial';
    const requests: Array<{ value: string; resolve: (value: string) => void }> = [];
    const autoSave = useAutoSave<string>({
      getValue: () => currentValue,
      setValue: value => { currentValue = value; },
      persist: value => new Promise(resolve => requests.push({ value, resolve })),
    });
    autoSave.initialize(currentValue);

    currentValue = 'first edit';
    const firstSave = autoSave.saveNow(currentValue);
    expect(requests.map(request => request.value)).toEqual(['first edit']);

    currentValue = 'latest edit';
    autoSave.schedule();
    vi.advanceTimersByTime(700);
    expect(requests).toHaveLength(1);

    requests[0].resolve('first edit persisted');
    await flushPromises();
    expect(currentValue).toBe('latest edit');
    expect(requests.map(request => request.value)).toEqual(['first edit', 'latest edit']);

    requests[1].resolve('latest edit persisted');
    await firstSave;
    expect(currentValue).toBe('latest edit persisted');
    expect(autoSave.state.value).toBe('saved');
    autoSave.dispose();
  });

  it('does not lose an explicit save requested while another save is active', async () => {
    let currentValue = 'initial';
    const requests: Array<{ value: string; resolve: (value: string) => void }> = [];
    const autoSave = useAutoSave<string>({
      getValue: () => currentValue,
      setValue: value => { currentValue = value; },
      persist: value => new Promise(resolve => requests.push({ value, resolve })),
    });
    autoSave.initialize(currentValue);

    currentValue = 'first edit';
    const firstSave = autoSave.saveNow(currentValue);
    currentValue = 'Ctrl+S edit';
    const explicitSave = autoSave.saveNow(currentValue);
    requests[0].resolve('first edit persisted');
    await flushPromises();
    expect(requests.map(request => request.value)).toEqual(['first edit', 'Ctrl+S edit']);

    requests[1].resolve('Ctrl+S edit persisted');
    await Promise.all([firstSave, explicitSave]);
    expect(currentValue).toBe('Ctrl+S edit persisted');
    autoSave.dispose();
  });
});
