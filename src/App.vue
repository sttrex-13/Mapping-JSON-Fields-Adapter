<script setup lang="ts">
import { computed, ref } from "vue";

type DataType = "string" | "number" | "boolean" | "date" | "object" | "array";
type SourceField = { path: string; label: string; type: DataType };
type Rule = { id: number; source: string; target: string; dataType: DataType };

const defaultValues: Record<string, unknown> = {};
const defaultFields: SourceField[] = [];
const fields = ref<SourceField[]>(defaultFields);
const sourceValues = ref<Record<string, unknown>>({ ...defaultValues });
const rules = ref<Rule[]>([]);
const sourceSearch = ref("");
const selected = ref<SourceField | null>(null);
const targetPath = ref("");
const targetType = ref<DataType>("string");
const draggingId = ref<number | null>(null);
const uploadMessage = ref("");
const uploadError = ref("");
const configMessage = ref("");
const configError = ref("");
const manualData = ref("");
const saved = ref(false);
const dataTypes: DataType[] = [
  "string",
  "number",
  "boolean",
  "date",
  "object",
  "array",
];

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
const outputPreview = computed(() => JSON.stringify(buildOutput(), null, 2));
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

    if (
      value.every(
        (item) =>
          typeof item === "object" && item !== null && !Array.isArray(item),
      )
    ) {
      const keys = new Set<string>();
      value.forEach((item) =>
        Object.keys(item as Record<string, unknown>).forEach((key) =>
          keys.add(key),
        ),
      );

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
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) =>
      flatten(child, path ? `${path}.${key}` : key, output, values),
    );
    return { output, values };
  }

  output.push({ path, label: labelFor(path), type: inferType(value) });
  values[path] = value;
  return { output, values };
}
function applyParsedData(parsed: unknown, sourceLabel: string) {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new Error("Top-level JSON must be an object");
  const { output, values } = flatten(parsed);
  if (!output.length) throw new Error("No fields found in this JSON data");
  fields.value = output;
  sourceValues.value = values;
  selected.value = output[0] ?? null;
  if (selected.value) {
    targetPath.value = "";
    targetType.value = selected.value.type;
  } else {
    targetPath.value = "";
    targetType.value = "string";
  }
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
        ? `Cannot parse written data: ${error.message}`
        : "Cannot parse this JSON data";
  }
}
async function importJson(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  uploadError.value = "";
  try {
    const parsed = JSON.parse(await file.text());
    applyParsedData(parsed, file.name);
    manualData.value = JSON.stringify(parsed, null, 2);
  } catch (error) {
    uploadError.value =
      error instanceof Error
        ? `Cannot import JSON: ${error.message}`
        : "Cannot import this JSON file";
  } finally {
    input.value = "";
  }
}
async function importConfig(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  configError.value = "";
  try {
    const parsed = JSON.parse(await file.text());
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      throw new Error("Config must be a JSON object");
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (
      !entries.length ||
      entries.some(([, target]) => typeof target !== "string" || !target.trim())
    )
      throw new Error("Every config value must be a target path string");
    const types = new Map(
      fields.value.map((field) => [field.path, field.type]),
    );
    rules.value = entries.map(([source, target], index) => ({
      id: Date.now() + index,
      source,
      target: target as string,
      dataType: types.get(source) ?? "string",
    }));
    configMessage.value = `${file.name}: loaded ${entries.length} mapping rules`;
    saved.value = false;
  } catch (error) {
    configError.value =
      error instanceof Error
        ? `Cannot import config: ${error.message}`
        : "Cannot import this config file";
  } finally {
    input.value = "";
  }
}
function pick(field: SourceField) {
  selected.value = field;
  const existingRule = rules.value.find((rule) => rule.source === field.path);
  targetPath.value = existingRule?.target ?? "";
  targetType.value = existingRule?.dataType ?? field.type;
}
function addRule() {
  if (!selected.value || !targetPath.value.trim()) return;
  rules.value = rules.value.filter(
    (rule) => rule.source !== selected.value!.path,
  );
  rules.value.push({
    id: Date.now(),
    source: selected.value.path,
    target: targetPath.value.trim(),
    dataType: targetType.value,
  });
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
function cast(value: unknown, type: DataType): unknown {
  if (Array.isArray(value))
    return value.map((item) =>
      cast(item, type === "array" ? inferType(item) : type),
    );
  if (type === "number") return Number(value);
  if (type === "boolean")
    return value === true || value === "true" || value === 1 || value === "1";
  if (type === "string" || type === "date") return String(value);
  if (type === "object") {
    if (value === null || value === undefined) return {};
    if (typeof value === "object") return value;
    return { value };
  }
  if (type === "array") return Array.isArray(value) ? value : [value];
  return value;
}
function assignTargetValue(
  output: Record<string, unknown>,
  target: string,
  value: unknown,
) {
  if (!target.includes("[]")) {
    const parts = target.split(".").filter(Boolean);
    let cursor = output;
    for (const [index, part] of parts.entries()) {
      if (index === parts.length - 1) cursor[part] = value;
      else cursor = (cursor[part] ||= {}) as Record<string, unknown>;
    }
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
  for (const part of before)
    cursor = (cursor[part] ||= {}) as Record<string, unknown>;

  const entries = Array.isArray(value) ? value : [value];
  const list = (cursor[arrayKey] ||= []) as Record<string, unknown>[];
  entries.forEach((entry, index) => {
    if (
      !list[index] ||
      typeof list[index] !== "object" ||
      Array.isArray(list[index])
    )
      list[index] = {};
    if (!after.length) {
      list[index] = entry as Record<string, unknown>;
      return;
    }
    let itemCursor = list[index] as Record<string, unknown>;
    for (const [itemIndex, part] of after.entries()) {
      if (itemIndex === after.length - 1) itemCursor[part] = entry;
      else itemCursor = (itemCursor[part] ||= {}) as Record<string, unknown>;
    }
  });
}

function buildOutput() {
  const output: Record<string, unknown> = {};
  for (const rule of rules.value) {
    if (!Object.prototype.hasOwnProperty.call(sourceValues.value, rule.source))
      continue;
    assignTargetValue(
      output,
      rule.target,
      cast(sourceValues.value[rule.source], rule.dataType),
    );
  }
  return output;
}
function clearData() {
  fields.value = [];
  sourceValues.value = {};
  rules.value = [];
  sourceSearch.value = "";
  selected.value = null;
  targetPath.value = "";
  targetType.value = "string";
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
  <main class="app-shell">
    <header class="app-header">
      <div>
        <p class="eyebrow">PROGRAM CONFIGURATION</p>
        <h1>Field mapping</h1>
        <p class="subtitle">
          อัปโหลด JSON หรือพิมพ์ JSON เอง แล้วเลือก field เพื่อสร้าง output
          ที่ต้องการ
        </p>
      </div>
      <button class="primary-button" type="button" @click="save">
        {{ saved ? "Saved" : "Save mapping" }}
      </button>
    </header>
    <section class="import-row">
      <div class="import-copy">
        <strong>Import files</strong>
        <p>
          อัปโหลด data ก่อน แล้วอัปโหลด config เพื่อสร้าง mapping ตามไฟล์
          หรือแก้ mapping ต่อเองได้
        </p>
      </div>
      <label class="upload-button"
        >1. Upload data<input
          type="file"
          accept="application/json,.json"
          @change="importJson" /></label
      ><label class="upload-button"
        >2. Upload config<input
          type="file"
          accept="application/json,.json"
          @change="importConfig" /></label
      ><button class="primary-button" type="button" @click="clearData">
        Clear data
      </button>
      <div class="import-status">
        <span v-if="uploadMessage" class="success">{{ uploadMessage }}</span
        ><span v-if="configMessage" class="success">{{ configMessage }}</span
        ><span v-if="uploadError" class="error">{{ uploadError }}</span
        ><span v-if="configError" class="error">{{ configError }}</span>
      </div>
    </section>
    <section class="manual-json">
      <label class="manual-editor"
        ><span>หรือเขียน JSON เอง</span
        ><textarea
          v-model="manualData"
          rows="10"
          placeholder='{ "programGroup": "TITLE", "basicInformation": { "programCode": "Program_01" } }'
        ></textarea>
      </label>
      <div class="manual-actions">
        <button class="primary-button" type="button" @click="applyManualData">
          Apply JSON</button
        ><button class="primary-button" type="button" @click="clearData">
          Clear
        </button>
      </div>
    </section>
    <section class="progress-row" aria-label="Mapping progress">
      <strong>{{ rules.length }} of {{ fields.length }} fields mapped</strong>
      <div class="progress-track">
        <span :style="{ width: `${progress}%` }" />
      </div>
      <span>{{ progress }}%</span>
    </section>
    <section class="workspace">
      <aside class="source-panel panel">
        <div class="panel-heading">
          <h2>1. เลือก field ต้นทาง</h2>
          <p>คลิก field ที่ต้องการ map</p>
        </div>
        <label class="sr-only" for="source-search">Search source fields</label
        ><input
          id="source-search"
          v-model="sourceSearch"
          class="search"
          placeholder="Search fields"
        />
        <ul class="source-list">
          <li v-for="field in visibleFields" :key="field.path">
            <button
              :class="[
                'source-item',
                { selected: selected?.path === field.path },
              ]"
              type="button"
              @click="pick(field)"
            >
              <span>{{ field.label }}</span
              ><small
                >{{ field.type
                }}<template v-if="mappedSources.has(field.path)"
                  ><span class="mapped-indicator"> ✓ mapped</span></template
                ></small
              ><code>{{ field.path }}</code>
            </button>
          </li>
        </ul>
      </aside>
      <section class="editor-panel panel">
        <div class="panel-heading">
          <h2>2. กำหนด output</h2>
          <p>แก้ชื่อปลายทางและชนิดข้อมูลก่อนเพิ่ม</p>
        </div>
        <div class="selection-card">
          <span class="label">Source field</span
          ><code>{{ selected?.path ?? "No field selected" }}</code
          ><span v-if="selected" class="type-badge">{{ selected.type }}</span>
        </div>
        <div class="form-grid">
          <label class="label" for="target-path"
            >Target path<input
              id="target-path"
              v-model="targetPath"
              class="target-input"
              placeholder="e.g. amount.min or fieldCheck.details[].checkType" /></label
          ><label class="label" for="target-type"
            >Output type<select id="target-type" v-model="targetType">
              <option v-for="type in dataTypes" :key="type" :value="type">
                {{ type }}
              </option>
            </select></label
          >
        </div>
        <p class="helper">
          เลือก type เพื่อ convert ค่า เช่น string → number ก่อนสร้าง output
        </p>
        <button
          class="primary-button add-button"
          type="button"
          :disabled="!selected || !targetPath.trim()"
          @click="addRule"
        >
          Add mapping
        </button>
        <div class="rules-heading">
          <div>
            <h2>Mapping ที่เพิ่มแล้ว</h2>
            <p>ลากแถวเพื่อเรียง key ใน output JSON</p>
          </div>
          <span>{{ rules.length }}</span>
        </div>
        <ul class="rule-list">
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
            <span class="drag-handle" aria-hidden="true">⠿</span
            ><code>{{ rule.source }}</code
            ><span>→</span><code>{{ rule.target }}</code
            ><small>{{ rule.dataType }}</small
            ><button
              class="remove-button"
              type="button"
              :aria-label="`Remove ${rule.source}`"
              @click="removeRule(rule.id)"
            >
              ×
            </button>
          </li>
        </ul>
      </section>
      <aside class="preview-panel panel">
        <div class="panel-heading">
          <h2>3. Preview output</h2>
          <p>ลำดับ JSON เปลี่ยนตาม mapping ที่ลากเรียงไว้</p>
        </div>
        <div v-if="missingRules.length" class="config-warning">
          <strong
            >{{ missingRules.length }} config paths not found in data</strong
          ><code v-for="rule in missingRules.slice(0, 3)" :key="rule.id">{{
            rule.source
          }}</code>
        </div>
        <pre>{{ outputPreview }}</pre>
      </aside>
    </section>
  </main>
</template>
