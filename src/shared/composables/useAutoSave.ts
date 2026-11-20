import { ref } from 'vue';

export type AutoSaveState = 'saved' | 'pending' | 'saving' | 'error';

interface PendingSave<T> {
  value: T;
  epoch: number;
}

interface UseAutoSaveOptions<T> {
  getValue: () => T | null;
  setValue: (value: T) => void;
  persist: (value: T) => Promise<T>;
  onError?: (error: unknown) => void;
  delay?: number;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function snapshot<T>(value: T): string {
  return JSON.stringify(value);
}

export function useAutoSave<T>(options: UseAutoSaveOptions<T>) {
  const saving = ref(false);
  const state = ref<AutoSaveState>('saved');
  const delay = options.delay ?? 700;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let persistedSnapshot = '';
  let pending: PendingSave<T> | undefined;
  let activePromise: Promise<void> | undefined;
  let epoch = 0;
  let disposed = false;

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  function initialize(value: T | null) {
    epoch += 1;
    clearTimer();
    pending = undefined;
    persistedSnapshot = value == null ? '' : snapshot(value);
    if (!saving.value) state.value = 'saved';
  }

  function schedule() {
    const value = options.getValue();
    if (disposed || value == null) return;
    if (snapshot(value) === persistedSnapshot) {
      clearTimer();
      state.value = 'saved';
      return;
    }
    clearTimer();
    state.value = 'pending';
    timer = setTimeout(() => {
      timer = undefined;
      const current = options.getValue();
      if (current != null) void saveNow(current).catch(() => undefined);
    }, delay);
  }

  async function processQueue() {
    while (pending && !disposed) {
      const request = pending;
      pending = undefined;
      const requestSnapshot = snapshot(request.value);
      if (requestSnapshot === persistedSnapshot) continue;

      saving.value = true;
      state.value = 'saving';
      try {
        const saved = await options.persist(clone(request.value));
        if (request.epoch !== epoch) continue;

        persistedSnapshot = snapshot(saved);
        const current = options.getValue();
        const currentSnapshot = current == null ? '' : snapshot(current);
        const changedDuringSave = current != null && currentSnapshot !== requestSnapshot;
        if (current != null && !changedDuringSave) {
          clearTimer();
          options.setValue(saved);
        }
        if (changedDuringSave && !pending) {
          clearTimer();
          pending = { value: clone(current), epoch };
        }
      } catch (error) {
        if (request.epoch !== epoch) continue;
        if (pending) {
          state.value = 'pending';
          continue;
        }
        state.value = 'error';
        options.onError?.(error);
        throw error;
      } finally {
        saving.value = false;
      }
    }
    if (!pending && state.value !== 'error') state.value = 'saved';
  }

  function ensureQueue() {
    if (!activePromise) {
      activePromise = processQueue().finally(() => {
        activePromise = undefined;
      });
    }
    return activePromise;
  }

  function saveNow(value: T) {
    if (disposed) return Promise.resolve();
    clearTimer();
    pending = { value: clone(value), epoch };
    state.value = 'saving';
    return ensureQueue();
  }

  function dispose() {
    disposed = true;
    epoch += 1;
    clearTimer();
    pending = undefined;
  }

  return { saving, state, initialize, schedule, saveNow, dispose };
}
