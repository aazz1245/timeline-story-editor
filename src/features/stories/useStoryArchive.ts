import { ref, watch } from 'vue';
import { api } from '../../shared/api';
import type { StoryArchive, StorySummary } from '../../shared/types';
import { useAutoSave } from '../../shared/composables/useAutoSave';

interface UseStoryArchiveOptions {
  onSaveError?: (error: unknown) => void;
}

export function useStoryArchive(options: UseStoryArchiveOptions = {}) {
  const stories = ref<StorySummary[]>([]);
  const selectedId = ref('');
  const story = ref<StoryArchive | null>(null);
  const loading = ref(true);
  let loadGeneration = 0;

  async function refreshStories(selectLatest = true) {
    stories.value = await api.stories();
    if (selectLatest && !selectedId.value) selectedId.value = stories.value[0]?.storyId || '';
  }

  const autoSave = useAutoSave<StoryArchive>({
    getValue: () => story.value,
    setValue: value => { story.value = value; },
    persist: async value => {
      const saved = await api.saveStory(value);
      await refreshStories(false);
      return saved;
    },
    onError: options.onSaveError,
  });

  async function loadStory(id: string) {
    if (!id) return;
    const generation = ++loadGeneration;
    const previous = story.value;
    loading.value = true;
    try {
      if (previous && previous.storyId !== id) await autoSave.saveNow(previous);
      const loaded = await api.story(id);
      if (generation !== loadGeneration) return;
      story.value = loaded;
      selectedId.value = id;
      autoSave.initialize(story.value);
    } catch (error) {
      if (generation !== loadGeneration) return;
      selectedId.value = previous?.storyId || '';
      throw error;
    } finally {
      if (generation === loadGeneration) loading.value = false;
    }
  }

  async function save(next: StoryArchive) {
    story.value = next;
    await autoSave.saveNow(next);
  }

  async function saveCurrentStory() {
    if (!story.value) return;
    await autoSave.saveNow(story.value);
  }

  watch(story, next => {
    if (!next || loading.value) return;
    autoSave.schedule();
  }, { deep: true });

  return {
    stories,
    selectedId,
    story,
    loading,
    saving: autoSave.saving,
    autoSaveState: autoSave.state,
    refreshStories,
    loadStory,
    save,
    saveCurrentStory,
    dispose: autoSave.dispose,
  };
}
