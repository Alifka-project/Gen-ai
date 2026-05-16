import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  let chunks: Awaited<ReturnType<typeof loadChunks>> = [];
  let loadError: string | null = null;
  try {
    chunks = await loadChunks();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "failed to load chunks";
  }

  const grouped = new Map<string, typeof chunks>();
  for (const c of chunks) {
    const list = grouped.get(c.policyName) ?? [];
    list.push(c);
    grouped.set(c.policyName, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Policy knowledge base</h1>
        <p className="text-sm text-muted-foreground">
          Chunked, embedded policy text used by the RAG pipeline. Re-index by running{" "}
          <code>pnpm index-policies</code> after editing the markdown files in{" "}
          <code>data/policies/</code>.
        </p>
      </div>

      {loadError ? (
        <Card className="p-6 border-red-300 bg-red-50 text-sm text-red-900">
          <p className="font-medium">Could not load chunks.</p>
          <p className="font-mono text-xs">{loadError}</p>
        </Card>
      ) : chunks.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <p>No policy chunks indexed yet.</p>
          <p className="text-sm mt-1">
            Run <code>pnpm index-policies</code> to chunk and embed{" "}
            <code>data/policies/*.md</code>.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([policy, list]) => (
            <Card key={policy} className="p-4">
              <h2 className="text-lg font-semibold">{policy}</h2>
              <p className="text-xs text-muted-foreground mb-3">
                {list.length} section{list.length === 1 ? "" : "s"} indexed
              </p>
              <ul className="space-y-2">
                {list
                  .sort((a, b) => a.sectionRef.localeCompare(b.sectionRef))
                  .map((c) => (
                    <li key={c.id} className="rounded border bg-muted/30 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-medium">
                          §{c.sectionRef}
                        </span>
                        {c.ruleType ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                            {c.ruleType}
                          </span>
                        ) : null}
                      </div>
                      <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/80">
                        {c.chunkText.replace(/^#.+\n+/, "")}
                      </pre>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

async function loadChunks() {
  return prisma.policyChunk.findMany({
    select: {
      id: true,
      policyName: true,
      sectionRef: true,
      ruleType: true,
      chunkText: true,
    },
    orderBy: [{ policyName: "asc" }, { sectionRef: "asc" }],
  });
}
