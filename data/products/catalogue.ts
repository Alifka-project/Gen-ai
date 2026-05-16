// data/products/catalogue.ts
// Curated product catalogue extracted from the two source PDFs in the repo:
//   - Bosch washing machine catalogue.pdf (2025) — all 7 SKUs included
//   - Samsung catalogue.pdf (Mar–Apr 2021) — representative subset across
//     every range (Q-Rator / AddWash / EcoBubble / Diamond Drum / ActivWash+
//     / Wobble / Center Jet / Semi-Automatic), ~21 SKUs.
//
// The platform restricts case intake to these model codes — anything else
// is rejected with 400 by POST /api/cases.
//
// estimatedValueAed is a rough AED retail estimate used as the fallback when
// the customer's invoice did not specify a value (drives cost.ts savings math).

export type ProductBrand = "Bosch" | "Samsung";

export type ProductCategory =
  | "front_load_washer"
  | "top_load_washer"
  | "semi_automatic_washer"
  | "dryer"
  | "washer_dryer_combo";

export interface CatalogueProduct {
  brand: ProductBrand;
  modelCode: string;
  series: string;
  category: ProductCategory;
  capacityKg: string; // free-form to support combos like "10.5/6"
  spinRpm?: number;
  catalogueYear: number;
  estimatedValueAed: number;
  highlightFeatures: string[];
}

