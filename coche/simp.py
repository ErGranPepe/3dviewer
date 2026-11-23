import subprocess, json, struct, numpy as np, tempfile, os
def simplify(V, F, jobs):
    """V (n,3) float, F (m,3) int; jobs: lista de dict(target=nº triángulos, error=m, flags=[...]) -> lista de F simplificadas (índices sobre V)"""
    with tempfile.TemporaryDirectory() as td:
        a = os.path.join(td, 'in.bin'); b = os.path.join(td, 'out.bin')
        with open(a, 'wb') as f:
            f.write(struct.pack('<II', len(V), F.size)); f.write(np.ascontiguousarray(V, dtype=np.float32).tobytes()); f.write(np.ascontiguousarray(F, dtype=np.uint32).tobytes())
        subprocess.run(['node', '/home/claude/tools/viewer/simp.mjs', a, b, json.dumps(jobs)], check=True, cwd='/home/claude/tools/viewer')
        d = open(b, 'rb').read()
    n = struct.unpack('<I', d[:4])[0]; off = 4; out = []
    for _ in range(n):
        ni = struct.unpack('<I', d[off:off + 4])[0]; err = struct.unpack('<f', d[off + 4:off + 8])[0]; off += 8
        out.append((np.frombuffer(d, dtype=np.uint32, count=ni, offset=off).reshape(-1, 3).astype(np.int64), err)); off += ni * 4
    return out
