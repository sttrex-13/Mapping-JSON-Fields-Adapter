<script setup lang="ts">
import { computed, ref } from "vue";
import { highlightJson } from "./highlight-json";

type DataType = "string" | "number" | "boolean" | "date" | "object" | "array";
type TargetMode = "value" | "array";

type SourceField = {
  path: string;
  label: string;
  type: DataType;
};

type Rule = {
  id: number;
  source: string;
  target: string;
};

const fields = ref<SourceField[]>([]);
const sourceValues = ref<Record<string, unknown>>({});
const rules = ref<Rule[]>([]);

const sourceSearch = ref("");
const selected = ref<SourceField | null>(null);
const targetPath = ref("");
const targetMode = ref<TargetMode>("value");
const segmentName = ref("");
const draggingId = ref<number | null>(null);
const manualData = ref("");
const uploadMessage = ref("");
const uploadError = ref("");
const configMessage = ref("");
const configError = ref("");
const saved = ref(false);

const visibleFields = computed(() => {
  const query = sourceSearch.value.trim().toLowerCase();
  return query
    ? fields.value.filter((field) => field.path.toLowerCase().includes(query))
    : fields.value;
});

const mappedSources = computed(
  () => new Set(rules.value.map((rule) => rule.source)),
);

const progress = computed(() =>
  fields.value.length
    ? Math.round((rules.value.length / fields.value.length) * 100)
    : 0,
);

const resolvedTargetPath = computed(() => {
  const parentPath = targetPath.value.trim().replace(/\.$/, "");
  const childPath = segmentName.value.trim().replace(/^\.+|\.+$/g, "");

  if (!parentPath) return "";
  if (targetMode.value === "value") return parentPath;
  return childPath ? `${parentPath}[].${childPath}` : "";
});

const canAddRule = computed(() =>
  Boolean(selected.value && resolvedTargetPath.value),
);
const outputPreview = computed(() => highlightJson(buildOutput()));
const missingRules = computed(() =>
  rules.value.filter(
    (rule) =>
      !Object.prototype.hasOwnProperty.call(sourceValues.value, rule.source),
  ),
);

function inferType(value: unknown): DataType {
  if (Array.isArray(value)) return "array";
  if (value === null) return "object";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "object") return "object";
  return "string";
}

function labelFor(path: string) {
  const segments = path.split(".");
  return (segments[segments.length - 1] || path).replace("[]", "");
}

function flatten(
  value: unknown,
  path = "",
  output: SourceField[] = [],
  values: Record<string, unknown> = {},
) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      output.push({ path, label: labelFor(path), type: "array" });
      values[path] = value;
      return { output, values };
    }

    const isObjectArray = value.every(
      (item) =>
        typeof item === "object" && item !== null && !Array.isArray(item),
    );

    if (isObjectArray) {
      const keys = new Set<string>();
      value.forEach((item) => {
        Object.keys(item as Record<string, unknown>).forEach((key) =>
          keys.add(key),
        );
      });

      keys.forEach((key) => {
        const childPath = path.includes("[].")
          ? `${path}.${key}`
          : `${path}[].${key}`;
        const childValues = value.map(
          (item) => (item as Record<string, unknown>)[key],
        );

        if (
          childValues.some(
            (item) =>
              typeof item === "object" && item !== null && !Array.isArray(item),
          )
        ) {
          flatten(childValues, childPath, output, values);
          return;
        }

        output.push({
          path: childPath,
          label: labelFor(childPath),
          type: inferType(childValues[0]),
        });
        values[childPath] = childValues;
      });
      return { output, values };
    }

    output.push({ path, label: labelFor(path), type: "array" });
    values[path] = value;
    return { output, values };
  }

  if (typeof value === "object" && value !== null) {
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      flatten(child, path ? `${path}.${key}` : key, output, values);
    });
    return { output, values };
  }

  output.push({ path, label: labelFor(path), type: inferType(value) });
  values[path] = value;
  return { output, values };
}

