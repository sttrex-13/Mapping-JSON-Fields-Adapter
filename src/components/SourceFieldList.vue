<script setup lang="ts">
import type { SourceField } from "../domain/mapping";
defineProps<{
  fields: SourceField[];
  selectedPath?: string;
  mappedSources: Set<string>;
  search: string;
}>();
const emit = defineEmits<{
  select: [field: SourceField];
  "update:search": [value: string];
}>();
</script>

<template>
  <aside
    class="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
  >
    <h2 class="font-semibold text-slate-900">2. เลือก field ต้นทาง</h2>
    <p class="mt-1 text-sm text-slate-500">คลิก field ที่ต้องการ map</p>
    <input
      :value="search"
      class="my-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
      placeholder="Search fields"
      @input="emit('update:search', ($event.target as HTMLInputElement).value)"
    />
    <ul class="grid max-h-275 gap-2 overflow-auto pr-1">
      <li v-for="field in fields" :key="field.path">
        <button
          type="button"
          :class="[
            'w-full rounded-xl border p-3 text-left',
            selectedPath === field.path
              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
              : 'border-slate-200 hover:bg-slate-50',
          ]"
          @click="emit('select', field)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="truncate text-sm font-semibold text-slate-700">{{
              field.label
            }}</span
            ><span
              v-if="mappedSources.has(field.path)"
              class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
              >Mapped</span
            >
          </div>
          <div class="mt-1.5 flex items-center justify-between gap-2">
            <code class="truncate text-xs text-slate-500">{{ field.path }}</code
            ><span
              class="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700"
              >{{ field.type }}</span
            >
          </div>
        </button>
      </li>
    </ul>
  </aside>
</template>
