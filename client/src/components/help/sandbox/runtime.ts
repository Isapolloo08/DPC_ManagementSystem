const roles = ['Admin', 'IT Admin', 'Pastor', 'Coordinator', 'Leader', 'Volunteer', 'Member'];
const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
export const guideSandbox = params.get('guide-demo') === '1' ? {
  role: roles.includes(params.get('role') || '') ? params.get('role')! : 'Member',
  guideId: params.get('guide') || 'my-group',
  step: Math.max(0, Number(params.get('step')) || 0),
  theme: params.get('theme') === 'light' ? 'light' : 'dark',
} : null;
export const isGuideSandbox = () => guideSandbox !== null;
export const demoToken = 'e30.' + (typeof btoa === 'function' ? btoa(JSON.stringify({ exp: 4102444800, demo: true })) : '') + '.practice';

export function createMemoryStorage(seed: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(seed));
  return {
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(String(key)) ?? null,
    setItem: (key, value) => { values.set(String(key), String(value)); },
    removeItem: key => { values.delete(String(key)); },
    clear: () => values.clear(),
  };
}
