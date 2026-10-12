<script setup lang="ts">
import { computed, ref } from "vue";
import { downloadJson } from "../domain/download";
import { highlightJson } from "../highlight-json";

const props = defineProps<{
  title: string;
  description: string;
  data: unknown;
  filename: string;
}>();
const status = ref("");
const preview = computed(() => highlightJson(props.data));

async function copy() {
  try {
    await navigator.clipboard.writeText(JSON.stringify(props.data, null, 2));
    status.value = "Copied";
  } catch {
    status.value = "Clipboard permission was denied";
  }
}
</script>

<template>
  <section
    class="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
  >
    <div class="mb-4 flex items-start gap-3">
      <div class="mr-auto">
        <h2 class="font-semibold text-slate-900">{{ title }}</h2>
        <p class="mt-1 text-sm text-slate-500">{{ description }}</p>
      </div>
      <button
        class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
        type="button"
        @click="copy"
      >
        Copy
      </button>
      <button
        class="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
        type="button"
        @click="downloadJson(filename, data)"
      >
        Export
      </button>
    </div>
    <p v-if="status" class="mb-2 text-xs text-emerald-700">{{ status }}</p>
    <pre
      class="max-h-130 min-h-75 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100"
      v-html="preview"
    ></pre>
  </section>
</template>
