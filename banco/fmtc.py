import json,sys
t=open(sys.argv[1]).read()
j=json.loads(t[t.index('{'):t.rindex('}')+1])
print(j['reg'],j['piloto'],'curvas',j['curvas'],'fallos',[f['key'] for f in j['fallos']])
for r in j['tramos']: print('  %-8s n=%2d  err medio %+6.1f km/h (%+5.1f %%)  |err| %.1f'%(r['tramo'],r['n'],r['errMedio'] or 0,r['errPct'] or 0,r['abs'] or 0))
e=[abs(r['err']) for r in j['vueltas'] if r['key']!='Monaco']
print('  vueltas:',' '.join('%s %+.1f'%(r['key'][:5],r['err']) for r in j['vueltas']),'| media |err| sin Mónaco %.2f %%'%(sum(e)/len(e)))
if len(sys.argv)>2:
    for r in j['peores'][:int(sys.argv[2])]: print('    ',r)