function resetTargetEditor() {
  targetPath.value = "";
  targetMode.value = "value";
  segmentName.value = "";
}

function applyParsedData(parsed: unknown, sourceLabel: string) {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Top-level JSON must be an object");
  }

  const { output, values } = flatten(parsed);
  if (!output.length) throw new Error("No fields found in this JSON data");

  fields.value = output;
  sourceValues.value = values;
  selected.value = output[0] ?? null;
  resetTargetEditor();
  uploadMessage.value = `${sourceLabel}: found ${output.length} fields`;
  uploadError.value = "";
  configMessage.value = "";
  configError.value = "";
  saved.value = false;
}

function applyManualData() {
  const trimmed = manualData.value.trim();
  if (!trimmed) {
    uploadError.value = "Please enter JSON data before applying it.";
    return;
  }

  try {
    const parsed = JSON.parse(trimmed);
    applyParsedData(parsed, "Manual data");
    manualData.value = JSON.stringify(parsed, null, 2);
  } catch (error) {
    uploadError.value =
      error instanceof Error
        ? `Cannot parse JSON: ${error.message}`
        : "Cannot parse JSON";
  }
}

async function importJson(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    applyParsedData(parsed, file.name);
    manualData.value = JSON.stringify(parsed, null, 2);
  } catch (error) {
    uploadError.value =
      error instanceof Error
        ? `Cannot import JSON: ${error.message}`
        : "Cannot import JSON";
  } finally {
    input.value = "";
  }
}

async function importConfig(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error("Config must be a JSON object");
    }

    const entries = Object.entries(parsed as Record<string, unknown>);
    if (
      !entries.length ||
      entries.some(([, target]) => typeof target !== "string" || !target.trim())
    ) {
      throw new Error("Every config value must be a target path string");
    }

    rules.value = entries.map(([source, target], index) => ({
      id: Date.now() + index,
      source,
      target: target as string,
    }));
    configMessage.value = `${file.name}: loaded ${entries.length} mapping rules`;
    configError.value = "";
    saved.value = false;
  } catch (error) {
    configError.value =
      error instanceof Error
        ? `Cannot import config: ${error.message}`
        : "Cannot import config";
  } finally {
    input.value = "";
  }
}

function pick(field: SourceField) {
  selected.value = field;
  const existingTarget =
    rules.value.find((rule) => rule.source === field.path)?.target ?? "";
  const arrayIndex = existingTarget.indexOf("[]");

  if (arrayIndex >= 0) {
    targetMode.value = "array";
    targetPath.value = existingTarget.slice(0, arrayIndex).replace(/\.$/, "");
    segmentName.value = existingTarget.slice(arrayIndex + 2).replace(/^\./, "");
    return;
  }

  targetMode.value = "value";
  targetPath.value = existingTarget;
  segmentName.value = "";
}

function addRule() {
  const target = resolvedTargetPath.value;
  if (!selected.value || !target) return;

  rules.value = rules.value.filter(
    (rule) => rule.source !== selected.value!.path,
  );
  rules.value.push({ id: Date.now(), source: selected.value.path, target });
  saved.value = false;
}

function removeRule(id: number) {
  rules.value = rules.value.filter((rule) => rule.id !== id);
  saved.value = false;
}

function startDrag(id: number) {
  draggingId.value = id;
}

function dropRule(targetId: number) {
  const fromId = draggingId.value;
  if (fromId === null || fromId === targetId) return;

  const fromIndex = rules.value.findIndex((rule) => rule.id === fromId);
  const targetIndex = rules.value.findIndex((rule) => rule.id === targetId);
  if (fromIndex < 0 || targetIndex < 0) return;

  const [moved] = rules.value.splice(fromIndex, 1);
  rules.value.splice(targetIndex, 0, moved);
  draggingId.value = null;
  saved.value = false;
}

