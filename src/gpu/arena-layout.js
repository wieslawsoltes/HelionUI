import { align } from '../core/schema.js';
/** Shared host/native-test memory layout. Sizes are bytes; constants are words. */
export const DRAW_HEADS = 2708; // 512 nodes + 130 grid + 8×130 editor + 8×128 list sections, rounded to four words
export const DRAW_HEADER_WORDS = 4 + DRAW_HEADS;
export function arenaLayout(limits) {
  const maxTiles = Math.min(Math.ceil(limits.maxDimension / 16) ** 2, limits.maxRenderTiles ?? Infinity);
  const constants = { DRAW_HEADS, MAX_PRIMITIVES: limits.maxPrimitives, MAX_JOBS: limits.maxJobs,
    MAX_STRIPS: limits.maxStrips, MAX_ALPHA: limits.maxAlphaTiles,
    TILE_CAPACITY: limits.maxTileEntries, HITS: 64, JOBS: 1024 };
  const c = constants;
  c.STRIPS = align(c.JOBS + c.MAX_JOBS * 2, 16);
  c.ALPHA = align(c.STRIPS + c.MAX_STRIPS * 8, 16);
  c.TILE_COUNTS = align(c.ALPHA + c.MAX_ALPHA * 4, 16);
  c.TILE_LIST = align(c.TILE_COUNTS + maxTiles, 16);
  c.DAMAGE = align(c.TILE_LIST + maxTiles * c.TILE_CAPACITY, 16);
  // Disjoint cache ownership: at most 32 slots per owner, never a cross-owner eviction.
  c.GLYPH_SLOTS = limits.glyphCacheSlots;
  c.GLYPH_SHARDS = Math.max(1, c.GLYPH_SLOTS / 32);
  c.GLYPH_BUCKETS = align(c.DAMAGE + maxTiles, 16);
  c.GLYPH_REQUESTS = align(c.GLYPH_BUCKETS + c.GLYPH_SHARDS, 16);
  c.GLYPH_STATS = align(c.GLYPH_REQUESTS + limits.maxPrimitives * 12, 16);
  c.GLYPH_META = 16; c.GLYPH_JOBS = c.GLYPH_META + c.GLYPH_SLOTS * 16;
  c.GLYPH_PIXELS = c.GLYPH_JOBS + c.GLYPH_SLOTS * 2;
  return { glyphCacheBytes: (c.GLYPH_PIXELS + c.GLYPH_SLOTS * 1024) * 4, constants, maxTiles, scratchBytes: (c.GLYPH_STATS + 16) * 4,
    drawBytes: DRAW_HEADER_WORDS * 4 + limits.maxPrimitives * 128 };
}
