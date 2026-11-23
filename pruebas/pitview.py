import asyncio,os,json,subprocess,time
from playwright.async_api import async_playwright
Q=os.environ.get('Q','high');PORT=int(os.environ.get('PORT','8823'))
VJS='''(()=>{const tr=__app.track,P=tr.pit,N=tr.N,ds=tr.ds,L=tr.L;
 const at=(s,lat,h)=>{const i=Math.round((((s%L)+L)%L)/ds)%N;const hd=tr.hd[i];const z=(tr.z?tr.z[i]:0);return [tr.x[i]-Math.sin(hd)*lat,z+h,tr.y[i]+Math.cos(hd)*lat]};
 const sd=P.side||-1,gm=P.inS+((P.gA||0)+(P.gB||P.len))/2;
 const c=at(gm,sd*25,0);
 const a=at(P.inS+(P.gA||0)-150,-sd*55,38),l=at(gm,sd*22,4);
 const a2=at(P.inS+(P.gB||P.len)+130,-sd*40,26),l2=at(gm,sd*22,4);
 const a3=at(P.inS+(P.gA||0)-60,-sd*3,1.15),l3=at(P.inS+(P.gA||0)+200,-sd*1,1.6);
 return [[c[0],c[1]+560,c[2]+.5,c[0],c[1],c[2],40],[a[0],a[1],a[2],l[0],l[1],l[2],55],[a2[0],a2[1],a2[2],l2[0],l2[1],l2[2],55],[a3[0],a3[1],a3[2],l3[0],l3[1],l3[2],70]]})()'''
async def main():
    srv=subprocess.Popen(['python3','-m','http.server',str(PORT)],cwd='/home/claude/pages',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg=await b.new_page(viewport={'width':1280,'height':760});errs=[]
        pg.on('pageerror',lambda e: errs.append(str(e)[:300]))
        pg.on('console',lambda m: m.type in('warning','error') and 'TUNNEL' not in m.text and 'ERR_' not in m.text and 'GL Driver' not in m.text and 'Canvas2D' not in m.text and errs.append(m.type+': '+m.text[:200]))
        await pg.add_init_script("try{localStorage.setItem('pn3-q',JSON.stringify('%s'))}catch(e){}"%Q)
        await pg.goto('http://localhost:%d/index.html'%PORT,wait_until='domcontentloaded');await pg.wait_for_selector('#rTrack',state='visible',timeout=60000);await pg.wait_for_timeout(2500)
        await pg.add_style_tag(content="#stage>*:not(canvas){display:none!important}#cv,#mini,#lens{display:none!important}")
        for i in json.loads(os.environ.get('IDX','[13]')):
            await pg.select_option('#rTrack',index=i)
            await pg.evaluate("document.getElementById('rGo').click()")
            for k in range(400):
                await pg.wait_for_timeout(600)
                if await pg.evaluate('!!(window.__app&&__app.w&&__app.phase==="run")'):break
            await pg.evaluate("R3D.__px(.15);__app.paused=true;document.getElementById('titlecard').hidden=true;document.getElementById('stage').classList.remove('intro')")
            box=await pg.evaluate("(()=>{const r=document.getElementById('cv3').getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()")
            views=await pg.evaluate(VJS)
            sel=json.loads(os.environ.get('SEL','[0,1,2,3]'))
            for n in sel:
                await pg.evaluate("R3D.__camW(%s)"%json.dumps(views[n]))
                await pg.wait_for_timeout(900)
                await pg.evaluate("R3D.__px(1)");await pg.wait_for_timeout(int(os.environ.get('SETTLE','5500')))
                await pg.screenshot(path='pv_%d_%d.png'%(i,n),clip={'x':box[0],'y':box[1],'width':box[2],'height':box[3]},timeout=240000)
                await pg.evaluate("R3D.__px(.15)")
            await pg.evaluate("R3D.__camW(null);__app.paused=false")
            print('ok',i,flush=True)
        print('ERRS',errs[:8])
        await b.close()
    srv.kill()
asyncio.run(main())
