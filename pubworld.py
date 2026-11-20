"""Publica /tmp/w_<Track>.json en pages/t con hash nuevo y actualiza data.*.js e index.html.
Uso: python3 pubworld.py Track [Track…]"""
import sys, glob, hashlib, os, re, subprocess
P = '/home/claude/pages'
dpath = glob.glob(f'{P}/a/data.*.js')[0]
data = open(dpath).read()
for key in sys.argv[1:]:
    src = f'/tmp/w_{key}.json'
    b = open(src, 'rb').read()
    h = hashlib.sha256(b).hexdigest()[:10]
    new = f't/w_{key}.{h}.json'
    m = re.search(r'"w_%s": "(t/w_%s\.[0-9a-f]+\.json)"' % (key, key), data)
    old = m.group(1)
    if old == new: print(key, 'sin cambios'); continue
    open(f'{P}/{new}', 'wb').write(b)
    data = data.replace(old, new)
    subprocess.run(['git', '-C', P, 'rm', '-q', '--cached', old], capture_output=True)
    if os.path.exists(f'{P}/{old}'): os.remove(f'{P}/{old}')
    print(key, old, '->', new, len(b) // 1024, 'KB')
hd = hashlib.sha256(data.encode()).hexdigest()[:10]
ndp = f'{P}/a/data.{hd}.js'
if ndp != dpath:
    open(ndp, 'w').write(data)
    subprocess.run(['git', '-C', P, 'rm', '-q', '--cached', dpath[len(P) + 1:]], capture_output=True)
    os.remove(dpath)
    ix = open(f'{P}/index.html').read().replace(dpath[len(P) + 1:], ndp[len(P) + 1:])
    open(f'{P}/index.html', 'w').write(ix)
    # versión = app(10) + data(4), igual que deploy.sh
    app = re.search(r'a/app\.([0-9a-f]+)\.js', ix).group(1)
    v = app + hd[:4]
    open(f'{P}/version.json', 'w').write('{"b": "%s"}\n' % v)
    ix = re.sub(r'var B="[0-9a-f]*"', 'var B="%s"' % v, ix)
    open(f'{P}/index.html', 'w').write(ix)
    print('data ->', ndp, 'version', v)
