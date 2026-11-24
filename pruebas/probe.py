# Arranca una carrera en el circuito TRK (índice del desplegable) y ejecuta JS dentro de la página; imprime lo que devuelve.
# SEED=n fija la semilla de la carrera (por defecto 12345: carreras reproducibles). PRE='window.__car=10' se ejecuta antes (parámetros).
# INIT='js' se inyecta antes de cargar la página; LAPS, WEAR (1/3/6), FAIL (0/1/3), TEAM (0-9: dirigir ese equipo desde el muro) y REGS eligen las opciones de carrera.
# uso: TRK=5 JS='(()=>{...})()' [Q=low] [JSMAX=6000] python3 probe.py   ·  JSFILE=ruta.js en vez de JS
import asyncio,os,json,subprocess,time
from playwright.async_api import async_playwright
A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
PORT=os.environ.get('PORT','8893')
async def main():
    js=open(os.environ['JSFILE']).read() if os.environ.get('JSFILE') else os.environ['JS']
    srv=subprocess.Popen(['python3','-m','http.server',PORT],cwd=os.environ.get('ROOT','/home/claude/pages'),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
    try:
        async with async_playwright() as p:
            b=await p.chromium.launch(args=A)
            for TRK in os.environ.get('TRK','0').split(','):
                pg=await b.new_page(viewport={'width':640,'height':400});errs=[]
                pg.on('pageerror',lambda e: errs.append(str(e)[:300]))
                await pg.add_init_script("try{localStorage.setItem('pn3-q',JSON.stringify('%s'))}catch(e){}"%os.environ.get('Q','low'))
                await pg.add_init_script("window.__seed=%d"%int(os.environ.get('SEED','12345')))
                if os.environ.get('INIT'): await pg.add_init_script(os.environ['INIT'])
                await pg.goto('http://localhost:%s/index.html'%PORT,wait_until='domcontentloaded');await pg.wait_for_selector('#rTrack',state='visible',timeout=120000);await pg.wait_for_timeout(1500)
                if TRK=='list':
                    print(await pg.evaluate("[...document.querySelectorAll('#rTrack option')].map((o,i)=>i+':'+o.textContent.trim().slice(0,22)).join(' | ')"));await pg.close();continue
                await pg.select_option('#rTrack',index=int(TRK));await pg.select_option('#rWeather',os.environ.get('W','seco'))
                if os.environ.get('LAPS'): await pg.select_option('#rLaps',os.environ['LAPS'])
                if os.environ.get('WEAR'): await pg.select_option('#rWear',os.environ['WEAR'])
                if os.environ.get('FAIL'): await pg.select_option('#rFail',os.environ['FAIL'])
                if os.environ.get('TEAM'): await pg.select_option('#rTeam',os.environ['TEAM'])
                if os.environ.get('REGS'): await pg.select_option('#rRegs',os.environ['REGS'])
                await pg.evaluate("document.getElementById('rGo').click()")
                for k in range(400):
                    await pg.wait_for_timeout(700)
                    if await pg.evaluate('!!(window.__app&&__app.w&&__app.phase==="run")'):break
                if os.environ.get('PRE'): await pg.evaluate(os.environ['PRE'])
                try: print(TRK,json.dumps(await pg.evaluate(js),ensure_ascii=False)[:int(os.environ.get('JSMAX','6000'))],errs[:2],flush=True)
                except Exception as e: print(TRK,'ERR',str(e)[:600],errs[:2],flush=True)
                await pg.close()
            await b.close()
    finally:
        srv.kill()
asyncio.run(main())
