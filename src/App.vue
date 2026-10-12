<script setup lang="ts">
import { ref } from "vue";
import JsonPanel from "./components/JsonPanel.vue";
import MappingEditor from "./components/MappingEditor.vue";
import SourceFieldList from "./components/SourceFieldList.vue";
import { useMappingEditor } from "./composables/useMappingEditor";

const manualData = ref("");
const saved = ref(false);
const editor = useMappingEditor();

function run(action: () => void) {
  try {
    action();
  } catch (error) {
    editor.error.value =
      error instanceof Error ? error.message : "Something went wrong";
  }
}

function applyManualData() {
  if (!manualData.value.trim())
    return (editor.error.value = "Please enter JSON data before applying it.");
  run(() => {
    const data = JSON.parse(manualData.value);
    editor.loadData(data, "Manual data");
    manualData.value = JSON.stringify(data, null, 2);
  });
}

async function loadFile(event: Event, kind: "data" | "config") {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    kind === "data"
      ? editor.loadData(data, file.name)
      : editor.loadConfig(data, file.name);
    if (kind === "data") manualData.value = JSON.stringify(data, null, 2);
  } catch (error) {
    editor.error.value =
      error instanceof Error
        ? `Cannot import JSON: ${error.message}`
        : "Cannot import JSON";
  } finally {
    input.value = "";
  }
}

function reorderRules(from: string, to: string) {
  editor.reorder(from, to);
  saved.value = false;
}
</script>

<template>
  <main
    class="min-h-screen bg-slate-50 px-4 py-6 text-slate-800 sm:px-6 lg:px-8"
  >
    <div class="mx-auto max-w-[1600px]">
      <header
        class="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-7"
      >
        <div>
          <p
            class="mb-1 text-xs font-bold uppercase tracking-[.16em] text-blue-600"
          >
            Program configuration
          </p>
          <h1
            class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
          >
            Field mapping
          </h1>
          <p class="mt-2 text-sm text-slate-500">
            อัปโหลด JSON เลือกข้อมูลต้นทาง แล้วสร้างทั้ง output และ mapping
            config ได้ในที่เดียว
          </p>
        </div>
        <button
          class="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          type="button"
          @click="saved = true"
        >
          {{ saved ? "Saved" : "Save mapping" }}
        </button>
      </header>

      <section
        class="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <h2 class="font-semibold text-slate-900">1. เพิ่มข้อมูลต้นทาง</h2>
        <p class="mt-1 text-sm text-slate-500">
          Upload source data หรือ config เดิมเพื่อแก้ไขต่อ
        </p>
        <div class="mt-4 grid gap-3 sm:grid-cols-3">
          <label
            class="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >Upload data<input
              class="hidden"
              type="file"
              accept="application/json,.json"
              @change="loadFile($event, 'data')" /></label
          ><label
            class="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >Upload config<input
              class="hidden"
              type="file"
              accept="application/json,.json"
              @change="loadFile($event, 'config')" /></label
          ><button
            class="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            type="button"
            @click="
              editor.clear();
              manualData = '';
            "
          >
            Clear all data
          </button>
        </div>
        <p
          v-if="editor.message.value"
          class="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          {{ editor.message.value }}
        </p>
        <p
          v-if="editor.error.value"
          class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {{ editor.error.value }}
        </p>
        <label class="mt-5 grid gap-2 text-sm font-semibold text-slate-700"
          >หรือเขียน JSON เอง<textarea
            v-model="manualData"
            rows="5"
            class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs font-normal leading-6 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
            placeholder='{ "programGroup": "TITLE_LOAN" }'
          ></textarea></label
        ><button
          class="mt-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
          type="button"
          @click="applyManualData"
        >
          Apply JSON
        </button>
      </section>

      <section
        class="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
      >
        <div class="mb-2 flex justify-between text-sm">
          <strong
            >{{ editor.rules.value.length }} of
            {{ editor.fields.value.length }} fields mapped</strong
          ><span class="font-bold text-blue-600"
            >{{ editor.progress.value }}%</span
          >
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-slate-100">
          <span
            class="block h-full bg-blue-600"
            :style="{ width: `${editor.progress.value}%` }"
          />
        </div>
      </section>

      <section class="grid gap-6 xl:grid-cols-3">
        <SourceFieldList
          :fields="editor.visibleFields.value"
          :selected-path="editor.selected.value?.path"
          :mapped-sources="editor.mappedSources.value"
          :search="editor.search.value"
          @select="editor.select"
          @update:search="editor.search.value = $event"
        /><MappingEditor
          :selected="editor.selected.value"
          :target-path="editor.targetPath.value"
          :rules="editor.rules.value"
          @update:target-path="editor.targetPath.value = $event"
          @add="
            editor.addRule();
            saved = false;
          "
          @remove="
            editor.removeRule($event);
            saved = false;
          "
          @reorder="reorderRules"
        />
        <div class="grid gap-6">
          <JsonPanel
            title="Preview output"
            description="ผลลัพธ์จากข้อมูลต้นทางจริง"
            :data="editor.output.value"
            filename="mapping-output.json"
          /><JsonPanel
            title="Mapping config"
            description="config สำหรับนำกลับมาใช้หรือส่งให้ระบบอื่น"
            :data="editor.config.value"
            filename="mapping-config.json"
          />
          <p
            v-if="editor.missingRules.value.length"
            class="rounded-xl bg-amber-50 p-3 text-sm text-amber-800"
          >
            {{ editor.missingRules.value.length }} config paths not found in the
            loaded source data
          </p>
        </div>
      </section>
    </div>
  </main>
</template>