function assignTargetValue(
  output: Record<string, unknown>,
  target: string,
  value: unknown,
) {
  if (!target.includes("[]")) {
    const parts = target.split(".").filter(Boolean);
    let cursor = output;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) cursor[part] = value;
      else cursor = (cursor[part] ||= {}) as Record<string, unknown>;
    });
    return;
  }

  const arrayMarker = target.indexOf("[]");
  const before = target.slice(0, arrayMarker).split(".").filter(Boolean);
  const after = target
    .slice(arrayMarker + 2)
    .split(".")
    .filter(Boolean);
  const arrayKey = before.pop();
  if (!arrayKey) return;

  let cursor = output;
  before.forEach((part) => {
    cursor = (cursor[part] ||= {}) as Record<string, unknown>;
  });

  const entries = Array.isArray(value) ? value : [value];
  const list = (cursor[arrayKey] ||= []) as Record<string, unknown>[];

  entries.forEach((entry, index) => {
    if (
      !list[index] ||
      typeof list[index] !== "object" ||
      Array.isArray(list[index])
    ) {
      list[index] = {};
    }

    let itemCursor = list[index];
    after.forEach((part, itemIndex) => {
      if (itemIndex === after.length - 1) itemCursor[part] = entry;
      else itemCursor = (itemCursor[part] ||= {}) as Record<string, unknown>;
    });
  });
}

function buildOutput() {
  const output: Record<string, unknown> = {};
  rules.value.forEach((rule) => {
    if (Object.prototype.hasOwnProperty.call(sourceValues.value, rule.source)) {
      assignTargetValue(output, rule.target, sourceValues.value[rule.source]);
    }
  });
  return output;
}

function clearData() {
  fields.value = [];
  sourceValues.value = {};
  rules.value = [];
  sourceSearch.value = "";
  selected.value = null;
  resetTargetEditor();
  manualData.value = "";
  uploadMessage.value = "";
  uploadError.value = "";
  configMessage.value = "";
  configError.value = "";
  saved.value = false;
}

function save() {
  saved.value = true;
}
</script>

