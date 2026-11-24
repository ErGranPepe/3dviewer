# Resume la salida de js/story.js (probe.py). uso: python3 storyfmt.py archivo.txt [pilotos] [ataques] [golpes] [pases] [ev]
import json,sys
s=open(sys.argv[1]).read(); opt=set(sys.argv[2:])
for line in s.splitlines():
    i=line.find('{')
    if i<0: continue
    try: d=json.loads(line[i:line.rfind('}')+1])
    except Exception as e:
        print('ILEGIBLE',str(e)[:80],line[:200]); continue
    R=d['resumen']
    M=d.get('multi')
    if M:
        print('==',d['circuito'],'HW',d.get('HW'),'·',M['carreras'],'carreras · pases',M['adelantamientos'],'reales tras v1',M['realesTrasV1'],'=',M['realesPorVuelta'],'/vuelta | contactos',M['contactos'],'fuertes',M['contactosFuertes'],'cadena',M['cadena'],'| ataques',M['ataques'],'ganados',M['ataquesGanados'],'| abandonos',M['abandonos'])
        print('   INCIDENTES',M.get('incidentes'),'fuertes',M.get('incidentesFuertes'),'| TROMPOS',M.get('trompos'),M.get('tromposCausa'))
        print('   ritmo medio P1',M['ritmoP1'],'P5',M['ritmoP5'],'P10',M['ritmoP10'],'| ganadores',M['ganadores'])
        print('   fin de los ataques:',M['finAtaque'])
        print('   eventos:',M['eventos'])
        if 'paradas' in opt: print('   paradas:',M['paradas'])
        if 'solo' not in opt: continue
    print('==',d['circuito'],'HW',d.get('HW'),'vueltas',d['vueltas'],'t',d['t'],'fin',d['over'],'| pases',R['adelantamientos'],'(v1',R['enVuelta1'],') reales tras v1',R['realesTrasV1'],'=',R['realesPorVuelta'],'/vuelta | contactos',R['contactos'],'fuertes',R['contactosFuertes'],'cadena',R['cadena'],'| ataques',R['ataques'],'ganados',R['ataquesGanados'],'| abandonos',R['abandonos'])
    print('   incidentes',R.get('incidentes'),'fuertes',R.get('incidentesFuertes'),'| trompos',R.get('trompos'),R.get('tromposCausa'))
    print('   fin de los ataques:',R['finAtaque'],'| eventos:',d['eventos'])
    if 'trompos' in opt:
        for q in d.get('trompos',[]):
            b=q.pop('caja',None); print('   T',q)
            if b and 'caja' in opt:
                print('      [t,s,lat,kmh,vol,gas,fre,atk,modo,delante,reflejo,intent,beta,r,sup,vref,tope,vecinos,vObj,desvio,marcas A=amarilla g=golpe s=salva e=err m=error c=cede t=frenaTarde b=azul d=defiende u=subvira p=peligro h=tocadoDelante P=pinchado L=carril]')
                for r in b: print('       ',r)
    if 'inc' in opt:
        for q in d.get('incidentes',[]): print('   I',q)
    print('   paradas:',R['vueltasDeParada'],'| calle de boxes medida',R.get('calleMedida'),'modelo',R.get('calleModelo'),'pista',R.get('pistaModelo'))
    P=d['pilotos']
    if 'pilotos' in opt:
        for p in P:
            print('  ',str(p['pos']).rjust(2),p['code'],'p'+str(p['parr']).rjust(2),p['drv'],'mej',p['mejor'],'med',p['media'],'±',p['desv'],'adel',p['adelReal'],'/',p['adel'],'-',p['sufr'],'atq',p['ataqueS'],'def',p['defS'],'err',p['errores'],'toq',p['toques'],'ch',p['choques'],'tr',p['trompos'],'|',p['paradas'],'| fren',p['frenada'],'vAp',p['vApex'],'limpio',p['limpio'],p['ret'])
    if 'vueltas' in opt:
        for p in P: print('  ',p['code'],' '.join(str(x) for x in p['vt']),'| pos',' '.join(str(x) for x in p['vp']),'|',' '.join(p['vg']),'| T del/tras',p.get('temp',''),'| ERS limpio/tráfico',p.get('ers'),'vmax',p.get('vmax'),'bat',p.get('bat'))
    if 'ataques' in opt:
        for a in d['ataques']: print('   A',a)
    if 'golpes' in opt:
        for h in d['golpes']:
            b=h.pop('box',None); print('   G',h)
            if b and 'caja' in opt:
                for k in ('a','b','x'):
                    if k=='x':
                        if not b.get('x'): continue
                        print('      (el de delante:',b.get('xc'),')')
                    print('     ',k,'[t,s,lat,kmh,vol,gas,fre,atk,modo,delante,reflejo,intent,beta,r,sup,vref,tope,vecinos,vObj,desvio,marcas]')
                    for r in (b.get(k) or []): print('       ',r)
    if 'pases' in opt:
        for a in d['pases']: print('   P',a)
    if 'ev' in opt:
        for e in d['ev']: print('   ',e)
    me=[p['media'] for p in P if p['media']]
    if me: print('   ritmo medio limpio: P1',me[0],'P5',me[min(4,len(me)-1)],'P10',me[min(9,len(me)-1)],'último',me[-1],'| mejor vuelta',min(p['mejor'] for p in P if p['mejor']))
