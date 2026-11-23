import json,re,sys
skip=set(sys.argv[2:])
show=True
def d(o):
    if not o: return '-'
    if 'none' in o or 'err' in o: return json.dumps(o)
    return '%s %s %s %s%s%s n=%s %s %s %s %s'%((o.get('src','?') or '?')[5:],o.get('th',''),(o.get('mt') or '')[4:9],o.get('col',''),' map' if o.get('map') else '',' INST' if o.get('inst') else '',o.get('n',''),(o.get('geo') or '')[:6],o.get('sz',''),('y=%s'%o['y']) if 'y' in o else ('px=%s/%s'%(o.get('px'),o.get('of'))),o.get('path',''))
for ln in open(sys.argv[1]):
    ln=ln.rstrip()
    if 'tiles' in ln:
        key=ln.split()[1];show=key not in skip
        if show: print(ln)
        continue
    if not show: continue
    m=re.match(r'\s+([+-]) (\{.*)',ln)
    if not m: print(ln[:200]); continue
    try: c=json.loads(m.group(2))
    except Exception: print('  ?',ln[:200]); continue
    print('  %s i%-5d s%-5d L%-4d dh%-6s px%-5d lat%-6s %-6s| %s'%(m.group(1),c['i0'],c['s0'],c['len'],c['dh'],c['px'],c['lat'],c['kind'],d(c.get('obj'))))
    if c.get('ob2') is not None: print('      >> %s'%d(c.get('ob2')))
