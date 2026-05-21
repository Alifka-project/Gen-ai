// prisma/seed.ts
// Insert 8 demo cases. Every productModel is a real model code from the
// Bosch + Samsung catalogues in data/products/catalogue.ts. Run via `pnpm seed`.
//
// Idempotent: re-running upserts case fields. If the productModel changed
// since the last seed, the existing AiAnalysis + ManagerDecision rows are
// cleared (they were analyzed against the old product and would be stale).

import { config } from "dotenv"; config({ override: true });
import { prisma } from "../lib/db/prisma";
import { findProduct } from "../lib/catalogue";

type SeedCase = {
  id: string;
  customerName: string;
  productModel: string;
  serialNumber: string | null;
  complaintText: string;
  requestedAction: "replacement" | "refund" | "repair";
};

const DEMO_CASES: SeedCase[] = [
  {
    id: "demo-c001",
    customerName: "Aisha Khan",
    productModel: "WNA264U9ID",
    serialNumber: "WNA264-2024-001",
    complaintText:
      "The drying cycle on my Bosch washer-dryer stops without heating the load. Clothes come out wet at the end of the 60-minute Wash & Dry program. Wash cycle still works normally. Bought 8 months ago.",
    requestedAction: "replacement",
  },
  {
    id: "demo-c002",
    customerName: "Mohamed Al-Hashemi",
    productModel: "WGG444E0ID",
    serialNumber: "WGG444-2024-018",
    complaintText:
      "The front-load washer arrived 2 hours ago and the door rubber gasket has a 5-cm tear at the bottom of the seal. Photos taken during unboxing are attached. Have not used the machine.",
    requestedAction: "replacement",
  },
  {
    id: "demo-c003",
    customerName: "Layla Rahman",
    productModel: "WW91K54E0UX/TL",
    serialNumber: "WW91K-2024-077",
    complaintText:
      "Noticed a small 2-cm scratch on the top panel of my AddWash machine 25 days after delivery. The machine works fine but I would like a replacement.",
    requestedAction: "replacement",
  },
  {
    id: "demo-c004",
    customerName: "Omar Saleh",
    productModel: "WW10N641RBX/TL",
    serialNumber: "WW10N-2024-145",
    complaintText:
      "The detergent dispenser drawer is missing from the box. Everything else (manual, hose, drain pipe) was present at unboxing. Cannot start a wash cycle without it.",
    requestedAction: "replacement",
  },
  {
    id: "demo-c005",
    customerName: "Sara Petrov",
    productModel: "WA16N6781CV",
    serialNumber: null,
    complaintText:
      "The washing machine is defective. Please send a new one.",
    requestedAction: "replacement",
  },
  {
    id: "demo-c006",
    customerName: "Jamal Ahmed",
    productModel: "WGG454E0ID",
    serialNumber: "WGG454-2024-099",
    complaintText:
      "The washer vibrates excessively and is very loud during the spin cycle. Started about 1 month after installation. Drum looks balanced when loading. No error code displayed.",
    requestedAction: "replacement",
  },
  {
    id: "demo-c007",
    customerName: "Hana Yousef",
    productModel: "WGG434E0ID",
    serialNumber: "WGG434-2024-022",
    complaintText:
      "My new washing machine arrived with severe dents and visible damage on the side panel. The damage is clearly shown in the photos I attached at delivery.",
    requestedAction: "replacement",
  },
  {
    id: "demo-c008",
    customerName: "Tareq Habib",
    productModel: "WW70K54E0YW/TL",
    serialNumber: "WW70K-2024-300",
    complaintText:
      "I ordered the Samsung WW10N641RBX/TL Q-Rator 10 kg washer but the unit delivered today is a Samsung WW70K54E0YW/TL AddWash 7 kg. The serial label and the invoice product code do not match. Need the originally ordered model.",
    requestedAction: "replacement",
  },
];

async function main() {
  console.log(`→ Seeding ${DEMO_CASES.length} demo cases (catalogue-bound)...`);

  for (const c of DEMO_CASES) {
    if (!findProduct(c.productModel)) {
      throw new Error(
        `Seed integrity error: ${c.id} uses productModel ${c.productModel} which is not in the catalogue. Fix data/products/catalogue.ts or prisma/seed.ts.`
      );
    }

    const existing = await prisma.case.findUnique({
      where: { id: c.id },
      select: { productModel: true },
    });

    if (existing && existing.productModel !== c.productModel) {
      // Product changed — old AI analysis + manager decision are stale.
      await prisma.aiAnalysis.deleteMany({ where: { caseId: c.id } });
      await prisma.managerDecision.deleteMany({ where: { caseId: c.id } });
      await prisma.case.update({
        where: { id: c.id },
        data: { status: "new" },
      });
      console.log(`  ↻ ${c.id} — product changed (${existing.productModel} → ${c.productModel}); cleared stale analysis/decision`);
    }

    await prisma.case.upsert({
      where: { id: c.id },
      update: {
        customerName: c.customerName,
        productModel: c.productModel,
        serialNumber: c.serialNumber,
        complaintText: c.complaintText,
        requestedAction: c.requestedAction,
      },
      create: c,
    });
    console.log(`  ✓ ${c.id} — ${c.customerName} — ${c.productModel}`);
  }
  console.log("✓ Seed complete.");
}

main()
  .catch((e) => {
    console.error("✗ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
