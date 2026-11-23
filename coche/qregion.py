import sys, numpy as np
sys.path.insert(0, '/home/claude/tools/car')
from glbwrite import write_glb, submesh
d = np.load('/home/claude/tools/out/qv_welded.npz', allow_pickle=True)
V, F, lab = d['V'], d['F'], d['lab']; B = F[lab == 0]
box = [float(x) for x in sys.argv[1].split(',')]
P = V[B]
m = ((P[:, :, 0] >= box[0]) & (P[:, :, 0] <= box[1]) & (P[:, :, 1] >= box[2]) & (P[:, :, 1] <= box[3]) & (P[:, :, 2] >= box[4]) & (P[:, :, 2] <= box[5])).all(1)
v, f = submesh(V, B[m])
write_glb(sys.argv[2], [dict(name='reg', V=v, F=f, color=(.72, .74, .78), met=.2, rou=.45)])
print(m.sum())
