import asyncio,os,json,subprocess,time
from playwright.async_api import async_playwright
Q=os.environ.get('Q','high');PORT=int(os.environ.get('PORT','8871'));OUT=os.environ.get('OUT','ps');CAR=int(os.environ.get('CAR','3'))
VIEWS={'low':[0.4,3.3,.02,0,0,0,62],'fr':[3.2,.7,-1.7,1.7,.35,-.6,34],'f34':[4.6,1.7,3.4,0,.5,0,36],'side':[0,1.0,6.0,0,.5,0,34],'r34':[-4.8,1.9,-3.4,0,.5,0,36],'top':[0,7.0,.01,0,0,0,42],'fl':[3.2,.7,1.7,1.7,.35,.6,34]}
VJS='''(V)=>{const c=__app.w.cars[%d],o={};const h=c.h,cx=Math.cos(h),sy=Math.sin(h);
 const zz=R3D.__therm().cars.get(c.id).root.position.y;
 for(const k in V){const v=V[k];const w=(a,b,l)=>[c.x+cx*a-sy*l,zz+b,c.y+sy*a+cx*l];const p=w(v[0],v[1],v[2]),t=w(v[3],v[4],v[5]);o[k]=[p[0],p[1],p[2],t[0],t[1],t[2],v[6]]}return o}'''%CAR
ST='''(()=>{const w=__app.w,c=w.cars[%d];return {t:+w.t.toFixed(1),inPit:!!c.inPit,ph:c.inPit&&c.pit?c.pit.phase:'',d:c.inPit&&c.pit?+c.pit.d.toFixed(1):0,tS:c.inPit&&c.pit&&c.pit.tSvc!=null?+c.pit.tSvc.toFixed(2):null,svc:c.inPit&&c.pit?c.pit.svc:null,note:c.inPit&&c.pit?c.pit.note:'',s:Math.round(c.s),u:Math.round(c.u*3.6),req:!!c.pitReq,started:!!w.started,fw:c.dmg.fw}})()'''%CAR
async def main():
    srv=subprocess.Popen(['python3','-m','http.server',str(PORT)],cwd='/home/claude/pages',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg=await b.new_page(viewport={'width':1280,'height':760});errs=[]
        pg.on('pageerror',lambda e: errs.append(str(e)[:400]))
        pg.on('console',lambda m: m.type in('warning','error') and 'TUNNEL' not in m.text and 'ERR_' not in m.text and 'GL Driver' not in m.text and 'Canvas2D' not in m.text and errs.append(m.type+': '+m.text[:300]))
        await pg.add_init_script("try{localStorage.setItem('pn3-q',JSON.stringify('%s'));%s}catch(e){}"%(Q,os.environ.get('INIT','')))
        await pg.goto('http://localhost:%d/index.html'%PORT,wait_until='domcontentloaded');await pg.wait_for_selector('#rTrack',state='visible',timeout=90000);await pg.wait_for_timeout(2500)
        await pg.add_style_tag(content="#stage>*:not(canvas){display:none!important}#cv,#mini,#lens{display:none!important}")
        await pg.select_option('#rTrack',index=int(os.environ.get('IDX','6')))
        await pg.evaluate("document.getElementById('rGo').click()")
        for k in range(400):
            await pg.wait_for_timeout(600)
            if await pg.evaluate('!!(window.__app&&__app.w&&__app.phase==="run")'):break
        await pg.evaluate("document.getElementById('titlecard').hidden=true;document.getElementById('stage').classList.remove('intro');R3D.__px(.1)")
        await pg.evaluate("(()=>{const c=__app.w.cars[%d];c.mgr=c.mgr||{};c.mgr.box='H';c.dmg.fw=%s;__app.sel=c;__app.speed=16;__app.paused=false})()"%(CAR,os.environ.get('FW','0.5')))
        box=await pg.evaluate("(()=>{const r=document.getElementById('cv3').getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()")
        last=None;shots=json.loads(os.environ.get('SHOTS','[0.6,1.5,5.0]'));ns=0;t0=time.time()
        while time.time()-t0<float(os.environ.get('MAXT','1500')):
            await pg.wait_for_timeout(500)
            st=await pg.evaluate(ST)
            key=(st['inPit'],st['ph'])
            if key!=last: print(st,flush=True);last=key
            if st['inPit'] and st['ph'] in('in','lane'):
                await pg.evaluate("(()=>{const c=__app.w.cars[%d];c.mgr.box='H';c.dmg.fw=Math.max(c.dmg.fw,%s);__app.speed=%s})()"%(CAR,os.environ.get('FW','0.5'),'2' if st['ph']=='lane' and st['d']>60 else '8'))
            if st['inPit'] and st['ph']=='svc':
                el=st['svc']-st['tS']
                if ns<len(shots) and el>=shots[ns]:
                    await pg.evaluate("__app.paused=true")
                    views=await pg.evaluate(VJS,VIEWS)
                    for k in json.loads(os.environ.get('VW','["f34","top","fl"]')):
                        await pg.evaluate("R3D.__camW(%s)"%json.dumps(views[k]));await pg.wait_for_timeout(700)
                        await pg.evaluate("R3D.__px(1)");await pg.wait_for_timeout(int(os.environ.get('SETTLE','4500')))
                        await pg.screenshot(path='%s_%d_%s.png'%(OUT,ns,k),clip={'x':box[0],'y':box[1],'width':box[2],'height':box[3]},timeout=240000)
                        await pg.evaluate("R3D.__px(.1)")
                    print('shot',ns,'el',round(el,2),st,flush=True);ns+=1
                    await pg.evaluate("R3D.__camW(null);__app.speed=1;__app.paused=false")
                else:
                    await pg.evaluate("__app.speed=1")
            if ns>=len(shots) or (last and last[1]=='out'): break
        print('END',await pg.evaluate(ST))
        print('ERRS',errs[:10])
        await b.close()
    srv.kill()
asyncio.run(main())
