import sys, json, struct
def load(path):
    with open(path, 'rb') as f:
        d = f.read()
    magic, ver, ln = struct.unpack('<4sII', d[:12])
    assert magic == b'glTF'
    off = 12; js = None; bin_ = None
    while off < ln:
        cl, ct = struct.unpack('<II', d[off:off+8]); off += 8
        if ct == 0x4E4F534A: js = json.loads(d[off:off+cl].decode('utf8'))
        elif ct == 0x004E4942: bin_ = (off, cl)
        off += cl
    return js, bin_, d
if __name__ == '__main__':
    for p in sys.argv[1:]:
        js, b, d = load(p)
        print('==', p.split('/')[-1], 'bin', b[1] if b else None)
        print(' asset', js.get('asset'), 'ext', js.get('extensionsUsed'), js.get('extensionsRequired'))
        acc = js.get('accessors', [])
        tri = 0; vtx = 0
        for m in js.get('meshes', []):
            for pr in m['primitives']:
                if 'indices' in pr: tri += acc[pr['indices']]['count'] // 3
                else: tri += acc[pr['attributes']['POSITION']]['count'] // 3
                vtx += acc[pr['attributes']['POSITION']]['count']
        print(' nodes', len(js.get('nodes', [])), 'meshes', len(js.get('meshes', [])), 'mats', len(js.get('materials', [])), 'tex', len(js.get('textures', [])), 'img', len(js.get('images', [])), 'tri', tri, 'vtx', vtx)
        print(' scenes', js.get('scenes'))
