// uso: node simp.mjs in.bin out.bin  (in: u32 nv, u32 ni, f32 pos[nv*3], u32 idx[ni]; trabajos por stdin: líneas "target error flags")
import fs from 'fs';
import { MeshoptSimplifier } from 'meshoptimizer';
await MeshoptSimplifier.ready; MeshoptSimplifier.useExperimentalFeatures = true;
const buf = fs.readFileSync(process.argv[2]);
const nv = buf.readUInt32LE(0), ni = buf.readUInt32LE(4);
const pos = new Float32Array(buf.buffer, buf.byteOffset + 8, nv * 3).slice();
const idx = new Uint32Array(buf.buffer, buf.byteOffset + 8 + nv * 12, ni).slice();
const jobs = JSON.parse(process.argv[4]);
const outs = [];
for (const j of jobs) {
  let cur = idx;
  // varias pasadas: el simplificador puede quedarse corto en una sola
  let res = MeshoptSimplifier.simplify(cur, pos, 3, Math.min(j.target * 3, cur.length), j.error, j.flags || ['ErrorAbsolute']);
  outs.push({ n: res[0].length, err: res[1], idx: res[0] });
}
const parts = [Buffer.from(new Uint32Array([outs.length]).buffer)];
for (const o of outs) { parts.push(Buffer.from(new Uint32Array([o.n]).buffer)); parts.push(Buffer.from(new Float32Array([o.err]).buffer)); parts.push(Buffer.from(o.idx.buffer, o.idx.byteOffset, o.idx.byteLength)); }
fs.writeFileSync(process.argv[3], Buffer.concat(parts));
