export type DataType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "object"
  | "array";

export type SourceField = { path: string; label: string; type: DataType };
export type MappingRule = { id: string; source: string; target: string };
export type MappingConfig = Record<string, string>;
export type FlattenedSource = {
  fields: SourceField[];
  values: Record<string, unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const inferType = (value: unknown): DataType => {
  if (Array.isArray(value)) return "array";
  if (value === null || isRecord(value)) return "object";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "string";
};

export const labelFor = (path: string) =>
  (path.split(".").slice(-1)[0] || path).replace("[]", "");

export function flattenSourceData(
  data: Record<string, unknown>,
): FlattenedSource {
  const fields: SourceField[] = [];
  const values: Record<string, unknown> = {};

  const visit = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      if (value.length === 0 || !value.every(isRecord)) {
        fields.push({ path, label: labelFor(path), type: "array" });
        values[path] = value;
        return;
      }

      const keys = [...new Set(value.flatMap(Object.keys))];
      keys.forEach((key) => {
        const childPath = path.includes("[].")
          ? `${path}.${key}`
          : `${path}[].${key}`;
        const childValues = value.map((item) => item[key]);
        if (childValues.some((item) => isRecord(item) || Array.isArray(item))) {
          visit(childValues, childPath);
          return;
        }
        fields.push({
          path: childPath,
          label: labelFor(childPath),
          type: inferType(childValues[0]),
        });
        values[childPath] = childValues;
      });
      return;
    }

    if (isRecord(value)) {
      Object.entries(value).forEach(([key, child]) =>
        visit(child, path ? `${path}.${key}` : key),
      );
      return;
    }

    fields.push({ path, label: labelFor(path), type: inferType(value) });
    values[path] = value;
  };

  visit(data, "");
  return { fields, values };
}

export const toMappingConfig = (rules: MappingRule[]): MappingConfig =>
  rules.reduce<MappingConfig>(
    (config, rule) => ({ ...config, [rule.source]: rule.target }),
    {},
  );

export function parseMappingConfig(value: unknown): MappingConfig {
  if (!isRecord(value)) throw new Error("Config must be a JSON object");
  const entries = Object.entries(value);
  if (
    !entries.length ||
    entries.some(([, target]) => typeof target !== "string" || !target.trim())
  ) {
    throw new Error("Every config value must be a target path string");
  }
  return Object.fromEntries(entries) as MappingConfig;
}

export const rulesFromConfig = (config: MappingConfig): MappingRule[] =>
  Object.entries(config).map(([source, target]) => ({
    id: crypto.randomUUID(),
    source,
    target,
  }));

export const reorderRules = (
  rules: MappingRule[],
  fromId: string,
  targetId: string,
): MappingRule[] => {
  const from = rules.findIndex((rule) => rule.id === fromId);
  const to = rules.findIndex((rule) => rule.id === targetId);
  if (from < 0 || to < 0 || from === to) return rules;
  const next = [...rules];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

const setAtPath = (
  target: Record<string, unknown>,
  parts: string[],
  value: unknown,
): void => {
  const [key, ...rest] = parts;
  if (!key) return;
  if (!rest.length) {
    target[key] = value;
    return;
  }
  const next = isRecord(target[key]) ? target[key] : {};
  target[key] = next;
  setAtPath(next, rest, value);
};

const assignTargetValue = (
  output: Record<string, unknown>,
  target: string,
  value: unknown,
): void => {
  if (!target.includes("[]"))
    return setAtPath(output, target.split(".").filter(Boolean), value);
  const marker = target.indexOf("[]");
  const parent = target.slice(0, marker).split(".").filter(Boolean);
  const child = target
    .slice(marker + 2)
    .split(".")
    .filter(Boolean);
  const arrayKey = parent.pop();
  if (!arrayKey || !child.length) return;

  let cursor = output;
  parent.forEach((part) => {
    const next = isRecord(cursor[part]) ? cursor[part] : {};
    cursor[part] = next;
    cursor = next;
  });
  const entries = Array.isArray(value) ? value : [value];
  const list = Array.isArray(cursor[arrayKey])
    ? (cursor[arrayKey] as Record<string, unknown>[])
    : [];
  cursor[arrayKey] = list;
  entries.forEach((entry, index) => {
    const item = isRecord(list[index]) ? list[index] : {};
    list[index] = item;
    setAtPath(item, child, entry);
  });
};

export const buildOutput = (
  rules: MappingRule[],
  values: Record<string, unknown>,
): Record<string, unknown> =>
  rules.reduce<Record<string, unknown>>((output, rule) => {
    if (Object.prototype.hasOwnProperty.call(values, rule.source))
      assignTargetValue(output, rule.target, values[rule.source]);
    return output;
  }, {});
