import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/db/audit";

export const dynamic = "force-dynamic";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const ALLOWED_DOC_TYPES = new Set([
  "image",
  "invoice",
  "delivery_note",
  "warranty",
  "return_request",
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const caseExists = await prisma.case.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!caseExists) {
    return NextResponse.json({ error: "case not found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "expected multipart/form-data" },
      { status: 400 }
    );
  }

  const file = form.get("file");
  const docType = form.get("docType");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file field required" }, { status: 400 });
  }
  if (typeof docType !== "string" || !ALLOWED_DOC_TYPES.has(docType)) {
    return NextResponse.json(
      { error: `docType must be one of: ${Array.from(ALLOWED_DOC_TYPES).join(", ")}` },
      { status: 400 }
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `mimeType ${file.type} not allowed` },
      { status: 415 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `file too large (max ${MAX_BYTES} bytes)` },
      { status: 413 }
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "BLOB_READ_WRITE_TOKEN not configured. Set it locally via `vercel env pull .env.local`.",
      },
      { status: 503 }
    );
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const blob = await put(
    `cases/${params.id}/${Date.now()}-${safeName}`,
    file,
    { access: "public", contentType: file.type }
  );

  const doc = await prisma.document.create({
    data: {
      caseId: params.id,
      docType,
      blobUrl: blob.url,
      mimeType: file.type,
    },
  });

  await recordAudit({
    caseId: params.id,
    actor: "customer_service",
    action: "document_uploaded",
    details: {
      documentId: doc.id,
      docType: doc.docType,
      mimeType: doc.mimeType,
      bytes: file.size,
    },
  });

  return NextResponse.json(
    { documentId: doc.id, blobUrl: doc.blobUrl },
    { status: 201 }
  );
}
