export function highlightJson(data: unknown): string {
  const json = (JSON.stringify(data ?? {}, null, 2) ?? '{}')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return json.replace(
    /("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match, key, string, boolean, number) => {
      if (key) return `<span class="text-sky-300">${match}</span>`
      if (string) return `<span class="text-emerald-300">${match}</span>`
      if (boolean) return `<span class="text-violet-300">${match}</span>`
      if (number) return `<span class="text-amber-300">${match}</span>`

      return match
    },
  )
}
