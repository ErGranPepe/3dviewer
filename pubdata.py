"""Mete en data.*.js los muros reales de /tmp/walls.json (clave "wr" de cada circuito) y actualiza el hash en index.html.
Uso: python3 pubdata.py"""
import json, glob, hashlib, os, re, subprocess
P = '/home/claude/pages'
dpath = glob.glob(f'{P}/a/data.*.js')[0]
s = open(dpath).read()
i = s.find('window.REAL_TRACKS='); j = s.find(';window.', i + 5)
T = json.loads(s[i + 19:j])
WJ = json.load(open('/tmp/walls.json'))
for t in T:
    if t['key'] in WJ: t['wr'] = {'n': WJ[t['key']]['n'], 'w': WJ[t['key']]['w']}
    else: t.pop('wr', None)
s2 = s[:i + 19] + json.dumps(T, separators=(',', ':'), ensure_ascii=False) + s[j:]
hd = hashlib.sha256(s2.encode()).hexdigest()[:10]
ndp = f'{P}/a/data.{hd}.js'
if ndp != dpath:
    open(ndp, 'w').write(s2)
    subprocess.run(['git', '-C', P, 'rm', '-q', '--cached', dpath[len(P) + 1:]], capture_output=True)
    os.remove(dpath)
    for f in ('index.html', 'lab.html'):
        ix = open(f'{P}/{f}').read()
        if dpath[len(P) + 1:] in ix: open(f'{P}/{f}', 'w').write(ix.replace(dpath[len(P) + 1:], ndp[len(P) + 1:]))
    ix = open(f'{P}/index.html').read()
    app = re.search(r'a/app\.([0-9a-f]+)\.js', ix).group(1)
    v = app + hd[:4]
    open(f'{P}/version.json', 'w').write('{"b": "%s"}\n' % v)
    open(f'{P}/index.html', 'w').write(re.sub(r'var B="[0-9a-f]*"', 'var B="%s"' % v, ix))
    print('data ->', ndp, len(s2) // 1024, 'KB', 'version', v)
else: print('sin cambios')
