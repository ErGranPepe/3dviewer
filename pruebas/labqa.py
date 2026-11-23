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
        tabs=os.environ.get('TABS','susp,engine,limits,drive,chassis,tyre').split(',')
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
        await b.close()
    srv.kill()
    json.dump(rep,open(OUT+'report.json','w'),indent=1,ensure_ascii=False)
    for k,v in rep.items():
        bad=v.get('errs') or v.get('overflowX')
        print(('FAIL ' if bad else 'ok   ')+k, json.dumps({kk:vv for kk,vv in v.items() if vv},ensure_ascii=False)[:700] if (bad or 'info' in v) else '')
asyncio.run(run())
