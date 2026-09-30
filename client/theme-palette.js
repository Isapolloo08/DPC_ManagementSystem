import plugin from 'tailwindcss/plugin';

// Map colors by their purpose so white text and dark brand panels stay intact.
// Existing utilities, opacity modifiers, hover states and portals share the theme.
const neutral = new Set(['slate', 'gray', 'zinc', 'neutral', 'stone']);
const accents = new Set(['indigo', 'amber', 'sage', 'rose', 'blue', 'sky', 'cyan', 'teal', 'emerald', 'green', 'purple', 'violet', 'orange', 'red', 'yellow']);

function darkColor(kind, family, shade, palette) {
  if (kind === 'surface') {
    if (family === 'white') return '#1e293b';
    if (family === 'ivory') return shade === 'dark' ? '#334155' : shade === 'light' ? '#0f172a' : '#172033';
    if (neutral.has(family) && Number(shade) <= 300) return ({ 50: '#172033', 100: '#243247', 200: '#334155', 300: '#475569' })[shade];
    if (accents.has(family) && Number(shade) <= 200) return palette[Number(shade) === 200 ? 800 : 900];
    // Gold buttons keep readable foregrounds when text colors become light.
    if (family === 'amber' && ['DEFAULT', '300', '400', '500'].includes(shade)) return palette[800];
  }
  if (kind === 'ink') {
    if (family === 'charcoal' || family === 'black') return '#e2e8f0';
    if (neutral.has(family) && Number(shade) >= 500) return Number(shade) >= 800 ? '#f1f5f9' : Number(shade) >= 600 ? '#cbd5e1' : '#94a3b8';
    if (accents.has(family) && (shade === 'DEFAULT' || Number(shade) >= 500)) return palette[Number(shade) >= 800 ? 100 : 300];
  }
  if (kind === 'line') {
    if (family === 'charcoal') return '#cbd5e1';
    if (neutral.has(family) && Number(shade) <= 300) return '#475569';
    if (accents.has(family) && Number(shade) <= 300) return palette[700];
  }
}

function rgb(hex) {
  const expanded = hex.length === 4 ? hex.slice(1).split('').map((value) => value + value).join('') : hex.slice(1);
  return expanded.match(/.{2}/g).map((value) => parseInt(value, 16)).join(' ');
}

function entries(colors, kind, visit) {
  return Object.fromEntries(Object.entries(colors).map(([family, palette]) => {
    const map = (shade, value) => {
      const dark = darkColor(kind, family, shade, palette);
      return dark && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? visit(`${kind}-${family}-${shade}`, value, dark) : value;
    };
    return [family, typeof palette === 'string' ? map('DEFAULT', palette) : Object.fromEntries(Object.entries(palette).map(([shade, value]) => [shade, map(shade, value)]))];
  }));
}

export const themedColors = (kind, colors) => entries(colors, kind, (name) => `rgb(var(--${name}) / <alpha-value>)`);

export const themePalette = plugin(({ addBase, theme }) => {
  const light = {};
  const dark = {};
  for (const kind of ['surface', 'ink', 'line']) {
    entries(theme('colors'), kind, (name, original, replacement) => {
      light[`--${name}`] = rgb(original);
      dark[`--${name}`] = rgb(replacement);
    });
  }
  addBase({
    ':root': { ...light, colorScheme: 'light' },
    ':root.dark': { ...dark, colorScheme: 'dark' },
    '@media print': { ':root, :root.dark': { ...light, colorScheme: 'light' } },
  });
});
