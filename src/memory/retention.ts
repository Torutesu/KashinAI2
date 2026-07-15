// src/memory/retention.ts
//
// Pure helper for the memory retention policy. Kept separate so it can be unit
// tested without pulling in Prisma / LanceDB / the embedding model.

/** The timestamp before which memories are considered expired. */
export function retentionCutoff(retentionDays: number, now: Date): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}
