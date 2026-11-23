import sys,os,subprocess,json
# uso: dbgq.py IDX '<json Q>'
env=dict(os.environ);env['IDX']='[%s]'%sys.argv[1];env['MAXC']='60000'
js=open('dbg_p.js').read().replace('window.__Q',sys.argv[2])
open('dbg_p_run.js','w').write(js)
r=subprocess.run(['python3','dbg.py','dbg_p_run.js'],env=env,capture_output=True,text=True,timeout=900)
for ln in r.stdout.splitlines():
    k=ln.find('{')
    if k<0: print(ln); continue
    try: d=json.loads(ln[k:])
    except Exception as e: print(ln[:500]); continue
    print({k:v for k,v in d.items() if k!='rows'})
    for row in d['rows']: print(row)
print(r.stderr[-500:])
