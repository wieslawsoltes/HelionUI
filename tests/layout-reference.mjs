// CPU oracle for Helion's documented layout subset. NOT an app fallback and NOT WPF conformance.
import { fromBits } from '../src/core/schema.js';
import { clamp } from './reference.mjs';
import { textReference } from './text-reference.mjs';
const INF = 1e7, NONE = 0xffffffff;
export function layoutReference(compiled, width, height, page = 0) {
  const heap = new Uint32Array(compiled.heap), u = new Uint32Array(compiled.nodes.buffer.slice(0)), f = new Float32Array(u.buffer);
  const hf = i => fromBits(heap[i]);
  const nodes = Array.from({ length: compiled.nodeCount }, (_, i) => {
    const o = i * 72; return { i, kind: u[o], parent: u[o + 1], children: [...heap.slice(u[o + 2], u[o + 2] + u[o + 3])], depth: u[o + 4], flags: u[o + 5], offset: u[o + 6], length: u[o + 7],
      size: [...f.slice(o + 8, o + 12)], limits: [...f.slice(o + 12, o + 16)], margin: [...f.slice(o + 16, o + 20)], placement: [...u.slice(o + 24, o + 28)], tracks: [...u.slice(o + 28, o + 32)],
      misc: [...f.slice(o + 32, o + 36)], binding: u[o + 41], span: [...f.slice(o + 44, o + 46)], page: f[o + 46], aux: [...u.slice(o + 68, o + 72)], av: [0, 0, 0, 0], rect: [0, 0, 0, 0] };
  });
  const visible = i => { for (let at = i; at !== NONE; at = nodes[at].parent) { const n = nodes[at]; if (n.flags & 32 || n.page >= 0 && n.page !== page || width < fromBits(n.aux[1]) || width >= fromBits(n.aux[2])) return false; } return true; };
  const intrinsic = (n, axis) => {
    const count = n.tracks[axis * 2 + 1], base = n.tracks[axis * 2]; let sum = Math.max(0, count - 1) * n.limits[3];
    for (let k = 0; k < count; k++) {
      const at = base + k * 4; let size = 0;
      if (heap[at] === 0) size = hf(at + 1);
      else for (const id of n.children) { const c = nodes[id], start = c.placement[2 + axis], span = c.span[axis]; if (visible(id) && k >= start && k < start + span) size = Math.max(size, c.av[axis + 2] / span); }
      new Float32Array(heap.buffer)[at + 2] = size; sum += size;
    } return sum;
  };
  const track = (n, axis, k, available) => {
    const count = n.tracks[axis * 2 + 1], base = n.tracks[axis * 2], at = base + k * 4, kind = heap[at];
    if (kind === 0) return hf(at + 1); if (kind === 1 || available >= INF / 2) return hf(at + 2);
    let occupied = Math.max(0, count - 1) * n.limits[3], weights = 0;
    for (let j = 0; j < count; j++) { const a = base + j * 4; if (heap[a] === 2) weights += hf(a + 1); else occupied += hf(a + (heap[a] === 0 ? 1 : 2)); }
    return Math.max(0, available - occupied) * hf(at + 1) / Math.max(weights, 1e-5);
  };
  const span = (n, axis, start, length, available) => {
    let position = 0, size = 0; for (let k = 0; k < n.tracks[axis * 2 + 1]; k++) {
      const value = track(n, axis, k, available);
      if (k < start) position += value + n.limits[3]; else if (k < start + length) { size += value; if (k + 1 < start + length) size += n.limits[3]; }
    } return [position, size];
  };
  const naturalText = (n, available) => {
    const metrics=textReference(compiled,n.i), cps=[...heap.slice(n.offset,n.offset+n.length)];
    const desired=metrics.measure(cps,n.misc[2],n.flags&4 ? Math.max(.001,available) : 0);
    if(n.binding) desired[0]+=n.misc[2]*5.5;
    return desired;
  };
  const measure = (n, natural) => {
    if (!visible(n.i)) { n.av[2] = n.av[3] = 0; return; }
    const pad = n.limits[2]; const av = [0, 1].map(a => Math.max(0, (natural ? INF : n.av[a]) - 2 * pad));
    for (let a = 0; a < 2; a++) if (n.size[a] >= 0) av[a] = Math.min(av[a], n.size[a] - 2 * pad);
    let desired = [0, 0];
    switch (n.kind) {
      case 1: desired = [intrinsic(n, 0), intrinsic(n, 1)]; break;
      case 2: { const axis = n.flags & 2 ? 0 : 1; let count = 0; for (const id of n.children) if (visible(id)) { const c = nodes[id]; desired[axis] += c.av[axis + 2]; desired[1 - axis] = Math.max(desired[1 - axis], c.av[3 - axis]); count++; } desired[axis] += Math.max(0, count - 1) * n.limits[3]; break; }
      case 3: for (const id of n.children.filter(visible)) for (let a = 0; a < 2; a++) desired[a] = Math.max(desired[a], nodes[id].misc[a] + nodes[id].av[a + 2]); break;
      case 4: case 13: for (const id of n.children) for (let a = 0; a < 2; a++) desired[a] = Math.max(desired[a], nodes[id].av[a + 2]); break;
      case 5: desired = naturalText(n, Math.max(0, av[0])); break;
      case 6: desired = naturalText(n, INF).map((x, a) => x + [28, 14][a]); break;
      case 7: desired = naturalText(n, INF).map((x, a) => x + [38, 8][a]); break;
      case 8: desired = [160, 32]; break; case 9: desired = [200, Math.max(38,textReference(compiled,n.i).lineHeight(n.misc[2])+14)]; break; case 10: desired = [140, 12]; break; case 11: desired = [500, 320]; break;
      case 12: desired = [hf(n.aux[0] + 8) - hf(n.aux[0] + 6), hf(n.aux[0] + 9) - hf(n.aux[0] + 7)]; break;
    }
    for (let a = 0; a < 2; a++) n.av[a + 2] = Math.fround(clamp(n.size[a] >= 0 ? n.size[a] : desired[a] + 2 * pad, n.size[a + 2], n.limits[a]) + n.margin[a] + n.margin[a + 2]);
  };
  const ordered = [...nodes].sort((a, b) => a.depth - b.depth);
  for (const n of [...ordered].reverse()) measure(n, true);
  for (const n of ordered) {
    let av = [width, height];
    if (n.parent !== NONE) {
      const p = nodes[n.parent]; av = [0, 1].map(a => Math.max(0, (p.size[a] >= 0 ? p.size[a] : p.av[a]) - 2 * p.limits[2]));
      if (p.kind === 2) av[p.flags & 2 ? 0 : 1] = INF; if (p.kind === 13) av[1] = INF;
      if (p.kind === 1) av = av.map((v, a) => heap[p.tracks[a * 2] + n.placement[a + 2] * 4] === 1 ? INF : span(p, a, n.placement[a + 2], n.span[a], v)[1]);
    }
    for (let a = 0; a < 2; a++) n.av[a] = Math.fround(Math.min(n.limits[a], Math.max(0, av[a] - n.margin[a] - n.margin[a + 2])));
  }
  for (const n of [...ordered].reverse()) measure(n, false);
  for (const n of ordered) {
    if (!visible(n.i)) continue;
    let slot = [0, 0, width, height];
    if (n.parent !== NONE) {
      const p = nodes[n.parent]; slot = [p.rect[0] + p.limits[2], p.rect[1] + p.limits[2], Math.max(0, p.rect[2] - 2 * p.limits[2]), Math.max(0, p.rect[3] - 2 * p.limits[2])];
      if (p.kind === 1) for (let a = 0; a < 2; a++) { const [pos, size] = span(p, a, n.placement[a + 2], n.span[a], slot[a + 2]); slot[a] += pos; slot[a + 2] = size; }
      if (p.kind === 2) { const axis = p.flags & 2 ? 0 : 1; for (const id of p.children) { if (id === n.i) break; if (visible(id)) slot[axis] += nodes[id].av[axis + 2] + p.limits[3]; } slot[axis + 2] = n.av[axis + 2]; }
      if (p.kind === 3) for (let a = 0; a < 2; a++) { slot[a] += n.misc[a]; slot[a + 2] = n.av[a + 2]; }
      if (p.kind === 13) slot[3] = Math.max(slot[3], n.av[3]);
    }
    for (let a = 0; a < 2; a++) {
      slot[a] += n.margin[a]; slot[a + 2] = Math.max(0, slot[a + 2] - n.margin[a] - n.margin[a + 2]);
      let size = slot[a + 2]; if (n.placement[a] !== 0 || n.size[a] >= 0) size = Math.min(size, Math.max(0, n.av[a + 2] - n.margin[a] - n.margin[a + 2]));
      size = clamp(size, n.size[a + 2], n.limits[a]); const extra = Math.max(0, slot[a + 2] - size);
      if (n.placement[a] === 2) slot[a] += extra / 2; if (n.placement[a] === 3) slot[a] += extra;
      n.rect[a] = Math.fround(slot[a]); n.rect[a + 2] = Math.fround(size);
    }
  }
  return nodes;
}
