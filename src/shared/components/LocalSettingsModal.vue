<script setup lang="ts">
import { reactive } from 'vue';
import { PhArrowClockwise, PhDatabase } from '@phosphor-icons/vue';
import ModalShell from './ModalShell.vue';

const props = defineProps<{ dataDirectory: string }>();
const emit = defineEmits<{ close: []; refresh: []; save: [directory: string] }>();
const draft = reactive({ dataDirectory: props.dataDirectory });
</script>

<template>
  <ModalShell title="本机设置" heading-id="local-settings-title" @close="emit('close')">
    <div class="settings-list">
      <div class="settings-row settings-directory"><span class="settings-icon"><PhDatabase :size="18" aria-hidden="true" /></span><div class="settings-directory-content"><strong>档案目录</strong><input v-model="draft.dataDirectory" aria-label="默认存档文件夹" /><p>更改后会复制现有档案到新目录；之后保存的文件按“故事名_存档时间”命名。</p></div></div>
      <div class="settings-row"><span class="settings-icon"><PhArrowClockwise :size="18" aria-hidden="true" /></span><div><strong>本机服务</strong><p>仅监听 127.0.0.1，故事和图鉴不会上传。</p></div></div>
    </div>
    <div class="modal-actions"><button class="btn" type="button" @click="emit('close')">关闭</button><button class="btn" type="button" @click="emit('refresh'); emit('close')">重新读取档案</button><button class="btn primary" type="button" @click="emit('save', draft.dataDirectory)">保存目录</button></div>
  </ModalShell>
</template>
