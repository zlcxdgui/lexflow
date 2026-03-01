const { PrismaClient } = require('@prisma/client');

function normalizeFolder(value) {
  const text = String(value || '').trim();
  return text || 'Geral';
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => String(tag || '').trim())
    .filter(Boolean)
    .slice(0, 20);
}

function sameTags(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        action: 'DOCUMENT_META_UPDATED',
        metaJson: { not: null },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        tenantId: true,
        metaJson: true,
      },
    });

    const latestByDocument = new Map();
    for (const row of logs) {
      try {
        const parsed = JSON.parse(row.metaJson || '{}');
        const documentId = String(parsed.documentId || '').trim();
        if (!documentId) continue;
        latestByDocument.set(documentId, {
          tenantId: row.tenantId,
          folder: normalizeFolder(parsed.folder),
          tags: normalizeTags(parsed.tags),
        });
      } catch {
        // ignore invalid rows
      }
    }

    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const [documentId, meta] of latestByDocument.entries()) {
      const doc = await prisma.document.findFirst({
        where: { id: documentId, tenantId: meta.tenantId },
        select: { id: true, folder: true, tags: true },
      });

      if (!doc) {
        notFound += 1;
        continue;
      }

      const currentFolder = normalizeFolder(doc.folder);
      const currentTags = normalizeTags(doc.tags);
      if (currentFolder === meta.folder && sameTags(currentTags, meta.tags)) {
        skipped += 1;
        continue;
      }

      await prisma.document.update({
        where: { id: doc.id },
        data: { folder: meta.folder, tags: meta.tags },
      });
      updated += 1;
    }

    console.log(
      `[backfill:document-meta] lidos=${logs.length} distintos=${latestByDocument.size} atualizados=${updated} sem_alteracao=${skipped} nao_encontrados=${notFound}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[backfill:document-meta] erro', err);
  process.exit(1);
});
