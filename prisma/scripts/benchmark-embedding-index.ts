// File: scripts/benchmark-embedding-index.ts
// Usage: docker exec -it frontend yarn ts-node -r tsconfig-paths/register scripts/benchmark-embedding-index.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BenchmarkResult {
  label: string;
  executionTimeMs: number;
  planType: string;
  rowCount: number;
}

async function getEmbeddingCount(): Promise<number> {
  const result = await prisma.embedding.count();
  return result;
}

async function checkIndexExists(): Promise<boolean> {
  const result = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'Embedding'
      AND indexname = 'embedding_hnsw_idx'
    ) as exists;
  `;
  return result[0]?.exists ?? false;
}

async function runExplainAnalyze(): Promise<BenchmarkResult> {
  // Generate a sample vector (1536 dimensions of 0.1)
  const sampleVector = Array(1536).fill(0.1);
  const vectorString = `[${sampleVector.join(',')}]`;

  const explainResult = await prisma.$queryRaw<{ 'QUERY PLAN': string }[]>`
    EXPLAIN ANALYZE
    SELECT id, content, (1 - (embedding <=> ${vectorString}::vector)) as score
    FROM "Embedding"
    ORDER BY embedding <=> ${vectorString}::vector
    LIMIT 10;
  `;

  const planText = explainResult.map(r => r['QUERY PLAN']).join('\n');

  // Extract execution time from plan
  const timeMatch = planText.match(/Execution Time: ([\d.]+) ms/);
  const executionTimeMs = timeMatch ? parseFloat(timeMatch[1]) : -1;

  // Determine plan type
  const planType = planText.includes('Index Scan using embedding_hnsw_idx')
    ? 'Index Scan (HNSW)'
    : planText.includes('Seq Scan')
      ? 'Sequential Scan'
      : 'Unknown';

  // Get row count from plan
  const rowMatch = planText.match(/rows=(\d+)/);
  const rowCount = rowMatch ? parseInt(rowMatch[1]) : 0;

  return { label: 'Vector Search', executionTimeMs, planType, rowCount };
}

async function createIndex(): Promise<void> {
  console.log('Creating HNSW index...');
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS embedding_hnsw_idx
    ON "Embedding"
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  `;
  console.log('Index created.');
}

async function dropIndex(): Promise<void> {
  console.log('Dropping HNSW index...');
  await prisma.$executeRaw`DROP INDEX IF EXISTS embedding_hnsw_idx;`;
  console.log('Index dropped.');
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('EMBEDDING VECTOR INDEX BENCHMARK');
  console.log('='.repeat(60));

  const embeddingCount = await getEmbeddingCount();
  console.log(`\nTotal embeddings in database: ${embeddingCount.toLocaleString()}`);

  if (embeddingCount === 0) {
    console.log('\nNo embeddings found. Upload some documents first.');
    return;
  }

  const indexExists = await checkIndexExists();
  console.log(`HNSW index currently exists: ${indexExists}`);

  // Benchmark WITHOUT index
  console.log('\n' + '-'.repeat(60));
  console.log('BENCHMARK: Without HNSW Index (Sequential Scan)');
  console.log('-'.repeat(60));

  if (indexExists) {
    await dropIndex();
  }

  const withoutIndex = await runExplainAnalyze();
  console.log(`Plan Type: ${withoutIndex.planType}`);
  console.log(`Execution Time: ${withoutIndex.executionTimeMs.toFixed(2)} ms`);

  // Benchmark WITH index
  console.log('\n' + '-'.repeat(60));
  console.log('BENCHMARK: With HNSW Index');
  console.log('-'.repeat(60));

  await createIndex();

  // Run a few times to warm up
  await runExplainAnalyze();
  await runExplainAnalyze();

  const withIndex = await runExplainAnalyze();
  console.log(`Plan Type: ${withIndex.planType}`);
  console.log(`Execution Time: ${withIndex.executionTimeMs.toFixed(2)} ms`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Embeddings: ${embeddingCount.toLocaleString()}`);
  console.log(`Without Index: ${withoutIndex.executionTimeMs.toFixed(2)} ms (${withoutIndex.planType})`);
  console.log(`With Index: ${withIndex.executionTimeMs.toFixed(2)} ms (${withIndex.planType})`);

  if (withoutIndex.executionTimeMs > 0 && withIndex.executionTimeMs > 0) {
    const speedup = withoutIndex.executionTimeMs / withIndex.executionTimeMs;
    console.log(`Speedup: ${speedup.toFixed(1)}x faster with index`);
  }

  console.log('\nNote: Index has been LEFT IN PLACE after benchmark.');
  console.log('To remove: DROP INDEX embedding_hnsw_idx;');
}

main()
  .catch((e) => {
    console.error('Benchmark failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
