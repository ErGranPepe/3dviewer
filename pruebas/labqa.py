# Comprobación del Laboratorio: las seis pestañas en escritorio y móvil, los dos modos, y a fondo el motor 3D
# (tres vistas, capas, parámetros extremos de geometría y la comprobación de que ningún tubo atraviesa a otro).
import asyncio,os,json,subprocess,time
from playwright.async_api import async_playwright
OUT=os.environ.get('OUT','labqa/');os.makedirs(OUT,exist_ok=True)
SETP="(l,v)=>{for(const r of document.querySelectorAll('.prow')){const a=r.querySelector('label');if(a&&a.textContent.trim()===l){const n=r.querySelector('input[type=number]');if(!n)return false;n.value=v;n.dispatchEvent(new Event('change'));return true}}return false}"
async def run():
    srv=subprocess.Popen(['python3','-m','http.server','8791'],cwd='/home/claude/pages',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
    rep={}
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        async def page(vp):
            pg=await b.new_page(viewport=vp);errs=[]
            pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)[:300]))
            pg.on('console',lambda m: m.type=='error' and 'ERR_' not in m.text and errs.append('CONSOLE '+m.text[:300]))
            return pg,errs
        tabs=os.environ.get('TABS','susp,engine,limits,drive,chassis,tyre,validate').split(',')
        for vp,tag in [({'width':1280,'height':800},'d'),({'width':390,'height':844},'m')]:
            for t in tabs:
                pg,errs=await page(vp)
                await pg.goto('http://localhost:8791/lab.html#'+t,wait_until='load');await pg.wait_for_timeout(4500)
                for md in ['pro','easy']:
                    await pg.evaluate("(()=>{const b=document.querySelector('[data-setmode=%s]');b&&b.click()})()"%md);await pg.wait_for_timeout(1200)
                ov=await pg.evaluate("document.documentElement.scrollWidth>window.innerWidth+2")
                await pg.screenshot(path=OUT+'lab_%s_%s.png'%(t,tag))
                rep['lab %s %s'%(t,tag)]={'overflowX':ov,'errs':list(errs)};await pg.close()
        if 'engine' in tabs and not os.environ.get('QUICK'):
            pg,errs=await page({'width':1280,'height':800})
            await pg.goto('http://localhost:8791/lab.html#engine',wait_until='load');await pg.wait_for_timeout(5000)
            await pg.evaluate("(()=>{const b=document.querySelector('[data-setmode=pro]');b&&b.click()})()");await pg.wait_for_timeout(800)
            info={}
            for w in ['xray','closed','cut']:
                await pg.evaluate("document.querySelector('#e3View3 [data-w=%s]').click()"%w);await pg.wait_for_timeout(2500)
                info[w]=await pg.evaluate("LAB.engine3d._test.info()")
            for l in ['exh','in','vt','tb']:
                await pg.evaluate("document.querySelector('#e3Lay [data-l=%s]').click()"%l);await pg.wait_for_timeout(600)
            await pg.wait_for_timeout(1500)
            for l in ['exh','in','vt','tb']:
                await pg.evaluate("document.querySelector('#e3Lay [data-l=%s]').click()"%l);await pg.wait_for_timeout(300)
            bad=[]
            cases=[('base',{}),('V60',{'Ángulo de la V':60}),('V120',{'Ángulo de la V':120}),('V90',{'Ángulo de la V':90}),('largo',{'Carrera':90,'Longitud de biela':160}),('corto',{'Carrera':40,'Longitud de biela':80}),('normal',{'Carrera':53,'Longitud de biela':108}),('d60',{'Diámetro (calibre)':60}),('d100',{'Diámetro (calibre)':100,'Distancia entre cilindros':130}),('d80',{'Diámetro (calibre)':80,'Distancia entre cilindros':106}),('sep85',{'Distancia entre cilindros':85,'Desfase entre bancadas':0}),('desf40',{'Distancia entre cilindros':106,'Desfase entre bancadas':40}),('fin',{'Desfase entre bancadas':18})]
            for name,vals in cases:
                for k,v in vals.items():
                    ok=await pg.evaluate("(%s)(%s,%s)"%(SETP,json.dumps(k),json.dumps(v)))
                    if not ok: bad.append('sin control: '+k)
                await pg.wait_for_timeout(2600)
                chk=await pg.evaluate("LAB.enginecad.check(-.004).filter(r=>!(/^prim/.test(r[0])&&/^(prim|sec)/.test(r[1]))&&!(/^comb/.test(r[0])&&/^comb/.test(r[1])))")
                if chk: bad.append([name,chk])
                if name in ('V60','V120','largo','corto','d60','d100','desf40'): await pg.screenshot(path=OUT+'eng_%s.png'%name)
            rep['motor 3D a fondo']={'errs':list(errs)+[json.dumps(x,ensure_ascii=False)[:300] for x in bad],'info':info};await pg.close()
        if 'drive' in tabs and not os.environ.get('QUICK'):
            pg,errs=await page({'width':1280,'height':800})
            await pg.goto('http://localhost:8791/lab.html#drive',wait_until='load');await pg.wait_for_timeout(7000)
            await pg.evaluate("(()=>{const b=document.querySelector('[data-setmode=pro]');b&&b.click()})()");await pg.wait_for_timeout(800)
            bad=[]
            for sel in ['[data-dc=full]','[data-dc=off]','[data-dc=cut]','[data-de=full]','[data-de=bare]','#drvNames','[data-dv=clutch]','[data-dv=diff]','[data-dv=ers]','[data-dv=all]','[data-dv=box]']:
                ok=await pg.evaluate("(()=>{const b=document.querySelector('%s');if(!b)return false;b.click();return true})()"%sel)
                if not ok: bad.append('sin botón: '+sel)
                await pg.wait_for_timeout(1300)
            cases=[('m2',{'Módulo de los dientes':2}),('m4',{'Módulo de los dientes':4}),('m3',{'Módulo de los dientes':3}),('a8',{'Ancho de dentado':8}),('a30',{'Ancho de dentado':30}),('a18',{'Ancho de dentado':18}),('c70',{'Distancia entre ejes':70}),('c120',{'Distancia entre ejes':120}),('c90',{'Distancia entre ejes':90}),('fd25',{'Grupo cónico':2.5}),('fd45',{'Grupo cónico':4.5}),('g18',{'1ª':4.5,'8ª':0.8})]
            for name,vals in cases:
                for k,v in vals.items():
                    ok=await pg.evaluate("(%s)(%s,%s)"%(SETP,json.dumps(k),json.dumps(v)))
                    if not ok: bad.append('sin control: '+k)
                await pg.wait_for_timeout(3200)
                if name in ('m2','m4','a30','c70','c120','fd45'): await pg.screenshot(path=OUT+'drv_%s.png'%name)
            n=await pg.evaluate("document.querySelectorAll('#drvPre button').length")
            for i in range(n):
                await pg.evaluate("document.querySelectorAll('#drvPre button')[%d].click()"%i);await pg.wait_for_timeout(3000)
            rep['transmisión 3D a fondo']={'errs':list(errs)+bad};await pg.close()
        if 'validate' in tabs:
            # banco de validación ejecutado en el navegador: ninguna comprobación puede salirse de su tolerancia
            pg,errs=await page({'width':1280,'height':800})
            await pg.goto('http://localhost:8791/lab.html#validate',wait_until='load');await pg.wait_for_timeout(5000)
            r=await pg.evaluate("(()=>{const r=LAB.validate.run();return {n:r.reduce((a,g)=>a+g.n,0),grupos:r.map(g=>g.id+' '+(g.n-g.bad)+'/'+g.n).join(', '),fallos:r.flatMap(g=>g.rows.filter(x=>!x.ok).map(x=>g.id+': '+x.k+' → '+x.lab+' frente a '+x.ref))}})()")
            shown=await pg.evaluate("(document.querySelector('#valSum b')||{}).textContent||''")
            rep['validación']={'errs':list(errs)+r['fallos']+([] if r['n']>=140 and shown==str(r['n']) else ['recuento: %s mostrado %s'%(r['n'],shown)]),'info':r['grupos']};await pg.close()
        if 'engine' in tabs and not os.environ.get('QUICK'):
            # química del motor: todos los preajustes y combustibles, sin valores imposibles en las lecturas ni en el ciclo
            pg,errs=await page({'width':1280,'height':800})
            await pg.goto('http://localhost:8791/lab.html#engine',wait_until='load');await pg.wait_for_timeout(5000)
            await pg.evaluate("(()=>{const b=document.querySelector('[data-setmode=pro]');b&&b.click()})()");await pg.wait_for_timeout(800)
            bad=[];n=await pg.evaluate("document.querySelectorAll('#engPre button').length");out=[]
            CHK="(()=>{const T=LAB.engine._test,bad=[],ro=[...document.querySelectorAll('#engRo .ro b, #engRoX .ro b')].map(b=>b.textContent);if(ro.some(t=>/NaN|undefined|Infinity/.test(t)||t==='—'))bad.push('lectura vacía o NaN: '+ro.filter(t=>/NaN|undefined|Infinity/.test(t)||t==='—').length);return bad})()"
            for i in range(n):
                await pg.evaluate("document.querySelectorAll('#engPre button')[%d].click()"%i);await pg.wait_for_timeout(2200)
                r=await pg.evaluate(CHK)
                if r: bad.append(['preajuste %d'%i,r])
            r=await pg.evaluate("(()=>{const T=LAB.engine._test,P0=T.defaults(),bad=[],out=[];const fin=(n,C,X)=>{for(const k of ['Pb','etaB','pmax','Tmax','TbMax','Tex','xr','lambda','ki'])isFinite(C[k])||bad.push(n+': '+k+' no finito');for(const k of ['noMix','noUn','co2','Tad'])isFinite(X[k])||bad.push(n+': '+k+' no finito');(C.etaB<.15||C.etaB>.6)&&bad.push(n+': rendimiento '+C.etaB.toFixed(3));(C.TbMax<1500||C.TbMax>3300)&&bad.push(n+': Tb '+C.TbMax.toFixed(0));C.tb.stats().fails&&bad.push(n+': equilibrio sin converger')};for(const f of Object.keys(LAB.chem.FUELS)){const P={...P0,fuelmix:f},C=T.cycle(P),X=T.chem(P,C);fin('combustible '+f,C,X);out.push(f+' '+(C.Pb/1e3).toFixed(0)+' kW λ'+C.lambda.toFixed(2))}for(const [n,v] of [['rica',{lambdaMin:.7,fflim:'no',fuel:140}],['pobre',{fuel:45}],['3000 rpm',{rpm:3000}],['15000 rpm',{rpm:15000}],['turbo 1',{boost:1}],['turbo 4,5',{boost:4.5}],['encendido tardío',{soc:15,dur:80}],['encendido adelantado',{soc:-40,dur:10}],['rc 8',{cr:8}],['rc 20',{cr:20}],['etac 85',{etac:85}],['etac 100',{etac:100}],['pexh 5',{pexh:5}],['pexh 1',{pexh:1}]]){const P={...P0,...v},C=T.cycle(P),X=T.chem(P,C),TB=T.turbo(P,C);fin(n,C,X);isFinite(TB.Wh)||bad.push(n+': MGU-H no finito')}return {bad,out}})()")
            rep['química del motor']={'errs':list(errs)+[json.dumps(x,ensure_ascii=False)[:300] for x in bad]+r['bad'],'info':'; '.join(r['out'])};await pg.close()
        await b.close()
    srv.kill()
    json.dump(rep,open(OUT+'report.json','w'),indent=1,ensure_ascii=False)
    for k,v in rep.items():
        bad=v.get('errs') or v.get('overflowX')
        print(('FAIL ' if bad else 'ok   ')+k, json.dumps({kk:vv for kk,vv in v.items() if vv},ensure_ascii=False)[:700] if (bad or 'info' in v) else '')
asyncio.run(run())
