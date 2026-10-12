<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { MappingRule, SourceField } from "../domain/mapping";
type TargetMode = "value" | "array";

const props = defineProps<{
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
const targetMode = ref<TargetMode>("value");
const arrayParentPath = ref("");
const segmentName = ref("");

const resolvedTargetPath = computed(() => {
  const parentPath = arrayParentPath.value.trim().replace(/\.$/, "");
  const childPath = segmentName.value.trim().replace(/^\.+|\.+$/g, "");
  if (!parentPath) return "";
  return targetMode.value === "array"
    ? childPath
      ? `${parentPath}[].${childPath}`
      : ""
    : parentPath;
});

watch(
  () => [props.selected, props.targetPath] as const,
  ([, targetPath]) => {
    const arrayIndex = targetPath.indexOf("[]");
    if (arrayIndex >= 0) {
      targetMode.value = "array";
      arrayParentPath.value = targetPath.slice(0, arrayIndex).replace(/\.$/, "");
      segmentName.value = targetPath.slice(arrayIndex + 2).replace(/^\./, "");
      return;
    }

    targetMode.value = "value";
    arrayParentPath.value = targetPath;
    segmentName.value = "";
  },
  { immediate: true },
);

const updateTargetPath = () => {
  if (resolvedTargetPath.value)
    emit("update:targetPath", resolvedTargetPath.value);
};

const setTargetMode = (mode: TargetMode) => {
  targetMode.value = mode;
  segmentName.value = "";
  if (mode === "value") emit("update:targetPath", arrayParentPath.value);
};

const updateTargetParent = (value: string) => {
  if (targetMode.value === "array") {
    arrayParentPath.value = value;
    updateTargetPath();
    return;
  }
  arrayParentPath.value = value;
  emit("update:targetPath", value);
};

const updateSegmentName = (value: string) => {
  segmentName.value = value;
  updateTargetPath();
};
</script>

<template>
  <section
    class="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
  >
    <h2 class="font-semibold text-slate-900">3. กำหนด output</h2>
    <p class="mt-1 text-sm text-slate-500">
      สร้าง path ปลายทาง หรือเลือก Array เพื่อเพิ่ม segment ในแต่ละรายการ
    </p>
    <div class="my-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-xs font-bold uppercase tracking-wide text-slate-500"
          >Source field</span
        ><span
          v-if="selected"
          class="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700"
          >{{ selected.type }}</span
        >
      </div>
      <code class="break-all text-sm text-slate-700">{{
        selected?.path ?? "Select a field from the left"
      }}</code>
    </div>
    <div class="grid gap-4">
      <label class="grid gap-2 text-sm font-semibold text-slate-700"
        >Target path<input
          :value="targetMode === 'array' ? arrayParentPath : targetPath"
          class="rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
          placeholder="e.g. object or object.field"
          @input="
            updateTargetParent(($event.target as HTMLInputElement).value)
          "
      /></label>
      <fieldset v-if="selected?.type === 'array'">
        <legend class="mb-2 text-sm font-semibold text-slate-700">
          Target type
        </legend>
        <div class="grid grid-cols-2 gap-3">
          <label
            :class="[
              'cursor-pointer rounded-xl border p-3 transition',
              targetMode === 'value'
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                : 'border-slate-200 hover:bg-slate-50',
            ]"
            ><input
              :checked="targetMode === 'value'"
              class="sr-only"
              type="radio"
              name="target-mode"
              @change="setTargetMode('value')"
            /><span class="block text-sm font-semibold text-slate-800"
              >Value</span
            ><span class="mt-1 block text-xs text-slate-500"
              >สร้าง field ปกติ</span
            ></label
          ><label
            :class="[
              'cursor-pointer rounded-xl border p-3 transition',
              targetMode === 'array'
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                : 'border-slate-200 hover:bg-slate-50',
            ]"
            ><input
              :checked="targetMode === 'array'"
              class="sr-only"
              type="radio"
              name="target-mode"
              @change="setTargetMode('array')"
            /><span class="block text-sm font-semibold text-slate-800"
              >Array <code>[]</code></span
            ><span class="mt-1 block text-xs text-slate-500"
              >สร้าง field ภายใน array</span
            ></label
          >
        </div>
      </fieldset>
      <label
        v-if="targetMode === 'array'"
        class="grid gap-2 rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm font-semibold text-slate-700"
        >Segment name<input
          :value="segmentName"
          class="rounded-lg border border-violet-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
          placeholder="e.g. value or value.segment"
          @input="
            updateSegmentName(($event.target as HTMLInputElement).value)
          "
        /><span class="text-xs font-normal text-slate-500"
          >ชื่อ property ที่อยู่ในแต่ละ item ของ array</span
        ></label
      >
      <div
        v-if="resolvedTargetPath"
        class="rounded-xl border border-blue-100 bg-blue-50 p-3"
      >
        <p class="text-xs font-bold uppercase tracking-wide text-blue-600">
          Output path preview
        </p>
        <code class="mt-1 block break-all text-sm text-blue-900">{{
          resolvedTargetPath
        }}</code>
      </div>
    </div>
    <button
      class="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      type="button"
      :disabled="!selected || !resolvedTargetPath"
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
