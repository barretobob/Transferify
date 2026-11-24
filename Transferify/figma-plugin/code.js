figma.showUI(__html__, {width: 240, height: 450, themeColors: true});
function identity(){return [[1,0,0],[0,1,0]];}
function mul(a,b){return [[a[0][0]*b[0][0]+a[0][1]*b[1][0],a[0][0]*b[0][1]+a[0][1]*b[1][1],a[0][0]*b[0][2]+a[0][1]*b[1][2]+a[0][2]],[a[1][0]*b[0][0]+a[1][1]*b[1][0],a[1][0]*b[0][1]+a[1][1]*b[1][1],a[1][0]*b[0][2]+a[1][1]*b[1][2]+a[1][2]]];}
function inverse(m){const d=m[0][0]*m[1][1]-m[0][1]*m[1][0];if(Math.abs(d)<1e-10)throw Error('Uma layer tem escala zero.');return [[m[1][1]/d,-m[0][1]/d,(m[0][1]*m[1][2]-m[1][1]*m[0][2])/d],[-m[1][0]/d,m[0][0]/d,(m[1][0]*m[0][2]-m[0][0]*m[1][2])/d]];}
function point(m,p){return [m[0][0]*p[0]+m[0][1]*p[1]+m[0][2],m[1][0]*p[0]+m[1][1]*p[1]+m[1][2]];}
// Encode in bounded chunks so large photos do not retain millions of tiny strings.
function base64(bytes){const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',chunks=[];for(let start=0;start<bytes.length;start+=49152){const parts=[],end=Math.min(start+49152,bytes.length);for(let i=start;i<end;i+=3){const a=bytes[i],b=i+1<bytes.length?bytes[i+1]:0,c=i+2<bytes.length?bytes[i+2]:0;parts.push(chars[a>>2]+chars[((a&3)<<4)|(b>>4)]+(i+1<bytes.length?chars[((b&15)<<2)|(c>>6)]:'=')+(i+2<bytes.length?chars[c&63]:'='));}chunks.push(parts.join(''));}return chunks.join('');}
function paints(n,k){return k in n&&n[k]!==figma.mixed?n[k].filter(p=>p.visible!==false):[];}
function visible(n){return !('visible' in n)||n.visible;}
async function loadFonts(n){const texts=n.type==='TEXT'?[n]:('findAllWithCriteria' in n?n.findAllWithCriteria({types:['TEXT']}):[]),fonts=new Map();for(const t of texts)for(const r of t.getStyledTextSegments(['fontName']))fonts.set(r.fontName.family+'|'+r.fontName.style,r.fontName);for(const f of fonts.values())await figma.loadFontAsync(f);}
async function outline(n,geometryOnly,ignoreStroke){await loadFonts(n);let copy=n.clone(),v=null;try{figma.currentPage.appendChild(copy);if(geometryOnly&&'children' in copy){if(copy.type==='INSTANCE')copy=copy.detachInstance();for(const child of [...copy.children])child.remove();}if(ignoreStroke&&'strokes' in copy)copy.strokes=[];copy.relativeTransform=identity();v=figma.flatten([copy]);copy=null;const b=v.absoluteBoundingBox;return {paths:v.vectorPaths.map(p=>({data:p.data,windingRule:p.windingRule})),matrix:v.absoluteTransform,bounds:{x:b.x,y:b.y,width:b.width,height:b.height}};}finally{if(v&&!v.removed)v.remove();if(copy&&!copy.removed)copy.remove();}}
async function pngWithinLimit(n,bounds){
 const limit=12*1024*1024,b=bounds||n.absoluteRenderBounds||{width:n.width,height:n.height},area=b.width*b.height;let scale=area>32*1024*1024?Math.sqrt(16*1024*1024/area):1;
 for(let attempt=0;attempt<8;attempt++){const bytes=await n.exportAsync({format:'PNG',constraint:{type:'SCALE',value:scale},colorProfile:'SRGB'});if(bytes.length<=limit)return {bytes,scale};scale*=Math.min(.85,Math.sqrt(limit/bytes.length)*.95);}
 throw Error(n.name+': não foi possível converter a imagem para 12 MB.');
}
async function raster(n,out,parentId,matrix,alpha,warnings,reason,backgroundOnly){const renderBounds=n.absoluteRenderBounds||n.absoluteBoundingBox;if(renderBounds&&renderBounds.width*renderBounds.height>32*1024*1024)throw Error(n.name+': área de rasterização maior que 32 MP. Selecione um bloco menor.');if(!backgroundOnly)await loadFonts(n);let copy=n.clone();try{figma.currentPage.appendChild(copy);if(backgroundOnly&&'children' in copy){if(copy.type==='INSTANCE')copy=copy.detachInstance();if('layoutMode' in copy)copy.layoutMode='NONE';for(const child of [...copy.children])child.remove();copy.resize(n.width,n.height);}copy.relativeTransform=identity();copy.opacity=1;const b=copy.absoluteRenderBounds||copy.absoluteBoundingBox,converted=await pngWithinLimit(copy,b),bytes=converted.bytes;if(converted.scale<1)warnings.push(n.name+': resolução do PNG reduzida para caber em 12 MB.');out.push({id:n.id,parentId,kind:'image',name:n.name,matrix,width:n.width,height:n.height,opacity:alpha,imageBase64:base64(bytes),imageBox:{x:b.x,y:b.y,width:b.width,height:b.height}});if(reason)warnings.push(n.name+': '+reason+' — enviado como PNG.');}finally{if(copy&&!copy.removed)copy.remove();}}
function exactSelection(ids){
 const selected=[...figma.currentPage.selection];if(!Array.isArray(ids)||!ids.length)throw Error('Reabra o plugin e selecione explicitamente os objetos para enviar.');
 const wanted=new Set(ids);if(wanted.size!==ids.length||selected.length!==ids.length||selected.some(n=>!wanted.has(n.id)))throw Error('A seleção mudou. Nada foi enviado; selecione os objetos novamente.');return selected;
}
function selectedPaintOrder(a,b){function path(n){const out=[];while(n.parent&&n.parent.type!=='DOCUMENT'){out.unshift(n.parent.children.indexOf(n));n=n.parent;}return out;}const x=path(a),y=path(b);for(let i=0;i<Math.min(x.length,y.length);i++)if(x[i]!==y[i])return x[i]-y[i];return x.length-y.length;}
function selectedBudget(roots){let total=0;function visit(n){if(!visible(n))return;if(++total>1000)throw Error('Seleção maior que 1000 objetos. Nada foi enviado; selecione um bloco menor.');if('children' in n)for(const c of n.children)visit(c);}for(const n of roots)visit(n);return total;}
async function exportSelection(options){
 options=options||{};
 const selected=options.selection||[...figma.currentPage.selection];try{if(!selected.length)throw Error('Selecione um frame ou objetos no Figma.');
 const selectedIds=new Set(selected.map(n=>n.id)),roots=selected.filter(n=>{let p=n.parent;while(p){if(selectedIds.has(p.id))return false;p=p.parent;}return true;});
 // Compare ancestor indices only; never traverse unrelated page branches.
 roots.sort(selectedPaintOrder);selectedBudget(roots);
 let source,origin;
 const frameTypes=['FRAME','COMPONENT','INSTANCE'];
 const validFrameSize=n=>n.width>=1&&n.height>=1&&n.width<=30000&&n.height<=30000;
 const selectedFrame=roots.length===1&&frameTypes.includes(roots[0].type)?roots[0]:null;
 // A selected frame defines the artwork origin in both NEW and CURRENT.
 let sourceFrame=selectedFrame;
 if(!sourceFrame&&options.compMode==='current'){
  const bounds=roots.map(n=>n.absoluteBoundingBox);
  const rootIds=new Set(roots.map(n=>n.id));
  const isTextSelection=roots.every(n=>n.type==='TEXT'||n.type==='COMPONENT'||n.type==='INSTANCE');
  function frameContainsSelection(candidate){
   if(!validFrameSize(candidate))return false;
   let inv;
   try{inv=inverse(candidate.absoluteTransform);}catch(_){return false;}
   const points=[];
   for(const b of bounds){
    if(!b)return false;
    for(const corner of [[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]])points.push(point(inv,corner));
   }
   const left=Math.min(...points.map(p=>p[0])),top=Math.min(...points.map(p=>p[1]));
   const right=Math.max(...points.map(p=>p[0])),bottom=Math.max(...points.map(p=>p[1]));
   if(left<-.5||top<-.5||right>candidate.width+.5||bottom>candidate.height+.5)return false;
   // Reject tight text wrappers, including components sized to their text.
   return !isTextSelection||candidate.width-(right-left)>2||candidate.height-(bottom-top)>2;
  }
  for(let p=roots[0].parent;p&&p.type!=='PAGE';p=p.parent){
   if(!frameTypes.includes(p.type)||!validFrameSize(p)||(isTextSelection&&!frameContainsSelection(p)))continue;
   if(roots.every(node=>{for(let a=node.parent;a;a=a.parent)if(a.id===p.id)return true;return false;})){sourceFrame=p;break;}
  }
  if(!sourceFrame){
   let checked=0;
   for(let parent=roots[0].parent;parent&&checked<2000;parent=parent.parent){
    for(const candidate of parent.children||[]){
     if(++checked>2000)break;
     if(rootIds.has(candidate.id)||candidate.visible===false||!frameTypes.includes(candidate.type)||!frameContainsSelection(candidate))continue;
     if(!sourceFrame||candidate.width*candidate.height<sourceFrame.width*sourceFrame.height)sourceFrame=candidate;
    }
   }
  }
  if(!sourceFrame&&selectedFrame&&selectedFrame.type==='FRAME')sourceFrame=selectedFrame;
  if(!sourceFrame&&isTextSelection)throw Error('Não encontrei o frame de origem do texto. Coloque o texto dentro do frame no Figma e reenvie em Current.');
 }
 if(sourceFrame){source={name:sourceFrame.name,width:sourceFrame.width,height:sourceFrame.height};if(sourceFrame.type==='FRAME')source.frameId=sourceFrame.id;origin=inverse(sourceFrame.absoluteTransform);}
 else{const bs=roots.map(n=>n.absoluteBoundingBox).filter(Boolean);if(!bs.length)throw Error('Seleção sem bounds.');const x=Math.min(...bs.map(b=>b.x)),y=Math.min(...bs.map(b=>b.y)),right=Math.max(...bs.map(b=>b.x+b.width)),bottom=Math.max(...bs.map(b=>b.y+b.height));source={name:roots.length===1?roots[0].name:'Figma Selection',width:Math.max(1,right-x),height:Math.max(1,bottom-y)};origin=[[1,0,-x],[0,1,-y]];}
 function hasBackdrop(n){return ('effects' in n&&n.effects.some(e=>e.visible!==false&&/BACKGROUND_BLUR|GLASS/.test(e.type)))||('children' in n&&n.children.some(hasBackdrop));}
 const nodes=[],warnings=[];

 
 async function matteFor(target,clip,index){const id=target.id+':matte:'+index,start=nodes.length;
  const mask=clip.node,vectorMask=!('children' in mask)||mask.type==='BOOLEAN_OPERATION';
  if(clip.mode==='VECTOR')await shape(mask,target.parentId,1,mul(origin,mask.absoluteTransform),[{type:'SOLID',color:{r:1,g:1,b:1},opacity:1}],[],id);
  else if(vectorMask){const fills=paints(mask,'fills'),strokes=paints(mask,'strokes'),effects='effects' in mask?mask.effects.filter(e=>e.visible!==false):[];
   if(effects.length||fills.length>1||strokes.length>1||fills.some(p=>!['SOLID','GRADIENT_LINEAR','GRADIENT_RADIAL'].includes(p.type))||strokes.some(p=>p.type!=='SOLID'))throw Error(mask.name+': this mask appearance cannot be preserved as an editable Shape Layer.');
   await shape(mask,target.parentId,mask.opacity,mul(origin,mask.absoluteTransform),fills,strokes,id);
  }else await raster(mask,nodes,target.parentId,mul(origin,mask.absoluteTransform),mask.opacity,warnings,null);
  if(nodes.length!==start+1)throw Error('Cannot export mask: '+clip.node.name);const matte=nodes[nodes.length-1];matte.id=id;matte.name=target.name+' / Matte '+(index+1);matte.isMatte=true;matte.matteId=target.matteId||null;matte.matteMode=target.matteMode||'ALPHA';target.matteId=id;target.matteMode=clip.mode==='LUMINANCE'?'LUMA':'ALPHA';
 }
 async function walk(n,parentId,inherited,isRoot,clips){clips=clips||[];await walkCore(n,parentId,inherited,isRoot,clips);const direct=nodes.filter(x=>x.id===n.id||x.id===n.id+':background'||x.id===n.id+':border');for(const item of direct)if(item.kind!=='group'&&!item.reference)for(let i=0;i<clips.length;i++){const clip=clips[i];await matteFor(item,clip,i+1);}}

 async function walkCore(n,parentId,inherited,isRoot,clips){if(!visible(n))return;const matrix=mul(origin,n.absoluteTransform),alpha=inherited*('opacity' in n?n.opacity:1),fills=paints(n,'fills'),strokes=paints(n,'strokes'),effects='effects' in n?n.effects.filter(e=>e.visible!==false&&!/BACKGROUND_BLUR|GLASS/.test(e.type)):[];
  if('effects' in n&&n.effects.some(e=>e.visible!==false&&/BACKGROUND_BLUR|GLASS/.test(e.type)))warnings.push(n.name+': blur de fundo/glass ainda não reproduzido; camadas preservadas editáveis.');
  const nestedClip='children' in n&&((n.clipsContent&&!isRoot)||n.children.some(c=>'isMask' in c&&c.isMask));
  const unsupportedPaint=[...fills,...strokes].some(p=>!['SOLID','GRADIENT_LINEAR','GRADIENT_RADIAL','IMAGE'].includes(p.type));
  const vectorShape=['RECTANGLE','ELLIPSE','VECTOR','BOOLEAN_OPERATION','POLYGON','STAR','LINE'].includes(n.type)&&!fills.some(p=>p.type==='IMAGE');
  const nativeBlur=effects.length>0&&effects.every(e=>e.type==='LAYER_BLUR'&&e.blurType!=='PROGRESSIVE')&&vectorShape;
  if(vectorShape&&effects.some(e=>e.type!=='LAYER_BLUR'||e.blurType==='PROGRESSIVE'))warnings.push(n.name+': efeito de sombra/blur não suportado omitido; shape e transparência preservados.');
  if((effects.length&&!nativeBlur&&!vectorShape)||unsupportedPaint||fills.length>1||strokes.length>1||strokes.some(p=>p.type!=='SOLID')){await raster(n,nodes,parentId,matrix,alpha,warnings,nestedClip?'clipping/máscara':effects.length?'efeito de aparência':'pintura complexa');return;}
  if('children' in n&&!['BOOLEAN_OPERATION'].includes(n.type)){
   nodes.push({id:n.id,parentId,kind:'group',containerType:n.type,name:n.name,matrix,width:n.width,height:n.height,opacity:1});
   if(fills.some(p=>p.type==='IMAGE')){
    await raster(n,nodes,n.id,matrix,alpha,warnings,'fundo com imagem',true);
    const background=nodes[nodes.length-1];background.id=n.id+':background';background.name=n.name+' / Background';
   }else if(fills.length||strokes.length)await shape(n,n.id,alpha,matrix,fills,strokes,n.id+':background');
   const childClips=clips;let mask=null;for(const child of n.children){if(child.isMask&&child.visible!==false){mask={node:child,mode:child.maskType||'ALPHA'};continue;}await walk(child,n.id,alpha,false,mask?childClips.concat([mask]):childClips);}return;
  }
  if(fills.some(p=>p.type==='IMAGE')){await raster(n,nodes,parentId,matrix,alpha,warnings,null);return;}
  if(n.type==='TEXT'){
   if(strokes.length&&(n.strokeAlign==='INSIDE'||(typeof strokes[0].opacity==='number'&&strokes[0].opacity<1))){await raster(n,nodes,parentId,matrix,alpha,warnings,'text stroke alignment/opacity preserved as image');return;}
   const segments=n.getStyledTextSegments(['fontName','fontSize','fills','letterSpacing','lineHeight','textCase']);
   if(segments.some(r=>r.fills.some(p=>p.visible!==false&&p.type!=='SOLID'))){await shape(n,parentId,alpha,matrix,fills,strokes,n.id);warnings.push(n.name+': texto com gradiente enviado em contornos editáveis.');return;}
   const metrics=await outline(n,false,true),runs=segments.map(r=>({start:r.start,end:r.end,fontFamily:r.fontName.family,fontStyle:r.fontName.style,size:r.fontSize,fill:r.fills.find(p=>p.type==='SOLID'&&p.visible!==false)||null,tracking:r.letterSpacing.unit==='PIXELS'?r.letterSpacing.value/r.fontSize*1000:r.letterSpacing.value*10,lineHeight:r.lineHeight,textCase:r.textCase}));
   let displayText='',displayRuns=[];for(const run of runs){let value=n.characters.slice(run.start,run.end);if(run.textCase==='UPPER')value=value.toUpperCase();else if(run.textCase==='LOWER')value=value.toLowerCase();const start=displayText.length;displayText+=value;displayRuns.push({...run,start,end:displayText.length,textCase:(run.textCase==='UPPER'||run.textCase==='LOWER')?'ORIGINAL':run.textCase});}
   nodes.push({id:n.id,parentId,kind:'text',blendMode:n.blendMode||'NORMAL',stroke:strokes[0]||null,strokeWeight:typeof n.strokeWeight==='number'?n.strokeWeight:0,strokeAlign:n.strokeAlign||'CENTER',name:n.name,matrix,width:n.width,height:n.height,opacity:alpha,text:displayText,runs:displayRuns,glyphBounds:metrics.bounds,alignment:n.textAlignHorizontal,autoResize:n.textAutoResize});return;
  }
  await shape(n,parentId,alpha,matrix,fills,strokes,n.id);
 }
 async function shape(n,parentId,alpha,matrix,fills,strokes,id){let primitive=null,paths=null;
  if(['FRAME','COMPONENT','INSTANCE','RECTANGLE'].includes(n.type)&&typeof n.cornerRadius==='number'&&(!('cornerSmoothing' in n)||n.cornerSmoothing===0))primitive={kind:'rectangle',radius:n.cornerRadius};
  else if(n.type==='ELLIPSE'&&(!n.arcData||Math.abs(n.arcData.endingAngle-n.arcData.startingAngle-2*Math.PI)<.001)&&(!n.arcData||n.arcData.innerRadius===0))primitive={kind:'ellipse'};
  else if('vectorPaths' in n)paths=n.vectorPaths.map(p=>({data:p.data,windingRule:p.windingRule}));
  else{const data=await outline(n,['FRAME','COMPONENT','INSTANCE'].includes(n.type));paths=data.paths;matrix=mul(matrix,data.matrix);}
  if(!primitive&&(!paths||!paths.length))return;
  nodes.push({id,parentId,kind:'shape',name:id.endsWith(':background')?n.name+' / Background':n.name,matrix,width:n.width,height:n.height,opacity:alpha,layerBlurs:('effects' in n?n.effects:[]).filter(e=>e.visible!==false&&e.type==='LAYER_BLUR'&&e.blurType!=='PROGRESSIVE').map(e=>e.radius),primitive,paths,fills,strokes,strokeWeight:typeof n.strokeWeight==='number'?n.strokeWeight:1,strokeCap:n.strokeCap||'NONE',strokeJoin:n.strokeJoin||'MITER',strokeDashes:n.dashPattern||[]});
  if(sourceFrame&&sourceFrame.type==='FRAME'&&n.id===sourceFrame.id&&parentId===n.id&&id===n.id+':background'&&primitive&&primitive.kind==='rectangle'){
   nodes[nodes.length-1].frameBackgroundFor=n.id;
  }
 }
 for(const n of roots){if(options.rasterize)await raster(n,nodes,null,mul(origin,n.absoluteTransform),n.opacity,warnings,null);else await walk(n,null,1,true);}
 if(options.reference){for(const n of roots){await raster(n,nodes,null,mul(origin,n.absoluteTransform),n.opacity,warnings,null);const ref=nodes[nodes.length-1];ref.id=n.id+':reference';ref.name=n.name+' / Reference';ref.reference=true;}}

 if(nodes.length>1000)throw Error('Seleção maior que 1000 layers; envie em blocos.');return {protocol:'transferify-figma',version:1,source,nodes,warnings,compMode:options.compMode,positionFrame:sourceFrame?sourceFrame.name:null,positionRevision:'4',precompGroups:options.precompGroups,importOptions:options.importOptions};
 }finally{const current=[...figma.currentPage.selection];if(!current.length||current.every(n=>selected.some(s=>s.id===n.id)))figma.currentPage.selection=selected.filter(n=>!n.removed);}
}
async function exportIllustratorSelection(options){
 const selected=options.selection;if(!selected.length)throw Error('Select artwork in Figma first.');
 const ids=new Set(selected.map(n=>n.id)),roots=selected.filter(n=>{let p=n.parent;while(p){if(ids.has(p.id))return false;p=p.parent;}return true;});
 roots.sort(selectedPaintOrder);selectedBudget(roots);
 const bounds=roots.map(n=>n.absoluteRenderBounds||n.absoluteBoundingBox),left=Math.min(...bounds.map(b=>b.x)),top=Math.min(...bounds.map(b=>b.y)),items=[];
 for(let i=0;i<roots.length;i++){const node=roots[i],svg=await node.exportAsync({format:'SVG_STRING',svgOutlineText:false,svgIdAttribute:true});items.push({name:node.name,x:bounds[i].x-left,y:bounds[i].y-top,svg});}
 return {protocol:'transferify-figma-svg',version:1,items};
}
figma.ui.onmessage=async msg=>{try{
 if(msg.type==='reload'){figma.showUI(__html__,{width:240,height:490,themeColors:true});reportSelection();}
 else if(msg.type==='prepare'){const selection=exactSelection(msg.selectionIds);const options={selection,compMode:msg.compMode,reference:!!msg.reference,rasterize:!!msg.rasterize,precompGroups:typeof msg.precompGroups==='boolean'?msg.precompGroups:undefined};const payload=msg.destination==='illustrator'?await exportIllustratorSelection(options):await exportSelection(options);figma.ui.postMessage({type:'payload',payload});}
 else if(msg.type==='import-illustrator'){
  const svg=String(msg.data.svg||'').replace(/<\?xml[^>]*>/g,'').replace(/<!DOCTYPE[\s\S]*?>/gi,'');
  const node=figma.createNodeFromSvg(svg);node.name=msg.data.name||'Illustrator selection';
  const selection=figma.currentPage.selection,anchor=selection.length?selection[0].absoluteBoundingBox:null;
  node.x=anchor?anchor.x+anchor.width+60:figma.viewport.center.x-node.width/2;node.y=anchor?anchor.y:figma.viewport.center.y-node.height/2;
  figma.currentPage.selection=[node];figma.ui.postMessage({type:'import-complete',name:node.name,warnings:msg.data.warnings||[]});
 }
 }catch(e){figma.ui.postMessage({type:'error',message:String(e.message||e)});}};
function reportSelection(){const selection=[...figma.currentPage.selection];figma.ui.postMessage({type:'selection',count:selection.length,ids:selection.map(n=>n.id)});}figma.on('selectionchange',reportSelection);reportSelection();
