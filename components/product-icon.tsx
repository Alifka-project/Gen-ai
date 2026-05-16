import type { ProductCategory, ProductBrand } from "@/data/products/catalogue";

const BRAND_COLORS: Record<ProductBrand, { primary: string; bg: string }> = {
  Bosch: { primary: "#c8102e", bg: "#fff0f0" },
  Samsung: { primary: "#1428A0", bg: "#f0f2ff" },
};

export function ProductIcon({
  category,
  brand,
  size = 64,
}: {
  category: ProductCategory;
  brand: ProductBrand;
  size?: number;
}) {
  const color = BRAND_COLORS[brand]?.primary ?? "#334155";
  const bg = BRAND_COLORS[brand]?.bg ?? "#f8fafc";

  if (
    category === "front_load_washer" ||
    category === "washer_dryer_combo"
  ) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="80" height="80" rx="10" fill={bg} />
        {/* Body */}
        <rect x="10" y="12" width="60" height="58" rx="5" fill={color} opacity="0.15" />
        <rect x="10" y="12" width="60" height="58" rx="5" stroke={color} strokeWidth="2.5" />
        {/* Door circle */}
        <circle cx="40" cy="46" r="18" fill="white" stroke={color} strokeWidth="2.5" />
        <circle cx="40" cy="46" r="12" fill={bg} stroke={color} strokeWidth="1.5" />
        {/* Inner drum lines */}
        <circle cx="40" cy="46" r="7" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
        {/* Top panel */}
        <rect x="14" y="16" width="52" height="20" rx="3" fill={color} opacity="0.08" />
        {/* Control knobs */}
        <circle cx="24" cy="26" r="5" fill={color} opacity="0.6" />
        <circle cx="57" cy="26" r="4" fill={color} opacity="0.4" />
        <rect x="30" y="23" width="20" height="6" rx="3" fill={color} opacity="0.2" />
        {/* Brand */}
        <text x="40" y="73" textAnchor="middle" fontSize="6" fill={color} fontWeight="bold" fontFamily="system-ui">
          {brand.toUpperCase()}
        </text>
      </svg>
    );
  }

  if (category === "top_load_washer") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="80" height="80" rx="10" fill={bg} />
        {/* Body */}
        <rect x="10" y="18" width="60" height="52" rx="5" fill={color} opacity="0.15" />
        <rect x="10" y="18" width="60" height="52" rx="5" stroke={color} strokeWidth="2.5" />
        {/* Lid */}
        <rect x="14" y="14" width="52" height="14" rx="4" fill={color} opacity="0.3" stroke={color} strokeWidth="2" />
        <rect x="32" y="16" width="16" height="10" rx="2" fill="white" stroke={color} strokeWidth="1.5" />
        {/* Inner drum */}
        <ellipse cx="40" cy="49" rx="20" ry="14" fill="white" stroke={color} strokeWidth="2" />
        <ellipse cx="40" cy="49" rx="13" ry="9" fill={bg} stroke={color} strokeWidth="1.2" />
        {/* Agitator */}
        <rect x="37" y="42" width="6" height="14" rx="3" fill={color} opacity="0.5" />
        <text x="40" y="75" textAnchor="middle" fontSize="6" fill={color} fontWeight="bold" fontFamily="system-ui">
          {brand.toUpperCase()}
        </text>
      </svg>
    );
  }

  if (category === "semi_automatic_washer") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="80" height="80" rx="10" fill={bg} />
        {/* Twin tub body */}
        <rect x="8" y="14" width="64" height="58" rx="5" fill={color} opacity="0.12" stroke={color} strokeWidth="2.5" />
        <line x1="40" y1="18" x2="40" y2="68" stroke={color} strokeWidth="1.5" />
        {/* Wash tub */}
        <circle cx="24" cy="46" r="14" fill="white" stroke={color} strokeWidth="2" />
        <circle cx="24" cy="46" r="9" fill={bg} stroke={color} strokeWidth="1.2" strokeDasharray="3 2" />
        {/* Spin tub */}
        <circle cx="56" cy="46" r="14" fill="white" stroke={color} strokeWidth="2" />
        <circle cx="56" cy="46" r="5" fill={color} opacity="0.4" />
        {/* Labels */}
        <text x="24" y="19" textAnchor="middle" fontSize="5" fill={color} fontFamily="system-ui">WASH</text>
        <text x="56" y="19" textAnchor="middle" fontSize="5" fill={color} fontFamily="system-ui">SPIN</text>
        <text x="40" y="75" textAnchor="middle" fontSize="6" fill={color} fontWeight="bold" fontFamily="system-ui">
          {brand.toUpperCase()}
        </text>
      </svg>
    );
  }

  if (category === "dryer") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="80" height="80" rx="10" fill={bg} />
        <rect x="10" y="12" width="60" height="58" rx="5" fill={color} opacity="0.12" stroke={color} strokeWidth="2.5" />
        {/* Door */}
        <circle cx="40" cy="48" r="20" fill="white" stroke={color} strokeWidth="2.5" />
        <circle cx="40" cy="48" r="14" fill={bg} stroke={color} strokeWidth="1.5" />
        {/* Heat symbol */}
        <path d="M35 44 Q38 40 40 44 Q42 48 45 44" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M35 48 Q38 44 40 48 Q42 52 45 48" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* Control panel */}
        <rect x="14" y="16" width="52" height="18" rx="3" fill={color} opacity="0.08" />
        <circle cx="24" cy="25" r="5" fill={color} opacity="0.5" />
        <text x="40" y="73" textAnchor="middle" fontSize="6" fill={color} fontWeight="bold" fontFamily="system-ui">
          {brand.toUpperCase()}
        </text>
      </svg>
    );
  }

  // Default
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="80" height="80" rx="10" fill={bg} />
      <rect x="10" y="12" width="60" height="58" rx="5" fill={color} opacity="0.15" stroke={color} strokeWidth="2.5" />
      <circle cx="40" cy="46" r="18" fill="white" stroke={color} strokeWidth="2.5" />
      <circle cx="40" cy="46" r="10" fill={bg} stroke={color} strokeWidth="1.5" />
      <text x="40" y="73" textAnchor="middle" fontSize="6" fill={color} fontWeight="bold" fontFamily="system-ui">
        {brand.toUpperCase()}
      </text>
    </svg>
  );
}
