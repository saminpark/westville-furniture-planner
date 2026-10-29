(function(root){
  'use strict';
  const BASE_SCALE=1.6051900481652084; // cm per source-image pixel
  const REFERENCE_PX=247;
  const W=923,H=676;
  const footprint=[[73,119],[636,119],[636,38],[823,38],[823,648],[71,648],[71,467],[89,467],[89,279],[73,279]];
  // Rectangles whose union equals the simplified apartment footprint.
  const floorRects=[
    {x:73,y:119,w:563,h:160}, {x:162,y:119,w:574,h:348},
    {x:89,y:279,w:647,h:188}, {x:71,y:467,w:752,h:181},
    {x:636,y:38,w:187,h:81}, {x:736,y:38,w:87,h:610}
  ];
  const wall=(id,x1,y1,x2,y2,kind='inside')=>({id,x1,y1,x2,y2,kind,t:kind==='outer'?8:6});
  const outer=[
    // The original entrance door occupies x=403..433 on the upper edge.
    wall('o1-left',73,119,403,119,'outer'),wall('o1-right',433,119,636,119,'outer'),wall('o2',636,119,636,38,'outer'),
    wall('o3',636,38,823,38,'outer'),wall('o4',823,38,823,648,'outer'),
    wall('o5',823,648,71,648,'outer'),wall('o6',71,648,71,467,'outer'),
    wall('o7',71,467,89,467,'outer'),wall('o8',89,467,89,279,'outer'),
    wall('o9',89,279,73,279,'outer'),wall('o10',73,279,73,119,'outer')
  ];
  // Door openings are left open. Each separate line can be removed/restored.
  const inside=[
    wall('upper-balcony',162,119,162,279),wall('upper-bed-bottom',162,279,355,279),
    wall('upper-bed-east-a',355,119,355,235),wall('upper-bed-east-b',355,265,355,279),
    wall('lower-balcony',159,467,159,648),wall('lower-balcony-door-a',89,467,108,467),wall('lower-balcony-door-b',141,467,159,467),
    wall('lower-bed-top-a',159,467,309,467),wall('lower-bed-top-b',342,467,351,467),wall('lower-bed-east',351,467,351,648),
    wall('bath-top-a',351,467,440,467),wall('bath-top-b',472,467,483,467),
    wall('baths-between',351,560,483,560),wall('bath-shaft',379,560,379,648),
    wall('large-room-top',483,394,736,394),wall('large-room-left-a',483,394,483,407),wall('large-room-left-b',483,439,483,648),
    wall('store-bottom',636,119,736,119),wall('store-balcony',736,38,736,119),
    wall('living-balcony',736,119,736,394),wall('bed-balcony',736,394,736,648),wall('right-balconies',736,394,823,394)
  ];
  function wallRect(w){return {x:Math.min(w.x1,w.x2)-w.t/2,y:Math.min(w.y1,w.y2)-w.t/2,w:Math.abs(w.x2-w.x1)+w.t,h:Math.abs(w.y2-w.y1)+w.t}}
  function overlaps(a,b){const eps=.005;return a.x < b.x+b.w-eps && a.x+a.w > b.x+eps && a.y < b.y+b.h-eps && a.y+a.h > b.y+eps}
  function inFloor(r){
    if(!(Number.isFinite(r.x)&&Number.isFinite(r.y)&&r.w>0&&r.h>0))return false;
    const xs=[r.x,r.x+r.w],ys=[r.y,r.y+r.h];
    for(const f of floorRects){if(f.x>r.x&&f.x<r.x+r.w)xs.push(f.x);if(f.x+f.w>r.x&&f.x+f.w<r.x+r.w)xs.push(f.x+f.w);if(f.y>r.y&&f.y<r.y+r.h)ys.push(f.y);if(f.y+f.h>r.y&&f.y+f.h<r.y+r.h)ys.push(f.y+f.h)}
    xs.sort((a,b)=>a-b);ys.sort((a,b)=>a-b);
    for(let xi=0;xi<xs.length-1;xi++)for(let yi=0;yi<ys.length-1;yi++){
      const x=(xs[xi]+xs[xi+1])/2,y=(ys[yi]+ys[yi+1])/2;
      if(!floorRects.some(f=>x>=f.x&&x<=f.x+f.w&&y>=f.y&&y<=f.y+f.h))return false;
    }
    return true;
  }
  function activeWalls(removed){const set=new Set(removed||[]);return outer.concat(inside.filter(w=>!set.has(w.id)))}
  function dimensions(item,scale){return {w:(item.rotated?item.h:item.w)/scale,h:(item.rotated?item.w:item.h)/scale}}
  function itemRect(item,scale){return {x:item.x,y:item.y,...dimensions(item,scale)}}
  function valid(r,opts={}){
    const {removed=[],items=[],excludeId=null,scale=BASE_SCALE,avoidItems=true}=opts;
    if(!inFloor(r))return false;
    if(activeWalls(removed).some(w=>overlaps(r,wallRect(w))))return false;
    if(avoidItems&&items.some(it=>it.id!==excludeId&&overlaps(r,itemRect(it,scale))))return false;
    return true;
  }
  function snapped(r,opts={}){
    if(opts.snap===false)return valid(r,opts)?r:null;
    const xs=[],ys=[],threshold=12;
    for(const wall of activeWalls(opts.removed)){
      const wr=wallRect(wall);
      if(wall.x1===wall.x2 && r.y<wr.y+wr.h && r.y+r.h>wr.y){
        for(const x of [wr.x-r.w,wr.x+wr.w]){const d=Math.abs(x-r.x);if(d<=threshold)xs.push({v:x,d})}
      }
      if(wall.y1===wall.y2 && r.x<wr.x+wr.w && r.x+r.w>wr.x){
        for(const y of [wr.y-r.h,wr.y+wr.h]){const d=Math.abs(y-r.y);if(d<=threshold)ys.push({v:y,d})}
      }
    }
    xs.sort((a,b)=>a.d-b.d);ys.sort((a,b)=>a.d-b.d);
    xs.push({v:r.x,d:0,original:true});ys.push({v:r.y,d:0,original:true});
    const options=[];
    for(const x of xs)for(const y of ys)options.push({x:x.v,y:y.v,count:(!x.original)+(!y.original),distance:x.d+y.d});
    options.sort((a,b)=>b.count-a.count||a.distance-b.distance);
    for(const c of options){const candidate={x:c.x,y:c.y,w:r.w,h:r.h};if(valid(candidate,opts))return candidate}
    return null;
  }
  function validAll(items,opts={}){return items.every(item=>valid(itemRect(item,opts.scale||BASE_SCALE),{...opts,items,excludeId:item.id}))}
  root.FloorGeometry={BASE_SCALE,REFERENCE_PX,W,H,footprint,floorRects,outer,inside,wallRect,overlaps,inFloor,activeWalls,dimensions,itemRect,valid,snapped,validAll};
  if(typeof module!=='undefined')module.exports=root.FloorGeometry;
})(typeof window!=='undefined'?window:globalThis);
