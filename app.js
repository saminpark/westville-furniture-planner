(() => {
  'use strict';
  const G=window.FloorGeometry, $=s=>document.querySelector(s);
  const STORAGE='westville-interior-layout-v1';
  const COLORS=['#C69C74','#8DA48B','#A0AEC0','#C9AC99','#A6A094','#C1A574'];
  const wallNames={
    'upper-balcony':'왼쪽 위 발코니 안쪽','upper-bed-bottom':'왼쪽 위 방 아래쪽',
    'upper-bed-east-a':'왼쪽 위 방 오른쪽 긴 벽','upper-bed-east-b':'왼쪽 위 방 출입구 옆',
    'lower-balcony':'왼쪽 아래 발코니 안쪽','lower-balcony-door-a':'왼쪽 아래 발코니 입구 왼쪽','lower-balcony-door-b':'왼쪽 아래 발코니 입구 오른쪽',
    'lower-bed-top-a':'왼쪽 아래 방 위쪽 긴 벽','lower-bed-top-b':'왼쪽 아래 방 출입구 옆','lower-bed-east':'왼쪽 아래 방 오른쪽',
    'bath-top-a':'위쪽 욕실 입구 왼쪽','bath-top-b':'위쪽 욕실 입구 오른쪽',
    'baths-between':'두 욕실 사이','bath-shaft':'아래 욕실 왼쪽',
    'large-room-top':'큰 방 위쪽','large-room-left-a':'큰 방 출입구 위쪽','large-room-left-b':'큰 방 왼쪽 긴 벽',
    'store-bottom':'창고 아래쪽','store-balcony':'창고와 오른쪽 발코니 사이',
    'living-balcony':'거실과 오른쪽 발코니 사이','bed-balcony':'큰 방과 오른쪽 발코니 사이','right-balconies':'오른쪽 발코니 사이'
  };
  const defaults=()=>({items:[],removed:[],angle:0,scale:G.BASE_SCALE,snap:true,avoidItems:true,reference:false});
  function load(){try{const v=JSON.parse(localStorage.getItem(STORAGE));if(!v||!Array.isArray(v.items)||!Array.isArray(v.removed))return defaults();return {...defaults(),...v,scale:Number.isFinite(v.scale)&&v.scale>.1?v.scale:G.BASE_SCALE}}catch{return defaults()}}
  let state=load(), mode='place', selected=null, color=COLORS[0], drag=null, zoom=1, history=[], toastTimer;
  const svg=$('#plan'), board=$('#board');
  function clone(v){return JSON.parse(JSON.stringify(v))}
  function snapshot(){return JSON.stringify(state)}
  function historyPush(snapshotValue=snapshot()){if(history[history.length-1]!==snapshotValue)history.push(snapshotValue);if(history.length>50)history.shift();$('#undoButton').disabled=!history.length}
  function save(){try{localStorage.setItem(STORAGE,JSON.stringify(state));$('#saveStatus').textContent='자동 저장됨'}catch(e){$('#saveStatus').textContent='자동 저장 불가'}}
  function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3000)}
  function esc(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function opts(excludeId){return {removed:state.removed,items:state.items,excludeId,scale:state.scale,avoidItems:state.avoidItems,snap:state.snap}}
  function quarterTurn(){return state.angle===90||state.angle===270}
  function displayDimensions(item){const swap=Boolean(item.rotated)!==quarterTurn();return swap?{w:item.h,h:item.w}:{w:item.w,h:item.h}}
  function transform(){switch(state.angle){case 90:return 'translate(676 0) rotate(90)';case 180:return 'translate(923 676) rotate(180)';case 270:return 'translate(0 923) rotate(270)';default:return ''}}
  function wallMarkup(w){
    const removed=state.removed.includes(w.id),erasing=mode==='erase',restoring=mode==='restore';
    if(removed&&!restoring)return '';
    const cls=removed?'deleted-wall':(erasing?'editable-wall':'normal-wall');
    const color=removed?'#d2a45c':(w.kind==='outer'?'#28372e':'#45554a');
    const width=removed?2.3:w.t;
    const dash=removed?' stroke-dasharray="6 5"':'';
    const interactive=w.kind==='inside'&&((erasing&&!removed)||(restoring&&removed))?`<line class="wall-hit" data-wall="${w.id}" x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}"/>`:'';
    const outerHit=erasing&&w.kind==='outer'?`<line class="outer-hit" data-outer="true" x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}"/>`:'';
    return `<line class="${cls}" stroke="${color}" stroke-width="${width}"${dash} x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}"/>${interactive}${outerHit}`;
  }
  function itemMarkup(item){
    const r=G.itemRect(item,state.scale), sel=item.id===selected, x=r.x,y=r.y,w=r.w,h=r.h;
    const dims=displayDimensions(item),screenW=quarterTurn()?h:w,screenH=quarterTurn()?w:h;
    const maxChars=Math.max(3,Math.floor((screenW-8)/8));
    const shortName=item.name.length>maxChars?item.name.slice(0,maxChars-1)+'…':item.name;
    const label=esc(shortName),displayW=dims.w,displayH=dims.h;
    const line1=screenW>38&&screenH>20?`<text x="0" y="${screenH>35?-3:3}" text-anchor="middle" font-size="${Math.max(7,Math.min(11,screenW/7))}" font-weight="700" fill="#29382e">${label}</text>`:'';
    const line2=screenW>55&&screenH>35?`<text x="0" y="11" text-anchor="middle" font-size="8" fill="#39483a">${displayW} × ${displayH} cm</text>`:'';
    const selectedOutline=sel?`<rect x="${x-2}" y="${y-2}" width="${w+4}" height="${h+4}" rx="3" fill="none" stroke="#d79d4f" stroke-width="2" stroke-dasharray="4 3" pointer-events="none"/>`:'';
    return `<g data-item="${item.id}" class="furniture" aria-label="${esc(item.name)}"><title>${esc(item.name)} · ${displayW} × ${displayH}cm</title><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${item.color}" fill-opacity="0.82" stroke="#607162" stroke-width="1.3"/><g transform="translate(${x+w/2} ${y+h/2}) rotate(${-state.angle})" pointer-events="none">${line1}${line2}</g>${selectedOutline}</g>`;
  }
  function renderPlan(){
    const rotated=state.angle===90||state.angle===270, vw=rotated?G.H:G.W,vh=rotated?G.W:G.H;
    svg.setAttribute('viewBox',`0 0 ${vw} ${vh}`);
    const pts=G.footprint.map(p=>p.join(',')).join(' '),grid=50/state.scale;
    const floor=`<polygon points="${pts}" fill="url(#floor-grid)" stroke="none"/>
      <g clip-path="url(#floor-clip)" opacity=".55">
        <rect x="162" y="119" width="193" height="160" fill="#f6f0e3"/>
        <rect x="159" y="467" width="192" height="181" fill="#f6f0e3"/>
        <rect x="483" y="394" width="253" height="254" fill="#f6f0e3"/>
        <rect x="351" y="467" width="132" height="181" fill="#eaf0ec"/>
        <rect x="73" y="119" width="89" height="160" fill="url(#tile)"/>
        <rect x="71" y="467" width="88" height="181" fill="url(#tile)"/>
        <rect x="736" y="38" width="87" height="610" fill="url(#tile)"/>
        <rect x="636" y="38" width="100" height="81" fill="#e6e2da"/>
      </g>`;
    const reference=state.reference?'<use href="#original-source" opacity=".22" pointer-events="none"/>':'';
    // Crop the original entrance itself, preserving the door, threshold and tiled area.
    const entryFloor='<svg x="356" y="121" width="107" height="95" viewBox="356 121 107 95" overflow="hidden" pointer-events="none"><use href="#original-source"/></svg>';
    const entryDoor='<svg x="400" y="83" width="36" height="42" viewBox="400 83 36 42" overflow="hidden" pointer-events="none"><use href="#original-source"/></svg>';
    svg.innerHTML=`<defs><clipPath id="floor-clip"><polygon points="${pts}"/></clipPath>
      <image id="original-source" href="./original-plan.png" x="0" y="0" width="923" height="676"/>
      <pattern id="floor-grid" width="${grid}" height="${grid}" patternUnits="userSpaceOnUse"><rect width="${grid}" height="${grid}" fill="#fbfaf5"/><path d="M${grid} 0H0V${grid}" fill="none" stroke="#eeeee7" stroke-width=".65"/></pattern>
      <pattern id="tile" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#f3f5ef"/><path d="M20 0H0V20" fill="none" stroke="#dce4db" stroke-width=".7"/></pattern>
      <style>.normal-wall,.editable-wall{stroke-linecap:square}.wall-hit,.outer-hit{stroke:transparent;stroke-width:17;cursor:pointer}.editable-wall{cursor:pointer}.editable-wall:hover{stroke:#ce9447}.deleted-wall{cursor:pointer;stroke-linecap:butt}.wall-hit:hover{stroke:rgba(220,158,77,.24)}.outer-hit{cursor:not-allowed}.furniture{cursor:grab}.furniture:active{cursor:grabbing}</style></defs>
      <rect width="${vw}" height="${vh}" fill="#fafbf7"/>
      <g id="planStage" transform="${transform()}">${floor}${reference}${entryFloor}
      <g id="walls">${G.outer.map(wallMarkup).join('')}${G.inside.map(wallMarkup).join('')}</g>
      ${entryDoor}
      <g id="furnitures">${state.items.map(itemMarkup).join('')}</g></g>`;
    // Keep the apparent scale constant when a landscape plan becomes portrait.
    board.style.width=`${Math.round(zoom*(rotated?100*G.H/G.W:100))}%`;
    board.style.minWidth=`${Math.round(zoom*(rotated?455:620))}px`;
    $('#zoomLabel').textContent=`${Math.round(zoom*100)}%`;
  }
  function renderSidebar(){
    $('#itemCount').textContent=state.items.length;
    $('#emptyList').classList.toggle('hidden',state.items.length>0);
    $('#itemList').innerHTML=state.items.map((it,i)=>{const d=displayDimensions(it);return `<div class="item ${selected===it.id?'selected':''}" data-list-item="${it.id}" role="button" tabindex="0"><span class="item-swatch" style="background:${esc(it.color)}"></span><span class="item-info"><strong>${esc(it.name)}</strong><small>${d.w} × ${d.h} cm</small></span><span class="item-index">${String(i+1).padStart(2,'0')}</span></div>`}).join('');
    const it=state.items.find(x=>x.id===selected);
    $('#selectedActions').classList.toggle('hidden',!it);$('#selectedName').textContent=it?it.name:'';
    if(it){const d=displayDimensions(it);$('#editWidth').value=d.w;$('#editHeight').value=d.h}
    $('#colors').innerHTML=COLORS.map(c=>`<button type="button" class="color-choice ${c===color?'active':''}" data-color="${c}" style="background:${c}" aria-label="가구 색상 ${c}" aria-pressed="${c===color}"></button>`).join('');
    const shownWalls=G.inside.filter(w=>mode==='restore'?state.removed.includes(w.id):mode==='erase'&&!state.removed.includes(w.id));
    $('#wallList').innerHTML=shownWalls.length?shownWalls.map(w=>{const gone=state.removed.includes(w.id);return `<div class="wall-row ${gone?'removed':''}"><span>${esc(wallNames[w.id]||w.id)}</span><button type="button" data-wall-button="${w.id}">${gone?'복원':'지우기'}</button></div>`}).join(''):(mode==='restore'?'<div class="wall-empty">지운 벽이 없습니다. 벽을 지운 뒤 이 모드에서 점선을 눌러 복원하세요.</div>':'<div class="wall-empty">지울 수 있는 내부 벽이 없습니다.</div>');
    $('#removedCount').textContent=state.removed.length;$('#restoreWalls').disabled=!state.removed.length;
    $('#scaleStatus').textContent=`현재 기준: 큰 침실 가로 약 ${Math.round(state.scale*G.REFERENCE_PX)}cm`;
    $('#scaleInput').value=Math.round(state.scale*G.REFERENCE_PX);
    $('#snapToggle').checked=state.snap;$('#collisionToggle').checked=state.avoidItems;$('#referenceToggle').checked=state.reference;
    $('#undoButton').disabled=!history.length;
  }
  function render(){renderPlan();renderSidebar()}
  function finish(){render();save()}
  function setMode(next){
    mode=next;const editing=mode!=='place',restoring=mode==='restore';
    $('#placeMode').classList.toggle('active',mode==='place');$('#wallMode').classList.toggle('active',mode==='erase');$('#restoreMode').classList.toggle('active',restoring);
    $('#wallsPanel').classList.toggle('hidden',!editing);$('#furnitureCard').classList.toggle('hidden',editing);$('#inventoryCard').classList.toggle('hidden',editing);$('#restoreActions').classList.toggle('hidden',!restoring);
    $('#wallPanelTitle').textContent=restoring?'지운 벽 복원':'내부 벽 지우기';
    $('#wallPanelDescription').textContent=restoring?'도면의 점선을 누르거나 아래 목록에서 원하는 벽을 하나씩 복원하세요.':'도면의 벽을 누르거나 아래 목록에서 구간별로 지울 수 있습니다. 외벽은 고정되어 있습니다.';
    $('#modeHint').classList.toggle('wall-hint',editing);$('#modeHint').classList.toggle('restore-hint',restoring);
    const hint=restoring?'지운 벽을 점선으로 표시합니다. 원하는 점선을 누르면 그 벽만 복원됩니다.':mode==='erase'?'지울 내부 벽을 눌러 주세요. 지운 벽은 벽 복원하기에서 다시 살릴 수 있습니다.':'가구를 끌어 원하는 위치에 놓으세요. 벽 가까이 이동하면 안쪽 면에 붙습니다.';
    $('#modeHint').innerHTML=`<span class="hint-icon">✦</span><span>${hint}</span>`;render();
  }
  function toggleWall(id){
    const w=G.inside.find(x=>x.id===id);if(!w)return;
    const removed=state.removed.includes(id);
    if(removed&&state.items.some(it=>G.overlaps(G.itemRect(it,state.scale),G.wallRect(w)))){toast('가구가 지나는 벽입니다. 가구를 옮긴 뒤 복구해 주세요.');return}
    historyPush();state.removed=removed?state.removed.filter(x=>x!==id):[...state.removed,id];finish();
    toast(removed?'선택한 벽을 복원했습니다.':'벽을 지웠습니다. 벽 복원하기에서 다시 살릴 수 있습니다.');
  }
  function locateFree(item){
    const {w,h}=G.dimensions(item,state.scale),options=opts(null);
    const tryAt=(x,y)=>G.snapped({x,y,w,h},options);
    for(const [x,y] of [[520,265],[270,350],[500,485],[175,490],[180,145],[93,300]]){const p=tryAt(x,y);if(p)return p}
    for(let y=45;y<645;y+=8)for(let x=77;x<820;x+=8){const r={x,y,w,h};if(G.valid(r,options))return G.snapped(r,options)||r}
    return null;
  }
  $('#addForm').addEventListener('submit',e=>{
    e.preventDefault();const w=Number($('#itemWidth').value),h=Number($('#itemHeight').value);
    if(!Number.isFinite(w)||!Number.isFinite(h)||w<5||h<5||w>1500||h>1500){toast('가로와 세로를 5~1,500cm 사이로 입력해 주세요.');return}
    const id=`f${Date.now()}${Math.floor(Math.random()*1e6)}`, name=$('#itemName').value.trim()||`가구 ${state.items.length+1}`;
    const it={id,name,w,h,x:0,y:0,rotated:quarterTurn(),color};const p=locateFree(it);
    if(!p){toast('가구가 들어갈 빈 공간을 찾지 못했습니다. 크기나 기존 배치를 확인해 주세요.');return}
    historyPush();it.x=p.x;it.y=p.y;state.items.push(it);selected=id;$('#itemName').value='';setMode('place');finish();toast(`${name}을(를) 추가했습니다. 도면에서 끌어 이동해 보세요.`);
  });
  $('#colors').addEventListener('click',e=>{const b=e.target.closest('[data-color]');if(b){color=b.dataset.color;renderSidebar()}});
  $('.presets').addEventListener('click',e=>{const b=e.target.closest('[data-preset]');if(!b)return;const p={bed:['침대',160,200],sofa:['소파',220,90],table:['식탁',160,80],kitchen:['주방장',200,60]}[b.dataset.preset];$('#itemName').value=p[0];$('#itemWidth').value=p[1];$('#itemHeight').value=p[2]});
  $('#itemList').addEventListener('click',e=>{const item=e.target.closest('[data-list-item]');if(item){selected=item.dataset.listItem;render()}});
  $('#itemList').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const item=e.target.closest('[data-list-item]');if(item){e.preventDefault();selected=item.dataset.listItem;render()}}});
  $('#wallList').addEventListener('click',e=>{const b=e.target.closest('[data-wall-button]');if(b)toggleWall(b.dataset.wallButton)});
  function pointForEvent(e){const stage=$('#planStage');if(!stage)return null;const m=stage.getScreenCTM();if(!m)return null;return new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse())}
  svg.addEventListener('pointerdown',e=>{
    if(e.button!==0&&e.pointerType==='mouse')return;
    const wallEl=e.target.closest('[data-wall]');if((mode==='erase'||mode==='restore')&&wallEl){e.preventDefault();toggleWall(wallEl.dataset.wall);return}
    if(mode==='erase'&&e.target.closest('[data-outer]')){toast('바깥 테두리 벽은 고정되어 있습니다.');return}
    if(mode!=='place')return;
    const target=e.target.closest('[data-item]');if(!target){selected=null;render();return}
    const it=state.items.find(x=>x.id===target.dataset.item),p=pointForEvent(e);if(!it||!p)return;
    e.preventDefault();selected=it.id;drag={id:it.id,dx:p.x-it.x,dy:p.y-it.y,before:snapshot(),moved:false};render();
  });
  window.addEventListener('pointermove',e=>{
    if(!drag)return;const p=pointForEvent(e),it=state.items.find(x=>x.id===drag.id);if(!p||!it)return;
    const d=G.dimensions(it,state.scale),desired={x:p.x-drag.dx,y:p.y-drag.dy,w:d.w,h:d.h},next=G.snapped(desired,opts(it.id));
    if(next&&(Math.abs(next.x-it.x)>.01||Math.abs(next.y-it.y)>.01)){it.x=next.x;it.y=next.y;drag.moved=true;renderPlan()}
  });
  window.addEventListener('pointerup',()=>{if(drag){if(drag.moved){historyPush(drag.before);save()}drag=null;render()}});
  window.addEventListener('pointercancel',()=>{if(drag){if(drag.moved){historyPush(drag.before);save()}drag=null;render()}});
  function rotateItem(){
    const it=state.items.find(x=>x.id===selected);if(!it){toast('회전할 가구를 먼저 선택해 주세요.');return}
    const old=G.itemRect(it,state.scale),candidate={...it,rotated:!it.rotated},d=G.dimensions(candidate,state.scale);
    const tries=[[old.x+(old.w-d.w)/2,old.y+(old.h-d.h)/2],[old.x,old.y],[old.x+old.w-d.w,old.y],[old.x,old.y+old.h-d.h],[old.x+old.w-d.w,old.y+old.h-d.h]];
    let found=null;for(const [x,y] of tries){const p=G.snapped({x,y,w:d.w,h:d.h},opts(it.id));if(p){found=p;break}}
    if(!found){toast('회전하면 벽이나 다른 가구와 겹칩니다. 먼저 여유 공간으로 옮겨 주세요.');return}
    historyPush();it.rotated=!it.rotated;it.x=found.x;it.y=found.y;finish();toast('가구를 90° 회전했습니다.');
  }
  function deleteItem(){if(!selected)return;historyPush();state.items=state.items.filter(x=>x.id!==selected);selected=null;finish();toast('가구를 삭제했습니다.')}
  $('#rotateButton').addEventListener('click',rotateItem);$('#deleteButton').addEventListener('click',deleteItem);
  $('#applyItemSize').addEventListener('click',()=>{
    const it=state.items.find(x=>x.id===selected);if(!it)return;
    const w=Number($('#editWidth').value),h=Number($('#editHeight').value);
    if(!Number.isFinite(w)||!Number.isFinite(h)||w<5||h<5||w>1500||h>1500){toast('가구 크기는 5~1,500cm 사이로 입력해 주세요.');return}
    const swap=Boolean(it.rotated)!==quarterTurn(),candidate={...it,w:swap?h:w,h:swap?w:h},d=G.dimensions(candidate,state.scale);
    const p=G.snapped({x:it.x,y:it.y,w:d.w,h:d.h},opts(it.id));
    if(!p){toast('이 크기로 바꾸면 벽이나 다른 가구에 겹칩니다. 먼저 가구를 옮겨 주세요.');return}
    historyPush();it.w=candidate.w;it.h=candidate.h;it.x=p.x;it.y=p.y;finish();toast('가구 크기를 변경했습니다.');
  });
  $('#placeMode').addEventListener('click',()=>setMode('place'));$('#wallMode').addEventListener('click',()=>setMode('erase'));$('#restoreMode').addEventListener('click',()=>setMode('restore'));
  $('#rotatePlan').addEventListener('click',()=>{historyPush();state.angle=(state.angle+90)%360;finish();$('#boardWrap').scrollTo({left:0,top:0});toast('도면과 가구를 함께 90° 회전했습니다.')});
  $('#restoreWalls').addEventListener('click',()=>{if(!state.removed.length)return;const blocked=state.removed.filter(id=>{const w=G.inside.find(x=>x.id===id);return w&&state.items.some(it=>G.overlaps(G.itemRect(it,state.scale),G.wallRect(w)))});if(blocked.length===state.removed.length){toast('가구가 벽 위에 있어 복원할 수 없습니다. 먼저 가구를 옮겨 주세요.');return}historyPush();const n=state.removed.length-blocked.length;state.removed=blocked;finish();toast(`${n}개 벽을 복원했습니다.${blocked.length?' 가구가 있는 벽은 남겨 두었습니다.':''}`)});
  $('#deleteAllItems').addEventListener('click',()=>{if(!state.items.length)return;if(!confirm('배치한 가구를 모두 삭제할까요?'))return;historyPush();state.items=[];selected=null;finish()});
  $('#resetAll').addEventListener('click',()=>{if(!confirm('가구와 벽 편집, 도면 방향을 처음 상태로 되돌릴까요?'))return;historyPush();state=defaults();selected=null;zoom=1;setMode('place');finish();toast('도면을 초기 상태로 되돌렸습니다.')});
  $('#undoButton').addEventListener('click',()=>{if(!history.length){toast('되돌릴 작업이 없습니다.');return}state=JSON.parse(history.pop());selected=null;finish();toast('이전 작업을 되돌렸습니다.')});
  $('#snapToggle').addEventListener('change',e=>{state.snap=e.target.checked;save()});
  $('#collisionToggle').addEventListener('change',e=>{const previous=state.avoidItems;state.avoidItems=e.target.checked;if(state.avoidItems&&!G.validAll(state.items,opts(null))){state.avoidItems=previous;e.target.checked=previous;toast('겹쳐진 가구를 먼저 분리해 주세요.');return}save()});
  $('#referenceToggle').addEventListener('change',e=>{state.reference=e.target.checked;finish();if(state.reference)toast('원본의 옅은 선은 참고용이며, 실제 벽 판정은 현재 도면을 따릅니다.')});
  $('#zoomIn').addEventListener('click',()=>{zoom=Math.min(2,zoom+.2);renderPlan()});$('#zoomOut').addEventListener('click',()=>{zoom=Math.max(.7,zoom-.2);renderPlan()});$('#zoomReset').addEventListener('click',()=>{zoom=1;renderPlan()});
  function setScale(scale){
    if(!Number.isFinite(scale)||scale<100/G.REFERENCE_PX||scale>800/G.REFERENCE_PX){toast('실측 길이를 100~800cm로 입력해 주세요.');return}
    if(!G.validAll(state.items,{...opts(null),scale})){toast('보정하면 가구가 벽이나 다른 가구에 겹칩니다. 먼저 가구를 옮겨 주세요.');return}
    historyPush();state.scale=scale;finish();toast('실측 길이로 도면 비율을 보정했습니다.');
  }
  $('#applyScale').addEventListener('click',()=>setScale(Number($('#scaleInput').value)/G.REFERENCE_PX));$('#resetScale').addEventListener('click',()=>setScale(G.BASE_SCALE));
  $('#saveLayout').addEventListener('click',()=>{
    const doc={format:'westville-layout',version:1,state:clone(state)};
    const url=URL.createObjectURL(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='westville-layout.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('배치 파일을 저장했습니다.');
  });
  $('#loadLayout').addEventListener('click',()=>$('#layoutFile').click());
  $('#layoutFile').addEventListener('change',async e=>{
    const file=e.target.files[0];e.target.value='';if(!file)return;
    try{
      if(file.size>1024*1024)throw new Error('too large');
      const doc=JSON.parse(await file.text()),v=doc.state;
      if(doc.format!=='westville-layout'||doc.version!==1||!v||!Array.isArray(v.items)||!Array.isArray(v.removed)||v.items.length>200)throw new Error('invalid');
      const clean=defaults();clean.scale=Number(v.scale);clean.angle=Number(v.angle);clean.snap=v.snap!==false;clean.avoidItems=v.avoidItems!==false;clean.reference=v.reference===true;
      if(!Number.isFinite(clean.scale)||clean.scale<100/G.REFERENCE_PX||clean.scale>800/G.REFERENCE_PX||![0,90,180,270].includes(clean.angle))throw new Error('invalid scale');
      const allowed=new Set(G.inside.map(w=>w.id));clean.removed=[...new Set(v.removed.filter(x=>allowed.has(x)))];
      const ids=new Set();clean.items=v.items.map(it=>{
        const c={id:String(it.id),name:String(it.name||'가구').slice(0,30),w:Number(it.w),h:Number(it.h),x:Number(it.x),y:Number(it.y),rotated:it.rotated===true,color:String(it.color)};
        if(!/^f[a-zA-Z0-9_-]+$/.test(c.id)||ids.has(c.id)||![c.w,c.h,c.x,c.y].every(Number.isFinite)||c.w<5||c.h<5||c.w>1500||c.h>1500||!/^#[0-9a-fA-F]{6}$/.test(c.color))throw new Error('invalid item');ids.add(c.id);return c;
      });
      if(!G.validAll(clean.items,{removed:clean.removed,items:clean.items,scale:clean.scale,avoidItems:clean.avoidItems}))throw new Error('invalid placement');
      historyPush();state=clean;selected=null;setMode('place');finish();toast('배치 파일을 불러왔습니다.');
    }catch(err){console.error(err);toast('배치 파일을 불러오지 못했습니다. 이 도구에서 저장한 파일인지 확인해 주세요.')}
  });
  document.addEventListener('keydown',e=>{
    if(e.target.matches('input,textarea,select')||e.target.isContentEditable)return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$('#undoButton').click();return}
    if(!selected||mode!=='place')return;
    if(e.key.toLowerCase()==='r'){e.preventDefault();rotateItem();return}
    if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteItem();return}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();const it=state.items.find(x=>x.id===selected);if(!it)return;
    let sx=(e.key==='ArrowRight'?1:0)-(e.key==='ArrowLeft'?1:0),sy=(e.key==='ArrowDown'?1:0)-(e.key==='ArrowUp'?1:0),dx=sx,dy=sy;
    if(state.angle===90){dx=sy;dy=-sx}else if(state.angle===180){dx=-sx;dy=-sy}else if(state.angle===270){dx=-sy;dy=sx}
    const step=(e.shiftKey?10:1)/state.scale,d=G.dimensions(it,state.scale),p={x:it.x+dx*step,y:it.y+dy*step,w:d.w,h:d.h};
    if(G.valid(p,opts(it.id))){historyPush();it.x=p.x;it.y=p.y;finish()}
  });
  $('#exportPng').addEventListener('click',async()=>{
    try{
      const copy=svg.cloneNode(true);copy.setAttribute('xmlns','http://www.w3.org/2000/svg');
      const img=copy.querySelector('image');if(img){const blob=await (await fetch('./original-plan.png')).blob();const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)});img.setAttribute('href',data)}
      const data=new XMLSerializer().serializeToString(copy),url=URL.createObjectURL(new Blob([data],{type:'image/svg+xml;charset=utf-8'}));
      const im=new Image();await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=reject;im.src=url});
      const [,,w,h]=svg.getAttribute('viewBox').split(/\s+/).map(Number),canvas=document.createElement('canvas');canvas.width=w*2;canvas.height=h*2;canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);
      canvas.toBlob(blob=>{if(!blob){toast('이미지 저장에 실패했습니다.');return}const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='westville-furniture-layout.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('배치 이미지를 저장했습니다.')},'image/png');
    }catch(err){console.error(err);toast('이미지 저장 중 문제가 생겼습니다.')}
  });
  render();
})();
