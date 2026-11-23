import asyncio,os,json,subprocess,time
from playwright.async_api import async_playwright
Q=os.environ.get('Q','high');PORT=int(os.environ.get('PORT','8831'));OUT=os.environ.get('OUT','cv')
# vistas relativas al coche: [dx adelante, dy arriba, dz lateral, objetivo dx, dy, dz, fov]
VIEWS=json.loads(os.environ.get('VIEWS','null')) or {'f34':[5.0,1.6,3.2,0,.5,0,32],'side':[0,.8,6.5,0,.5,0,32],'r34':[-5.2,1.9,-3.4,0,.5,0,32],'fl':[2.9,.8,1.9,1.7,.4,.5,34],'top':[0,7.5,.01,0,0,0,40]}
VJS='''(V)=>{const c=__app.w.cars[%d],o={};const z=R3D.__therm().terrainH?0:0;const h=c.h,cx=Math.cos(h),sy=Math.sin(h);
 const zz=R3D.__therm().cars.get(c.id).root.position.y;
 for(const k in V){const v=V[k];const w=(a,b,l)=>[c.x+cx*a-sy*l,zz+b,c.y+sy*a+cx*l];const p=w(v[0],v[1],v[2]),t=w(v[3],v[4],v[5]);o[k]=[p[0],p[1],p[2],t[0],t[1],t[2],v[6]]}return o}'''
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
        await pg.wait_for_timeout(int(os.environ.get('RUN','1500')))
        pre=os.environ.get('PRE')
        if pre: print('PRE',await pg.evaluate(pre))
        await pg.evaluate("R3D.__px(.15);__app.paused=true;document.getElementById('titlecard').hidden=true;document.getElementById('stage').classList.remove('intro')")
        box=await pg.evaluate("(()=>{const r=document.getElementById('cv3').getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()")
        views=await pg.evaluate(VJS%int(os.environ.get('CAR','0')),VIEWS)
        for k,v in views.items():
            await pg.evaluate("R3D.__camW(%s)"%json.dumps(v))
            await pg.wait_for_timeout(900)
            await pg.evaluate("R3D.__px(1)");await pg.wait_for_timeout(int(os.environ.get('SETTLE','5000')))
            await pg.screenshot(path='%s_%s.png'%(OUT,k),clip={'x':box[0],'y':box[1],'width':box[2],'height':box[3]},timeout=240000)
            await pg.evaluate("R3D.__px(.15)")
        for m in json.loads(os.environ.get('MODES','[]')):
            await pg.evaluate("R3D.__camW(null);__app.sel=__app.w.cars[%d];__app.cam.mode='follow';R3D.setCam('%s')"%(int(os.environ.get('CAR','0')),m))
            await pg.evaluate("__app.paused=false");await pg.wait_for_timeout(int(os.environ.get('MRUN','2500')));await pg.evaluate("__app.paused=true")
            await pg.evaluate("R3D.__px(1)");await pg.wait_for_timeout(int(os.environ.get('SETTLE','5000')))
            await pg.screenshot(path='%s_m_%s.png'%(OUT,m),clip={'x':box[0],'y':box[1],'width':box[2],'height':box[3]},timeout=240000)
            await pg.evaluate("R3D.__px(.15)")
        post=os.environ.get('POST')
        if post: print('POST',json.dumps(await pg.evaluate(post))[:3000])
        print('ERRS',errs[:10])
        await b.close()
    srv.kill()
asyncio.run(main())
