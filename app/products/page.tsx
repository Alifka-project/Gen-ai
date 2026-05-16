import { Card } from "@/components/ui/card";
import { CATALOGUE, categoryLabel, groupByBrand } from "@/lib/catalogue";

export const dynamic = "force-static";

export const metadata = {
  title: "Catalogue — ReturnGuard AI",
};

export default function ProductsPage() {
  const groups = groupByBrand();
  const total = CATALOGUE.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Approved product catalogue</h1>
        <p className="text-sm text-muted-foreground">
          {total} model{total === 1 ? "" : "s"} extracted from the Bosch washing
          machine catalogue (2025) and the Samsung washing machine catalogue
          (Mar–Apr 2021). New cases must reference one of these model codes —
          anything else is rejected at the API boundary.
        </p>
      </div>

      {(Object.keys(groups) as Array<keyof typeof groups>).map((brand) => (
        <Card key={brand} className="p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-semibold">{brand}</h2>
            <span className="text-xs text-muted-foreground">
              {groups[brand].length} model{groups[brand].length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {groups[brand].map((p) => (
              <div
                key={p.modelCode}
                className="rounded border bg-muted/30 p-3 space-y-1.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-sm font-medium">{p.modelCode}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.catalogueYear}
                  </span>
                </div>
                <p className="text-sm">{p.series}</p>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <span className="inline-flex items-center rounded-full bg-background border px-2 py-0.5">
                    {categoryLabel(p.category)}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-background border px-2 py-0.5">
                    {p.capacityKg} kg
                  </span>
                  {p.spinRpm ? (
                    <span className="inline-flex items-center rounded-full bg-background border px-2 py-0.5">
                      {p.spinRpm} RPM
                    </span>
                  ) : null}
                  <span className="inline-flex items-center rounded-full bg-background border px-2 py-0.5">
                    ~AED {p.estimatedValueAed.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {p.highlightFeatures.join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
