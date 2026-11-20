# edificios vistos a distancia de TV (60-90 m) desde la pista
TRK=$1 TAG=$2 VIEWS='[["js","(()=>{const r=R3D.__rel||{},P=(r.pickC||[]).filter((p,i)=>i%5==1).slice(0,4);return P.map(([x,y,z,a])=>{const D=70,nx=Math.sin(a),nz=Math.cos(a),ox=Math.cos(a),oz=-Math.sin(a);return [\"camw\",[x+nx*D+ox*30,y+12,z+nz*D+oz*30,x,y+5,z,50]]})})()"]]' timeout 900 python3 shot.py
python3 grid.py $2 4
