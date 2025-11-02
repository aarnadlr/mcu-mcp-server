export const SCHEME_ROLES = [
  "primary",
  "onPrimary",
  "primaryContainer",
  "onPrimaryContainer",
  "secondary",
  "onSecondary",
  "tertiary",
  "onTertiary",
  "background",
  "surface",
] as const;

export type SchemeRole = (typeof SCHEME_ROLES)[number];

export type ColorSchemeCategory =
  | "content"
  | "expressive"
  | "fidelity"
  | "fruit-salad"
  | "monochrome"
  | "neutral"
  | "rainbow"
  | "tonal-spot"
  | "vibrant";

export interface GenerateColorSchemeOptions {
  seedColor: string;
  category: string;
  darkMode?: boolean;
  contrastLevel?: number;
}

type DynamicColor = {
  getArgb(scheme: any): number;
};

type MaterialDynamicColors = {
  primary: DynamicColor;
  onPrimary: DynamicColor;
  primaryContainer: DynamicColor;
  onPrimaryContainer: DynamicColor;
  secondary: DynamicColor;
  onSecondary: DynamicColor;
  tertiary: DynamicColor;
  onTertiary: DynamicColor;
  background: DynamicColor;
  surface: DynamicColor;
};

type DynamicScheme = any;

type HctColor = {
  toInt(): number;
};

type TonalPalette = {
  keyColor: HctColor;
  tone(tone: number): number;
};

type CorePaletteInstance = {
  a1: TonalPalette;
  a2: TonalPalette;
  a3: TonalPalette;
  n1: TonalPalette;
  n2: TonalPalette;
  error: TonalPalette;
};

type SchemeConstructor = new (
  sourceColorHct: any,
  isDark: boolean,
  contrastLevel: number
) => DynamicScheme;

const categoryAliases: Record<string, ColorSchemeCategory> = {
  content: "content",
  expressive: "expressive",
  fidelity: "fidelity",
  "fruit-salad": "fruit-salad",
  fruitsalad: "fruit-salad",
  "fruit salad": "fruit-salad",
  monochrome: "monochrome",
  neutral: "neutral",
  neutrals: "neutral",
  rainbow: "rainbow",
  "tonal-spot": "tonal-spot",
  "tonal spot": "tonal-spot",
  tonalspot: "tonal-spot",
  vibrant: "vibrant",
};

const colorRoleExtractors: Record<
  SchemeRole,
  (colors: MaterialDynamicColors, scheme: DynamicScheme) => number
> = {
  primary: (colors, scheme) => colors.primary.getArgb(scheme),
  onPrimary: (colors, scheme) => colors.onPrimary.getArgb(scheme),
  primaryContainer: (colors, scheme) =>
    colors.primaryContainer.getArgb(scheme),
  onPrimaryContainer: (colors, scheme) =>
    colors.onPrimaryContainer.getArgb(scheme),
  secondary: (colors, scheme) => colors.secondary.getArgb(scheme),
  onSecondary: (colors, scheme) => colors.onSecondary.getArgb(scheme),
  tertiary: (colors, scheme) => colors.tertiary.getArgb(scheme),
  onTertiary: (colors, scheme) => colors.onTertiary.getArgb(scheme),
  background: (colors, scheme) => colors.background.getArgb(scheme),
  surface: (colors, scheme) => colors.surface.getArgb(scheme),
};

type LoadedModules = {
  Hct: { fromInt(argb: number): unknown };
  argbFromHex(hex: string): number;
  hexFromArgb(argb: number): string;
  schemes: Record<ColorSchemeCategory, SchemeConstructor>;
  MaterialDynamicColors: MaterialDynamicColors;
  CorePalette: {
    of(argb: number): CorePaletteInstance;
    contentOf(argb: number): CorePaletteInstance;
  };
};

let modulesPromise: Promise<LoadedModules> | null = null;

