<script setup lang="ts">
import { PhCommand, PhMagnifyingGlass, PhPlus, PhUploadSimple, PhDownloadSimple, PhSlidersHorizontal, PhX } from '@phosphor-icons/vue';

defineProps<{ open: boolean }>();
const emit = defineEmits<{
  close: [];
  newEvent: [];
  search: [];
  importMarkdown: [];
  importJson: [];
  exportMarkdown: [];
  exportJson: [];
  stageSettings: [];
}>();

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl';
const shift = isMac ? '⇧' : 'Shift';
</script>

<template>
  <div v-if="open" class="shortcut-backdrop" role="presentation" @click.self="emit('close')">
    <section id="shortcut-panel" class="shortcut-panel" role="dialog" aria-modal="true" aria-labelledby="shortcut-panel-title">
      <header class="shortcut-header">
        <div class="shortcut-heading">
          <span class="shortcut-symbol"><PhCommand :size="20" aria-hidden="true" /></span>
          <div>
            <h2 id="shortcut-panel-title">快捷操作</h2>
            <p>用键盘快速浏览和编辑故事时间线</p>
          </div>
        </div>
        <button class="icon-btn" type="button" aria-label="关闭快捷操作" @click="emit('close')"><PhX :size="19" aria-hidden="true" /></button>
      </header>
      <div class="shortcut-list" role="list">
        <button class="shortcut-row" type="button" role="listitem" @click="emit('newEvent')"><span class="shortcut-label"><PhPlus :size="17" aria-hidden="true" />新建事件</span><span class="key-combo"><kbd>N</kbd></span></button>
        <button class="shortcut-row" type="button" role="listitem" @click="emit('search')"><span class="shortcut-label"><PhMagnifyingGlass :size="17" aria-hidden="true" />搜索事件</span><span class="key-combo"><kbd>{{ mod }}</kbd><kbd>K</kbd></span></button>
        <button class="shortcut-row" type="button" role="listitem" @click="emit('importMarkdown')"><span class="shortcut-label"><PhUploadSimple :size="17" aria-hidden="true" />导入 Markdown</span><span class="key-combo"><kbd>{{ mod }}</kbd><kbd>{{ shift }}</kbd><kbd>M</kbd></span></button>
        <button class="shortcut-row" type="button" role="listitem" @click="emit('importJson')"><span class="shortcut-label"><PhUploadSimple :size="17" aria-hidden="true" />加载 JSON</span><span class="key-combo"><kbd>{{ mod }}</kbd><kbd>{{ shift }}</kbd><kbd>J</kbd></span></button>
        <button class="shortcut-row" type="button" role="listitem" @click="emit('exportMarkdown')"><span class="shortcut-label"><PhDownloadSimple :size="17" aria-hidden="true" />导出 Markdown</span><span class="key-combo"><kbd>{{ mod }}</kbd><kbd>⌥</kbd><kbd>M</kbd></span></button>
        <button class="shortcut-row" type="button" role="listitem" @click="emit('exportJson')"><span class="shortcut-label"><PhDownloadSimple :size="17" aria-hidden="true" />导出 JSON</span><span class="key-combo"><kbd>{{ mod }}</kbd><kbd>⌥</kbd><kbd>J</kbd></span></button>
        <button class="shortcut-row" type="button" role="listitem" @click="emit('stageSettings')"><span class="shortcut-label"><PhSlidersHorizontal :size="17" aria-hidden="true" />阶段设置</span><span class="key-combo"><kbd>{{ mod }}</kbd><kbd>{{ shift }}</kbd><kbd>S</kbd></span></button>
      </div>
      <footer class="shortcut-footer"><span>按</span><kbd>Esc</kbd><span>关闭</span><span class="shortcut-footer-spacer" /> <span>按</span><kbd>?</kbd><span>随时打开</span></footer>
    </section>
  </div>
</template>
