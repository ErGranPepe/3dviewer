TRK=$1 TAG=$2 D=${3:-26} VIEWS='[["js","(()=>{const r=R3D.__rel||{},P=(r.pickC||[]).filter((p,i)=>i%3==0).slice(0,4),D='$D';return P.map(([x,y,z,a])=>{const nx=Math.sin(a),nz=Math.cos(a),ox=Math.cos(a),oz=-Math.sin(a);return [\"camw\",[x+nx*D+ox*D*0.5,y+D*0.3,z+nz*D+oz*D*0.5,x,y+4,z,60]]})})()"]]' timeout 900 python3 shot.py
python3 grid.py $2 4
