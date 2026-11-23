(()=>{const I=R3D.__therm(),tr=I.tr,S=Sim,N=tr.N,ds=tr.ds,TG=I.trackGroup,T3=THREE,P=tr.pit;
const rc=new T3.Raycaster();const out={ds,HW:S.HW,EDGE:S.EDGE,WALL:S.WALL,pit:{inS:P.inS,len:P.len,lane:P.lane,side:P.side,rin:P.rin,rout:P.rout},rows:[]};
const vis=o2=>{for(let q=o2;q;q=q.parent)if(!q.visible)return false;return true};
const Q=window.__Q;
for(const [i0,i1,lats] of Q){for(let s=i0*ds;s<=i1*ds+.01;s+=ds/2){for(const lat of lats){const p=I.ptS(s,lat,0);rc.set(new T3.Vector3(p[0],p[1]+4,p[2]),new T3.Vector3(0,-1,0));rc.near=0;rc.far=8;
  const hs=rc.intersectObject(TG,true).filter(h=>vis(h.object)).slice(0,5).map(h=>{const ob=h.object,m=Array.isArray(ob.material)?ob.material[0]:ob.material;let q=ob,src="";while(q&&!src){src=q.userData&&q.userData.src||"";q=q.parent}
   return (h.point.y-p[1]).toFixed(2)+" "+(src||"").slice(5,11)+" "+(m.color?m.color.getHexString():"")+(m.map?"m":"")});
  const d=((s-P.inS)%tr.L+tr.L)%tr.L;
  out.rows.push((s/ds).toFixed(1)+" lat"+lat+" d"+Math.round(d)+" cap"+(d<=P.len?S.pitCap(P,ds,d).toFixed(1):"-")+" bank"+(I.bankAt(Math.floor(s/ds),0)*57.3).toFixed(1)+": "+hs.join(" | "))}}}
return out})()
