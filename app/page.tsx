import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RecommendationBadge } from "@/components/recommendation-badge";

export const dynamic = "force-dynamic";

function statusBadge(status: string) {
  const map: Record<string, string> = {
    new: "bg-gray-100 text-gray-700 border-gray-300",
    analyzing: "bg-blue-100 text-blue-800 border-blue-300",
    analyzed: "bg-purple-100 text-purple-800 border-purple-300",
    decided: "bg-green-100 text-green-800 border-green-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
        map[status] ?? "bg-gray-100 text-gray-700 border-gray-300"
      }`}
    >
      {status}
    </span>
  );
}

export default async function HomePage() {
  let cases: Awaited<ReturnType<typeof loadCases>> = [];
  let loadError: string | null = null;
  try {
    cases = await loadCases();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "failed to load cases";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
          <p className="text-sm text-muted-foreground">
            Customer return complaints awaiting AI analysis or manager decision.
          </p>
        </div>
        <Link href="/cases/new">
          <Button>+ New case</Button>
        </Link>
      </div>

      {loadError ? (
        <Card className="p-6 border-red-300 bg-red-50 text-sm text-red-900">
          <p className="font-medium mb-1">Could not load cases.</p>
          <p className="font-mono text-xs whitespace-pre-wrap">{loadError}</p>
          <p className="mt-2">
            Check that <code>DATABASE_URL</code> is set and{" "}
            <code>pnpm prisma migrate dev --name init</code> has been run.
          </p>
        </Card>
      ) : cases.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <p>No cases yet.</p>
          <p className="text-sm mt-1">
            Create one via <Link className="underline" href="/cases/new">/cases/new</Link>{" "}
            or seed the demo set with <code>pnpm seed</code>.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Complaint</TableHead>
                <TableHead className="text-center">Files</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead>AI recommendation</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((c) => (
                <TableRow key={c.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/cases/${c.id}`} className="font-medium hover:underline">
                      {c.customerName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{c.productModel}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate text-muted-foreground">
                    {c.complaintText}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums">
                    {c._count.documents}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums">
                    {c.analysis ? c.analysis.replacementValidityScore : "—"}
                  </TableCell>
                  <TableCell>
                    {c.analysis ? (
                      <RecommendationBadge value={c.analysis.recommendation} size="sm" />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.decision ? (
                      <RecommendationBadge value={c.decision.decision} size="sm" />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>{statusBadge(c.status)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                    {new Intl.DateTimeFormat("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(c.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

async function loadCases() {
  return prisma.case.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      analysis: {
        select: { recommendation: true, replacementValidityScore: true },
      },
      decision: { select: { decision: true } },
      _count: { select: { documents: true } },
    },
  });
}
