import { computed, ref } from "vue";
import {
  buildOutput,
  flattenSourceData,
  parseMappingConfig,
  reorderRules,
  rulesFromConfig,
  type MappingRule,
  type SourceField,
  toMappingConfig,
} from "../domain/mapping";

export function useMappingEditor() {
  const fields = ref<SourceField[]>([]);
  const values = ref<Record<string, unknown>>({});
  const rules = ref<MappingRule[]>([]);
  const selected = ref<SourceField | null>(null);
  const search = ref("");
  const targetPath = ref("");
  const message = ref("");
  const error = ref("");

  const visibleFields = computed(() => {
    const query = search.value.trim().toLowerCase();
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
  const output = computed(() => buildOutput(rules.value, values.value));
  const config = computed(() => toMappingConfig(rules.value));
  const missingRules = computed(() =>
    rules.value.filter(
      (rule) =>
        !Object.prototype.hasOwnProperty.call(values.value, rule.source),
    ),
  );

  const select = (field: SourceField) => {
    selected.value = field;
    targetPath.value =
      rules.value.find((rule) => rule.source === field.path)?.target ?? "";
  };

  const addRule = () => {
    if (!selected.value || !targetPath.value.trim()) return;
    const rule: MappingRule = {
      id: crypto.randomUUID(),
      source: selected.value.path,
      target: targetPath.value.trim(),
    };
    rules.value = [
      ...rules.value.filter((current) => current.source !== rule.source),
      rule,
    ];
  };

  const removeRule = (id: string) => {
    rules.value = rules.value.filter((rule) => rule.id !== id);
  };
  const reorder = (fromId: string, targetId: string) => {
    rules.value = reorderRules(rules.value, fromId, targetId);
  };

  const loadData = (data: unknown, label: string) => {
    if (typeof data !== "object" || data === null || Array.isArray(data))
      throw new Error("Top-level JSON must be an object");
    const flattened = flattenSourceData(data as Record<string, unknown>);
    if (!flattened.fields.length)
      throw new Error("No fields found in this JSON data");
    fields.value = flattened.fields;
    values.value = flattened.values;
    selected.value = flattened.fields[0] ?? null;
    targetPath.value = "";
    message.value = `${label}: found ${flattened.fields.length} fields`;
    error.value = "";
  };

  const loadConfig = (data: unknown, label: string) => {
    rules.value = rulesFromConfig(parseMappingConfig(data));
    message.value = `${label}: loaded ${rules.value.length} mapping rules`;
    error.value = "";
  };

  const clear = () => {
    fields.value = [];
    values.value = {};
    rules.value = [];
    selected.value = null;
    search.value = "";
    targetPath.value = "";
    message.value = "";
    error.value = "";
  };

  return {
    fields,
    rules,
    selected,
    search,
    targetPath,
    message,
    error,
    visibleFields,
    mappedSources,
    progress,
    output,
    config,
    missingRules,
    select,
    addRule,
    removeRule,
    reorder,
    loadData,
    loadConfig,
    clear,
  };
}
