import asyncio,os,json,subprocess,time
from playwright.async_api import async_playwright
A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
PORT=os.environ.get('PORT','8891')
JS='''(()=>{const w=__app.w;__app.paused=true;const tr=w.track,L=tr.L,dt=1/60;
 const T=%d,HACK=%s;const st=new Map,rep=[];let steps=0;
 if(HACK>=0){const c=w.cars[HACK];c.mgr=c.mgr||{};c.mgr.box='H';c.dmg.fw=.5}
 for(;steps<60*T;steps++){
  Sim.raceStep(w);
  if(HACK>=0&&steps%%30===0){const c=w.cars[HACK];if(!c.inPit&&c.stops<1){c.mgr=c.mgr||{};c.mgr.box='H';c.dmg.fw=Math.max(c.dmg.fw,.5)}}
  if(!w.started)continue;
  for(const c of w.cars){ if(c.retired||c.gone||c.finished||c.inPit){st.delete(c.id);continue}
   const slow=Math.abs(c.u)<3;let q=st.get(c.id);
   if(slow){ if(!q){q={t0:w.t,s:Math.round(c.s),lat:+c.lat.toFixed(1),n:0,umin:c.u,sp:!!c.spinning,rec:c.recov||c.rev||null};st.set(c.id,q)} q.n++;q.umin=Math.min(q.umin,c.u);
     if(q.n===60*45){rep.push({code:c.code,t0:+q.t0.toFixed(0),s:q.s,lat:q.lat,umin:+q.umin.toFixed(1),fw:+c.dmg.fw.toFixed(2),susp:+(c.dmg.susp||0).toFixed(2),fail:c.fail?Object.keys(c.fail).join(','):'',sc:!!(w.sc&&w.sc.on),hold:!!c.hold,thr:+(c.thr||0).toFixed(2),brk:+(c.brk||0).toFixed(2),steer:+(c.steer||0).toFixed(2),surf:c.surf,keys:Object.keys(c).filter(k=>/stuck|recov|rev|spin|crash|wreck|stall|off/i.test(k)).map(k=>k+'='+JSON.stringify(c[k])).join(' ').slice(0,300)})}
   } else st.delete(c.id)
  }
 }
 const still=[];for(const c of w.cars){const q=st.get(c.id);if(q&&q.n>60*10)still.push([c.code,Math.round(q.n/60),q.s,q.lat,+c.u.toFixed(1)])}
 return {key:tr.key,t:Math.round(w.t),rep,still,ret:w.cars.filter(c=>c.retired).map(c=>c.code+':'+c.dnfReason),fin:w.cars.filter(c=>c.finished).length,stops:w.cars.reduce((a,c)=>a+(c.stops||0),0),lap:Math.max(...w.cars.map(c=>c.lap||0))}})()'''
async def main():
    srv=subprocess.Popen(['python3','-m','http.server',PORT],cwd='/home/claude/pages',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
    async with async_playwright() as p:
        b=await p.chromium.launch(args=A)
        for TRK in os.environ.get('TRKS','7').split(','):
          for rep in range(int(os.environ.get('REPS','1'))):
            pg=await b.new_page(viewport={'width':640,'height':400});errs=[]
            pg.on('pageerror',lambda e: errs.append(str(e)[:200]))
            await pg.add_init_script("try{localStorage.setItem('pn3-q',JSON.stringify('low'))}catch(e){}")
            await pg.goto('http://localhost:%s/index.html'%PORT,wait_until='domcontentloaded');await pg.wait_for_selector('#rTrack',state='visible',timeout=120000);await pg.wait_for_timeout(1500)
            await pg.select_option('#rTrack',index=int(TRK));await pg.evaluate("document.getElementById('rGo').click()")
            for k in range(400):
                await pg.wait_for_timeout(700)
                if await pg.evaluate('!!(window.__app&&__app.w&&__app.phase==="run")'):break
            try:
                r=await pg.evaluate(JS%(int(os.environ.get('T','900')),os.environ.get('HACK','-1')))
                print(TRK,r['key'],'t',r['t'],'vuelta',r['lap'],'paradas',r['stops'],'acabados',r['fin'],'abandonos',r['ret'],errs[:2],flush=True)
                for e in r['rep']: print('   ATASCADO',json.dumps(e)[:700])
                if r['still']: print('   siguen parados',r['still'])
            except Exception as e: print(TRK,'ERR',str(e)[:300],errs[:2],flush=True)
            await pg.close()
        await b.close()
    srv.kill()
asyncio.run(main())