async function loadModules(): Promise<LoadedModules> {
  if (!modulesPromise) {
    modulesPromise = (async () => {
      const mcu = await import("@material/material-color-utilities");

      const schemes: Record<ColorSchemeCategory, SchemeConstructor> = {
        content: mcu.SchemeContent as any,
        expressive: mcu.SchemeExpressive as any,
        fidelity: mcu.SchemeFidelity as any,
        "fruit-salad": mcu.SchemeFruitSalad as any,
        monochrome: mcu.SchemeMonochrome as any,
        neutral: mcu.SchemeNeutral as any,
        rainbow: mcu.SchemeRainbow as any,
        "tonal-spot": mcu.SchemeTonalSpot as any,
        vibrant: mcu.SchemeVibrant as any,
      };

      return {
        Hct: mcu.Hct,
        argbFromHex: mcu.argbFromHex,
        hexFromArgb: mcu.hexFromArgb,
        schemes,
        MaterialDynamicColors: mcu.MaterialDynamicColors,
        CorePalette: mcu.CorePalette as unknown as LoadedModules["CorePalette"],
      };
    })();
  }

  return modulesPromise!;
}

export function normalizeCategory(category: string): ColorSchemeCategory {
  const normalized = category.trim().toLowerCase().replace(/[_\s]+/g, "-");
  const match = categoryAliases[normalized];
  if (!match) {
    throw new Error(
      `Unsupported color scheme category: "${category}". Supported categories: ${supportedCategories()
        .map((name) => `"${name}"`)
        .join(", ")}.`
    );
  }
  return match;
}

export function supportedCategories(): ColorSchemeCategory[] {
  return [
    "content",
    "expressive",
    "fidelity",
    "fruit-salad",
    "monochrome",
    "neutral",
    "rainbow",
    "tonal-spot",
    "vibrant",
  ];
}

export async function buildScheme(
  options: GenerateColorSchemeOptions
): Promise<{
  scheme: DynamicScheme;
  hexFromArgb: (argb: number) => string;
  colors: MaterialDynamicColors;
}> {
  const { seedColor, category, darkMode = false, contrastLevel = 0 } = options;
  const normalizedCategory = normalizeCategory(category);
  const modules = await loadModules();
  const factory = modules.schemes[normalizedCategory];
  if (!factory) {
    throw new Error(`No scheme factory found for category "${category}".`);
  }
  const argb = modules.argbFromHex(seedColor);
  const sourceHct = modules.Hct.fromInt(argb);
  const scheme = new factory(sourceHct, darkMode, contrastLevel);
  return {
    scheme,
    hexFromArgb: modules.hexFromArgb,
    colors: modules.MaterialDynamicColors,
  };
}

export function extractHexColors(
  scheme: DynamicScheme,
  hexFromArgb: (argb: number) => string,
  colors: MaterialDynamicColors
): Record<SchemeRole, string> {
  return SCHEME_ROLES.reduce((acc, role) => {
    const toArgb = colorRoleExtractors[role];
    const argb = toArgb(colors, scheme);
    acc[role] = hexFromArgb(argb);
    return acc;
  }, {} as Record<SchemeRole, string>);
}

export async function generateColorScheme(
  options: GenerateColorSchemeOptions
) {
  const { scheme, hexFromArgb, colors } = await buildScheme(options);
  return extractHexColors(scheme, hexFromArgb, colors);
}

export const CORE_PALETTE_ROLES = [
  "primary",
  "secondary",
  "tertiary",
  "error",
  "neutral",
  "neutralVariant",
] as const;

export type CorePaletteRole = (typeof CORE_PALETTE_ROLES)[number];

export async function generateCorePaletteColors(seedColor: string): Promise<
  Record<CorePaletteRole, string>
> {
  const modules = await loadModules();
  const argb = modules.argbFromHex(seedColor);
  // Use contentOf to match Material Theme Builder's behavior
  const palette = modules.CorePalette.contentOf(argb);

  // Material Theme Builder displays:
  // - The original seed color for primary
  // - Tone 60 from contentOf CorePalette for other colors
  const colors: Record<CorePaletteRole, number> = {
    primary: argb, // Use the original seed color
    secondary: palette.a2.tone(60),
    tertiary: palette.a3.tone(60),
    error: palette.error.tone(60),
    neutral: palette.n1.tone(60),
    neutralVariant: palette.n2.tone(60),
  };

  return CORE_PALETTE_ROLES.reduce((acc, role) => {
    acc[role] = modules.hexFromArgb(colors[role]).toUpperCase();
    return acc;
  }, {} as Record<CorePaletteRole, string>);
}