export const CATALOGUE: CatalogueProduct[] = [
  // ─────────────────────────── BOSCH ───────────────────────────
  {
    brand: "Bosch",
    modelCode: "WGG434E0ID",
    series: "Serie 4 Front Loader",
    category: "front_load_washer",
    capacityKg: "8",
    spinRpm: 1200,
    catalogueYear: 2025,
    estimatedValueAed: 2800,
    highlightFeatures: ["AntiVibration", "EcoSilence Drive", "SpeedPerfect", "Super Quick 15/30"],
  },
  {
    brand: "Bosch",
    modelCode: "WGG444E0ID",
    series: "Serie 6 Front Loader",
    category: "front_load_washer",
    capacityKg: "9",
    spinRpm: 1400,
    catalogueYear: 2025,
    estimatedValueAed: 3500,
    highlightFeatures: ["AntiVibration", "Allergy Plus", "AntiStain", "Silent Wash"],
  },
  {
    brand: "Bosch",
    modelCode: "WGG454E0ID",
    series: "Serie 8 Front Loader",
    category: "front_load_washer",
    capacityKg: "10",
    spinRpm: 1400,
    catalogueYear: 2025,
    estimatedValueAed: 4200,
    highlightFeatures: ["AntiVibration", "TurboPerfect", "Hygiene", "Touch Control Panel"],
  },
  {
    brand: "Bosch",
    modelCode: "WGG454E1ID",
    series: "Serie 8 Front Loader (Reload)",
    category: "front_load_washer",
    capacityKg: "10",
    spinRpm: 1400,
    catalogueYear: 2025,
    estimatedValueAed: 4500,
    highlightFeatures: ["Reload Function", "AntiVibration", "TurboPerfect"],
  },
  {
    brand: "Bosch",
    modelCode: "WGG454A0ID",
    series: "Serie 8 Front Loader (i-DOS)",
    category: "front_load_washer",
    capacityKg: "10",
    spinRpm: 1400,
    catalogueYear: 2025,
    estimatedValueAed: 5200,
    highlightFeatures: ["i-DOS auto-dosing", "ActiveWater Plus", "Reload Function"],
  },
  {
    brand: "Bosch",
    modelCode: "WQG24200ID",
    series: "Serie 6 Heat Pump Dryer",
    category: "dryer",
    capacityKg: "9",
    spinRpm: 1400,
    catalogueYear: 2025,
    estimatedValueAed: 4000,
    highlightFeatures: ["Heat Pump", "AutoDry", "SensitiveDrying", "EasyClean filter"],
  },
  {
    brand: "Bosch",
    modelCode: "WNA264U9ID",
    series: "Serie 6 Washer Dryer",
    category: "washer_dryer_combo",
    capacityKg: "10.5/6",
    spinRpm: 1400,
    catalogueYear: 2025,
    estimatedValueAed: 6000,
    highlightFeatures: ["Wash & Dry 60'", "AutoDry", "Self Cleaning", "Hygiene Care"],
  },

  // ────────────────────────── SAMSUNG ──────────────────────────
  // Q-Rator (AI-managed)
  {
    brand: "Samsung",
    modelCode: "WD10N641R2X/TL",
    series: "Q-Rator Washer Dryer",
    category: "washer_dryer_combo",
    capacityKg: "10/7",
    spinRpm: 1400,
    catalogueYear: 2021,
    estimatedValueAed: 5800,
    highlightFeatures: ["AI Q-Rator", "AddWash", "Hygiene Steam", "59 min Wash + Dry"],
  },
  {
    brand: "Samsung",
    modelCode: "WW10N641RBX/TL",
    series: "Q-Rator Front Loader",
    category: "front_load_washer",
    capacityKg: "10",
    spinRpm: 1400,
    catalogueYear: 2021,
    estimatedValueAed: 4500,
    highlightFeatures: ["AI Q-Rator", "Hygiene Steam", "Super Eco Wash", "Smart Check"],
  },

  // AddWash
  {
    brand: "Samsung",
    modelCode: "WW91K54E0UX/TL",
    series: "AddWash Front Loader",
    category: "front_load_washer",
    capacityKg: "9",
    spinRpm: 1400,
    catalogueYear: 2021,
    estimatedValueAed: 3800,
    highlightFeatures: ["Add Door", "EcoBubble", "Hygiene Steam", "Bubble Soak"],
  },
  {
    brand: "Samsung",
    modelCode: "WW81K54E0WW/TL",
    series: "AddWash Front Loader",
    category: "front_load_washer",
    capacityKg: "8",
    spinRpm: 1400,
    catalogueYear: 2021,
    estimatedValueAed: 3400,
    highlightFeatures: ["Add Door", "EcoBubble", "Hygiene Steam"],
  },
  {
    brand: "Samsung",
    modelCode: "WW70K54E0YW/TL",
    series: "AddWash Front Loader",
    category: "front_load_washer",
    capacityKg: "7",
    spinRpm: 1400,
    catalogueYear: 2021,
    estimatedValueAed: 3000,
    highlightFeatures: ["Add Door", "EcoBubble"],
  },

  // EcoBubble
  {
    brand: "Samsung",
    modelCode: "WD90K6410OX/TL",
    series: "EcoBubble Washer Dryer",
    category: "washer_dryer_combo",
    capacityKg: "9/6",
    spinRpm: 1400,
    catalogueYear: 2021,
    estimatedValueAed: 4800,
    highlightFeatures: ["EcoBubble", "Hygiene Steam", "Diamond Drum"],
  },
  {
    brand: "Samsung",
    modelCode: "WW81J54E0IW/TL",
    series: "EcoBubble Front Loader",
    category: "front_load_washer",
    capacityKg: "8",
    spinRpm: 1400,
    catalogueYear: 2021,
    estimatedValueAed: 2900,
    highlightFeatures: ["EcoBubble", "Diamond Drum", "Hygiene Steam"],
  },
  {
    brand: "Samsung",
    modelCode: "WW71J42E0BX/TL",
    series: "EcoBubble Front Loader",
    category: "front_load_washer",
    capacityKg: "7",
    spinRpm: 1200,
    catalogueYear: 2021,
    estimatedValueAed: 2500,
    highlightFeatures: ["EcoBubble", "Diamond Drum", "Smart Check"],
  },

  // Diamond Drum
  {
    brand: "Samsung",
    modelCode: "WW81U44G0IW/TL",
    series: "Diamond Drum Front Loader",
    category: "front_load_washer",
    capacityKg: "8",
    spinRpm: 1400,
    catalogueYear: 2021,
    estimatedValueAed: 2700,
    highlightFeatures: ["Diamond Drum", "Hygiene Steam", "Quick Wash"],
  },
  {
    brand: "Samsung",
    modelCode: "WW71J42G0KW/TL",
    series: "Diamond Drum Front Loader",
    category: "front_load_washer",
    capacityKg: "7",
    spinRpm: 1200,
    catalogueYear: 2021,
    estimatedValueAed: 2300,
    highlightFeatures: ["Diamond Drum", "Ceramic Heater"],
  },

  // ActivWash+ (Top Load with built-in sink)
  {
    brand: "Samsung",
    modelCode: "WA16N6781CV",
    series: "ActivWash+ Top Loader",
    category: "top_load_washer",
    capacityKg: "16",
    catalogueYear: 2021,
    estimatedValueAed: 3600,
    highlightFeatures: ["Built-in Sink", "Wobble STS", "Magic Dispenser", "12yr motor warranty"],
  },
  {
    brand: "Samsung",
    modelCode: "WA11J5751SP",
    series: "ActivWash+ Top Loader",
    category: "top_load_washer",
    capacityKg: "11",
    catalogueYear: 2021,
    estimatedValueAed: 2800,
    highlightFeatures: ["Built-in Sink", "Wobble STS", "Diamond Drum"],
  },
  {
    brand: "Samsung",
    modelCode: "WA75N4571FE/TL",
    series: "ActivWash+ Top Loader",
    category: "top_load_washer",
    capacityKg: "7.5",
    catalogueYear: 2021,
    estimatedValueAed: 1900,
    highlightFeatures: ["Built-in Sink", "Wobble", "Magic Filter"],
  },

  // Wobble (Top Load)
  {
    brand: "Samsung",
    modelCode: "WA10T5260BV/TL",
    series: "Wobble + DIT Top Loader",
    category: "top_load_washer",
    capacityKg: "10",
    catalogueYear: 2021,
    estimatedValueAed: 2400,
    highlightFeatures: ["Wobble", "Diamond Drum", "Magic Filter"],
  },
  {
    brand: "Samsung",
    modelCode: "WA90T5260BY/TL",
    series: "Wobble + DIT Top Loader",
    category: "top_load_washer",
    capacityKg: "9",
    catalogueYear: 2021,
    estimatedValueAed: 2200,
    highlightFeatures: ["Wobble", "Diamond Drum"],
  },
  {
    brand: "Samsung",
    modelCode: "WA70T4262BS/TL",
    series: "Wobble + DIT Top Loader",
    category: "top_load_washer",
    capacityKg: "7",
    catalogueYear: 2021,
    estimatedValueAed: 1700,
    highlightFeatures: ["Wobble", "Diamond Drum"],
  },

  // Center Jet (Top Load)
  {
    brand: "Samsung",
    modelCode: "WA65M4206HV",
    series: "Center Jet Top Loader",
    category: "top_load_washer",
    capacityKg: "6.5",
    catalogueYear: 2021,
    estimatedValueAed: 1300,
    highlightFeatures: ["Center Jet Pulsator", "Magic Filter", "Air Turbo"],
  },
  {
    brand: "Samsung",
    modelCode: "WA60M4101HY",
    series: "Center Jet Top Loader",
    category: "top_load_washer",
    capacityKg: "6",
    catalogueYear: 2021,
    estimatedValueAed: 1200,
    highlightFeatures: ["Center Jet Pulsator", "Diamond Drum"],
  },

  // Semi Automatic
  {
    brand: "Samsung",
    modelCode: "WT85R4200RR/TL",
    series: "Semi-Automatic Twin Tub",
    category: "semi_automatic_washer",
    capacityKg: "8.5",
    catalogueYear: 2021,
    estimatedValueAed: 950,
    highlightFeatures: ["Hexa Storm Pulsator", "Air Turbo", "Magic Filter"],
  },
  {
    brand: "Samsung",
    modelCode: "WT75M3200HB/TL",
    series: "Semi-Automatic Twin Tub",
    category: "semi_automatic_washer",
    capacityKg: "7.5",
    catalogueYear: 2021,
    estimatedValueAed: 850,
    highlightFeatures: ["Double Storm Pulsator", "Magic Filter", "Caster wheels"],
  },
];

export const CATALOGUE_VERSION = "2026-05-16-1";
