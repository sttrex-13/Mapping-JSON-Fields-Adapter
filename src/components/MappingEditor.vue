<script setup lang="ts">
import { ref } from "vue";
import type { MappingRule, SourceField } from "../domain/mapping";
defineProps<{
  selected: SourceField | null;
  targetPath: string;
  rules: MappingRule[];
}>();
const emit = defineEmits<{
  "update:targetPath": [value: string];
  add: [];
  remove: [id: string];
  reorder: [from: string, to: string];
}>();
const draggingId = ref<string | null>(null);
</script>

<template>
  <section
    class="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
  >
    <h2 class="font-semibold text-slate-900">3. กำหนด output</h2>
    <p class="mt-1 text-sm text-slate-500">
      ใส่ target path เช่น <code>program_group</code> หรือ
      <code>meta.group</code>
    </p>
    <div class="my-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p class="text-xs font-bold uppercase text-slate-500">Source field</p>
      <code class="mt-2 block break-all text-sm text-slate-700">{{
        selected?.path ?? "Select a field from the left"
      }}</code>
    </div>
    <label class="grid gap-2 text-sm font-semibold text-slate-700"
      >Target path<input
        :value="targetPath"
        class="rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
        placeholder="e.g. program_group"
        @input="
          emit('update:targetPath', ($event.target as HTMLInputElement).value)
        "
    /></label>
    <button
      class="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      type="button"
      :disabled="!selected || !targetPath.trim()"
      @click="emit('add')"
    >
      Add mapping
    </button>
    <div class="mb-3 mt-7">
      <h2 class="font-semibold text-slate-900">Mapping ที่เพิ่มแล้ว</h2>
      <p class="mt-1 text-sm text-slate-500">ลากแถวเพื่อเรียง key ใน JSON</p>
    </div>
    <ul class="grid max-h-210 gap-2 overflow-auto">
      <li
        v-for="rule in rules"
        :key="rule.id"
        draggable="true"
        @dragstart="draggingId = rule.id"
        @dragend="draggingId = null"
        @dragover.prevent
        @drop="draggingId && emit('reorder', draggingId, rule.id)"
      >
        <div
          :class="[
            'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border p-3',
            draggingId === rule.id
              ? 'border-blue-300 bg-blue-50 opacity-60'
              : 'border-slate-200',
          ]"
        >
          <span class="cursor-grab text-slate-400">⠿</span>
          <div class="min-w-0">
            <code class="block truncate text-xs text-slate-500">{{
              rule.source
            }}</code
            ><code class="mt-1 block break-all text-sm text-slate-800"
              >→ {{ rule.target }}</code
            >
          </div>
          <button
            class="grid h-7 w-7 place-items-center rounded-lg text-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
            type="button"
            @click="emit('remove', rule.id)"
          >
            ×
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>
