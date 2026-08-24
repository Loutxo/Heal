// Palette officielle — Heal Product Brief §5
export const colors = {
  background: '#F5EDD8',
  backgroundSecondary: '#FAF7F2',
  primary: '#C4694F', // terracotta — CTA
  secondary: '#8FAF8A', // vert sauge — succès
  text: '#5C3D2E', // brun chaud
  textMuted: '#8A6F5E',
  white: '#FFFFFF',
} as const;

export const seasonalAccents = {
  spring: '#A8CC8C',
  summer: '#F0C040',
  autumn: '#C4694F',
  winter: '#4A6580',
} as const;

export const fonts = {
  logo: 'Recoleta', // non disponible en Google Fonts — police de secours utilisée en attendant l'achat de licence
  heading: 'Lora_600SemiBold',
  headingItalic: 'Lora_400Regular_Italic',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
} as const;

export const radii = {
  card: 20,
  pill: 999,
} as const;
