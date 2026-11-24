"""Mete en data.*.js la tabla de validación generada por tools/node/mkvalid.js (out/valid.json): window.VALID y window.VALIDC,
y actualiza el hash en index.html y lab.html. Uso: python3 pubvalid.py"""
import json, glob, hashlib, os, re, subprocess
P = '/home/claude/pages'
J = json.load(open('/home/claude/tools/out/valid.json'))
dpath = glob.glob(f'{P}/a/data.*.js')[0]
s = open(dpath).read()
i = s.find('window.VALID=')
assert i >= 0
j = s.find('];', i) + 2
s2 = s[:i] + 'window.VALID=' + json.dumps(J['VALID'], separators=(',', ':'), ensure_ascii=False) + ';' + s[j:]
k = s2.find('window.VALIDC=')
c = 'window.VALIDC=' + json.dumps(J['VALIDC'], separators=(',', ':'), ensure_ascii=False) + ';'
if k >= 0:
    k2 = s2.find('};', k) + 2
    s2 = s2[:k] + c + s2[k2:]
else:
    i2 = s2.find('window.VALID=')
    s2 = s2[:i2] + c + s2[i2:]
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
