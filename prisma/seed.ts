// prisma/seed.ts
// Insert the 8 demo cases from brief §9. Idempotent — safe to re-run.
// Run with: pnpm seed

import "dotenv/config";
import { prisma } from "../lib/db/prisma";

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
    productModel: "RX-450 Refrigerator",
    serialNumber: "RX450-2024-001",
    complaintText:
      "The refrigerator stopped cooling about 3 days ago. The power light is on and the freezer light works, but the inside is at room temperature. Bought 8 months ago.",
    requestedAction: "replacement",
  },
  {
    id: "demo-c002",
    customerName: "Mohamed Al-Hashemi",
    productModel: "WS-9KG Washing Machine",
    serialNumber: "WS9KG-2024-018",
    complaintText:
      "Washing machine arrived this morning with the front door panel snapped off at the hinge. Delivery was 2 hours ago, photos attached at unboxing.",
    requestedAction: "replacement",
  },
  {
    id: "demo-c003",
    customerName: "Layla Rahman",
    productModel: "DW-12P Dishwasher",
    serialNumber: "DW12P-2024-077",
    complaintText:
      "Noticed a small scratch on the side panel today, about 20 days after delivery. It does not affect operation but I would like a replacement.",
    requestedAction: "replacement",
  },
  {
    id: "demo-c004",
    customerName: "Omar Saleh",
    productModel: "MW-30L Microwave",
    serialNumber: "MW30L-2024-145",
    complaintText:
      "The unit is missing the rotating glass turntable. Everything else was in the box, but no turntable.",
    requestedAction: "replacement",
  },
  {
    id: "demo-c005",
    customerName: "Sara Petrov",
    productModel: "BL-500 Blender",
    serialNumber: null,
    complaintText:
      "The blender is defective. Want a replacement immediately.",
    requestedAction: "replacement",
  },
  {
    id: "demo-c006",
    customerName: "Jamal Ahmed",
    productModel: "AC-18K Split AC",
    serialNumber: "AC18K-2024-099",
    complaintText:
      "AC indoor unit is noisy with a low-frequency vibration when running on cool mode. No error codes on the display. Installation was 1 month ago.",
    requestedAction: "replacement",
  },
  {
    id: "demo-c007",
    customerName: "Hana Yousef",
    productModel: "OV-60L Built-In Oven",
    serialNumber: "OV60L-2024-022",
    complaintText:
      "The oven arrived dented on the right side. Photos attached showing the damage clearly.",
    requestedAction: "replacement",
  },
  {
    id: "demo-c008",
    customerName: "Tareq Habib",
    productModel: "TV-55Q QLED Television",
    serialNumber: "TV43L-2024-300",
    complaintText:
      "Ordered the 55-inch QLED model but the box delivered today contains a 43-inch LED model. The serial label on the unit confirms it is the wrong product family.",
    requestedAction: "replacement",
  },
];

async function main() {
  console.log(`→ Seeding ${DEMO_CASES.length} demo cases...`);
  for (const c of DEMO_CASES) {
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
