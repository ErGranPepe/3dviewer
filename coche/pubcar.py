# Copia car_hi/lo/far.bin a pages/t con su hash y actualiza las referencias (data.*.js, index.html, lab.html, version.json)
import hashlib, glob, os, re, sys, shutil, json
P = '/home/claude/pages'; SRC = sys.argv[1]
dpath = glob.glob(f'{P}/a/data.*.js')[0]; data = open(dpath, encoding='utf8').read()
for l in ('hi', 'lo', 'far'):
    b = open(f'{SRC}/car_{l}.bin', 'rb').read(); h = hashlib.sha256(b).hexdigest()[:10]
    for old in glob.glob(f'{P}/t/car_{l}.*.bin'):
        if not old.endswith(f'car_{l}.{h}.bin'): os.remove(old)
    open(f'{P}/t/car_{l}.{h}.bin', 'wb').write(b)
    data, n = re.subn(r't/car_%s\.[0-9a-f]+\.bin' % l, f't/car_{l}.{h}.bin', data); assert n == 1, (l, n)
hd = hashlib.sha256(data.encode('utf8')).hexdigest()[:10]; old = os.path.basename(dpath); new = f'data.{hd}.js'
if new != old:
    open(f'{P}/a/{new}', 'w', encoding='utf8').write(data); os.remove(dpath)
    for f in ('index.html', 'lab.html'):
        s = open(f'{P}/{f}', encoding='utf8').read(); s = s.replace('a/' + old, 'a/' + new)
        if f == 'index.html':
            app = re.search(r'a/app\.([0-9a-f]+)\.js', s).group(1); B = app + hd[:4]
            s = re.sub(r'var B="[0-9a-f]*"', f'var B="{B}"', s); json.dump({'b': B}, open(f'{P}/version.json', 'w'))
        open(f'{P}/{f}', 'w', encoding='utf8').write(s)
print('data', old, '->', new)
