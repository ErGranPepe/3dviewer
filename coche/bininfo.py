import sys, json, struct
for p in sys.argv[1:]:
    d = open(p, 'rb').read()
    hl = struct.unpack('<I', d[:4])[0]
    h = json.loads(d[4:4+hl])
    print('==', p, len(d), 'groups', {k: [ [round(x,4) for x in v['t']], [round(x,4) for x in v['r']] ] for k, v in h['groups'].items()})
    tot = 0
    for i, m in enumerate(h['meshes']):
        tot += m['ic'] // 3
        print(i, m['g'], m['m'][:40], 'n', m['n'], 'tri', m['ic']//3, 'mn', [round(x,3) for x in m['mn']], 'mx', [round(x,3) for x in m['mx']], 'col', [round(x,3) for x in m.get('col', [])], 'met', m.get('met'), 'rou', m.get('rou'), 'tags' if 'c' in m else '', 'uv' if 'uv' in m else '')
    print('total tri', tot)