<template>
  <main
    class="min-h-screen bg-slate-50 px-4 py-6 text-slate-800 sm:px-6 lg:px-8"
  >
    <div class="mx-auto max-w-full">
      <header
        class="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-7"
      >
        <div>
          <p
            class="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-blue-600"
          >
            Program configuration
          </p>
          <h1
            class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
          >
            Field mapping
          </h1>
          <p class="mt-2 text-sm text-slate-500">
            อัปโหลด JSON เลือกข้อมูลต้นทาง แล้วสร้างโครงสร้าง output
            ได้อย่างเป็นขั้นตอน
          </p>
        </div>
        <button
          class="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
          type="button"
          @click="save"
        >
          {{ saved ? "Saved" : "Save mapping" }}
        </button>
      </header>

      <section
        class="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div class="mb-5 flex items-start gap-3">
          <span
            class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-sm font-bold text-blue-600"
            >1</span
          >
          <div>
            <h2 class="font-semibold text-slate-900">เพิ่มข้อมูลต้นทาง</h2>
            <p class="mt-1 text-sm text-slate-500">
              เริ่มจาก upload ไฟล์ JSON หรือวาง JSON ลงในช่องด้านล่าง
            </p>
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-3">
          <label
            class="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:border-blue-500 hover:bg-blue-100"
            >Upload data<input
              class="hidden"
              type="file"
              accept="application/json,.json"
              @change="importJson"
          /></label>
          <label
            class="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
            >Upload config<input
              class="hidden"
              type="file"
              accept="application/json,.json"
              @change="importConfig"
          /></label>
          <button
            class="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            type="button"
            @click="clearData"
          >
            Clear all data
          </button>
        </div>
        <div
          v-if="uploadMessage || configMessage || uploadError || configError"
          class="mt-4 grid gap-2 text-sm"
        >
          <p
            v-if="uploadMessage"
            class="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700"
          >
            {{ uploadMessage }}
          </p>
          <p
            v-if="configMessage"
            class="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700"
          >
            {{ configMessage }}
          </p>
          <p
            v-if="uploadError"
            class="rounded-lg bg-red-50 px-3 py-2 text-red-700"
          >
            {{ uploadError }}
          </p>
          <p
            v-if="configError"
            class="rounded-lg bg-red-50 px-3 py-2 text-red-700"
          >
            {{ configError }}
          </p>
        </div>
      </section>

      <section
        class="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end">
          <label class="grid flex-1 gap-2 text-sm font-semibold text-slate-700"
            >หรือเขียน JSON เอง<textarea
              v-model="manualData"
              rows="6"
              class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs font-normal leading-6 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
              placeholder='{ "programGroup": "TITLE", "basicInformation": { "programCode": "Program_01" } }'
            ></textarea></label
          >
        </div>
        <div class="mt-4 flex flex-row gap-4  ">
          <button
            class="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
            type="button"
            @click="applyManualData"
          >
            Apply JSON
          </button>
          <button
            class="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
            type="button"
            @click="clearData"
          >
            Clear all data
          </button>
        </div>
      </section>

      <section
        class="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:px-6"
      >
        <div class="mb-2 flex items-center justify-between text-sm">
          <strong class="text-slate-800"
            >{{ rules.length }} of {{ fields.length }} fields mapped</strong
          ><span class="font-bold text-blue-600">{{ progress }}%</span>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-slate-100">
          <span
            class="block h-full rounded-full bg-blue-600 transition-all"
            :style="{ width: `${progress}%` }"
          />
        </div>
      </section>

      <section
        class="grid gap-6 xl:grid-cols-[minmax(230px,0.8fr)_minmax(390px,1.3fr)_minmax(280px,1fr)]" 
      >
        <aside
          class="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div class="mb-4">
            <div class="flex items-center gap-3">
              <span
                class="grid h-7 w-7 place-items-center rounded-lg bg-violet-50 text-xs font-bold text-violet-700"
                >2</span
              >
              <h2 class="font-semibold text-slate-900">เลือก field ต้นทาง</h2>
            </div>
            <p class="mt-2 text-sm text-slate-500">คลิก field ที่ต้องการ map</p>
          </div>
          <input
            v-model="sourceSearch"
            class="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
            placeholder="Search fields"
          />
          <ul class="grid max-h-200 gap-2 overflow-auto pr-1">
            <li v-for="field in visibleFields" :key="field.path">
              <button
                :class="[
                  'w-full rounded-xl border p-3 text-left transition',
                  selected?.path === field.path
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                ]"
                type="button"
                @click="pick(field)"
              >
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center justify-between gap-2">
                    <span
                      class="truncate text-sm font-semibold text-slate-700"
                      >{{ field.label }}</span
                    >
                    <span
                      v-if="mappedSources.has(field.path)"
                      class="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
                      >Mapped</span
                    >
                  </div>
                  <div class="flex items-center justify-between gap-2">
                    <code class="min-w-0 truncate text-xs text-slate-700">{{
                      field.path
                    }}</code>
                    <span
                      class="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700"
                      >{{ field.type }}</span
                    >
                  </div>
                </div>
              </button>
            </li>
          </ul>
        </aside>

        <section
          class="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm w-"
        >
          <div class="mb-5">
            <div class="flex items-center gap-3">
              <span
                class="grid h-7 w-7 place-items-center rounded-lg bg-amber-50 text-xs font-bold text-amber-700"
                >3</span
              >
              <h2 class="font-semibold text-slate-900">กำหนด output</h2>
            </div>
            <p class="mt-2 text-sm text-slate-500">
              สร้าง path ปลายทาง หรือเลือก Array เพื่อเพิ่ม segment
              ในแต่ละรายการ
            </p>
          </div>
          <div class="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div class="mb-2 flex items-center justify-between">
              <span
                class="text-xs font-bold uppercase tracking-wide text-slate-500"
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
            <label
              class="grid gap-2 text-sm font-semibold text-slate-700"
              for="target-path"
              >Target path<input
                id="target-path"
                v-model="targetPath"
                class="rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                placeholder="e.g. amount.min or fieldCheck.details"
            /></label>
            <fieldset>
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
                    v-model="targetMode"
                    class="sr-only"
                    type="radio"
                    value="value"
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
                    v-model="targetMode"
                    class="sr-only"
                    type="radio"
                    value="array"
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
              for="segment-name"
              >Segment name<input
                id="segment-name"
                v-model="segmentName"
                class="rounded-lg border border-violet-200 bg-white px-3 py-2.5 font-normal outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                placeholder="e.g. checkType or personal.firstName"
              /><span class="text-xs font-normal text-slate-500"
                >ชื่อ property ที่อยู่ในแต่ละ item ของ array</span
              ></label
            >
            <div
              v-if="resolvedTargetPath"
              class="rounded-xl border border-blue-100 bg-blue-50 p-3"
            >
              <p
                class="text-xs font-bold uppercase tracking-wide text-blue-600"
              >
                Output path preview
              </p>
              <code class="mt-1 block break-all text-sm text-blue-900">{{
                resolvedTargetPath
              }}</code>
            </div>
          </div>

          <button
            class="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            :disabled="!canAddRule"
            @click="addRule"
          >
            Add mapping
          </button>

          <div class="mb-3 mt-7 flex items-start justify-between">
            <div>
              <h2 class="font-semibold text-slate-900">Mapping ที่เพิ่มแล้ว</h2>
              <p class="mt-1 text-sm text-slate-500">
                ลากแถวเพื่อเรียง key ใน output JSON
              </p>
            </div>
            <span
              class="grid h-7 min-w-7 place-items-center rounded-full bg-slate-100 px-2 text-xs font-bold text-slate-600"
              >{{ rules.length }}</span
            >
          </div>
          <ul class="grid max-h-104 gap-2 overflow-auto pr-1">
            <li
              v-for="rule in rules"
              :key="rule.id"
              draggable="true"
              :class="{ dragging: draggingId === rule.id }"
              @dragstart="startDrag(rule.id)"
              @dragend="draggingId = null"
              @dragover.prevent
              @drop="dropRule(rule.id)"
            >
              <div
                :class="[
                  'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border p-3',
                  draggingId === rule.id
                    ? 'border-blue-300 bg-blue-50 opacity-60'
                    : 'border-slate-200 bg-white',
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
                  class="grid h-7 w-7 place-items-center rounded-lg text-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  type="button"
                  :aria-label="`Remove ${rule.source}`"
                  @click="removeRule(rule.id)"
                >
                </button>
              </div>
            </li>
          </ul>
        </section>

        <aside
          class="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div class="mb-4 flex items-center gap-3">
            <span
              class="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 text-xs font-bold text-emerald-700"
              >4</span
            >
            <div>
              <h2 class="font-semibold text-slate-900">Preview output</h2>
              <p class="mt-1 text-sm text-slate-500">ตรวจผลลัพธ์ก่อนบันทึก</p>
            </div>
          </div>
          <div
            v-if="missingRules.length"
            class="mb-3 grid gap-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"
          >
            <strong>{{ missingRules.length }} config paths not found</strong
            ><code
              v-for="rule in missingRules.slice(0, 3)"
              :key="rule.id"
              class="text-xs"
              >{{ rule.source }}</code
            >
          </div>
          <pre
            class="min-h-105 max-h-220 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100"
            v-html="outputPreview"
          ></pre
          >
        </aside>
      </section>
    </div>
  </main>
</template>
