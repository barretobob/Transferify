'use strict';
var fs=require('fs'),path=require('path'),palette=require('./gradient-template');
var MAX_IMAGE_BYTES=12*1024*1024,MAX_IMAGE_BASE64=Math.ceil(MAX_IMAGE_BYTES/3)*4,MAX_IMAGE_PIXELS=32*1024*1024;
function finite(n){if(typeof n!=='number'||!isFinite(n)||Math.abs(n)>1e8)throw Error('Invalid number in Figma payload');return n;}
function matrix(m){if(!Array.isArray(m)||m.length!==2||m.some(function(r){return !Array.isArray(r)||r.length!==3;}))throw Error('Invalid Figma transform');return m.map(function(r){return r.map(finite);});}
function clamp(n){n=finite(n);if(n<0||n>1)throw Error('Invalid Figma color/opacity');return n;}
function paint(p,context){if(!p)return null;if(p.type==='SOLID')return {type:p.type,color:{r:clamp(p.color.r),g:clamp(p.color.g),b:clamp(p.color.b)},opacity:p.opacity===undefined?1:clamp(p.opacity)};if(['GRADIENT_LINEAR','GRADIENT_RADIAL'].indexOf(p.type)>=0){if(!Array.isArray(p.gradientStops)||p.gradientStops.length<2||p.gradientStops.length>64)throw Error('Invalid gradient stops');return {type:p.type,opacity:p.opacity===undefined?1:clamp(p.opacity),gradientTransform:matrix(p.gradientTransform),gradientStops:p.gradientStops.map(function(s){return {position:clamp(s.position),color:{r:clamp(s.color.r),g:clamp(s.color.g),b:clamp(s.color.b),a:s.color.a===undefined?1:clamp(s.color.a)}};}).sort(function(a,b){return a.position-b.position;})};}throw Error('Unsupported paint type '+String(p.type||'(missing)')+(context?' — '+context:''));}
function svgPaths(data){
 var tokens=String(data).match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)||[],at=0,cmd='',x=0,y=0,start=null,pts=[],paths=[],lastC=null,lastQ=null;
 function number(){if(at>=tokens.length||/^[a-zA-Z]$/.test(tokens[at]))throw Error('Incomplete Figma vector path');return finite(Number(tokens[at++]));}
 function finish(closed){if(pts.length){if(closed&&pts.length>1&&Math.abs(pts[0].a[0]-pts[pts.length-1].a[0])<1e-7&&Math.abs(pts[0].a[1]-pts[pts.length-1].a[1])<1e-7){pts[0].inT=pts[pts.length-1].inT;pts.pop();}paths.push({closed:closed,points:pts});pts=[];}}
 function move(a,b){finish(false);x=a;y=b;start=[x,y];pts.push({a:[x,y],inT:[0,0],outT:[0,0]});}
 function cubic(a,b,c,d,e,f){if(!pts.length)throw Error('Vector path must begin with M');var prev=pts[pts.length-1];prev.outT=[a-x,b-y];x=e;y=f;pts.push({a:[x,y],inT:[c-x,d-y],outT:[0,0]});lastC=[c,d];}
 while(at<tokens.length){if(/^[a-zA-Z]$/.test(tokens[at]))cmd=tokens[at++];if(!cmd)throw Error('Vector path command missing');var rel=cmd===cmd.toLowerCase(),op=cmd.toUpperCase(),ox=x,oy=y;
  if(op==='Z'){finish(true);if(start){x=start[0];y=start[1];}cmd='';lastC=lastQ=null;continue;}
  if(['M','L','H','V','C','S','Q','T'].indexOf(op)<0)throw Error('Unsupported SVG command '+cmd+'; use an outlined Figma vector');
  var a,b,c,d,e,f;if(op==='M'||op==='L'){a=number()+(rel?ox:0);b=number()+(rel?oy:0);if(op==='M'){move(a,b);cmd=rel?'l':'L';}else cubic(x,y,a,b,a,b);lastC=lastQ=null;}
  else if(op==='H'||op==='V'){a=op==='H'?number()+(rel?ox:0):x;b=op==='V'?number()+(rel?oy:0):y;cubic(x,y,a,b,a,b);lastC=lastQ=null;}
  else if(op==='C'){a=number()+(rel?ox:0);b=number()+(rel?oy:0);c=number()+(rel?ox:0);d=number()+(rel?oy:0);e=number()+(rel?ox:0);f=number()+(rel?oy:0);cubic(a,b,c,d,e,f);lastQ=null;}
  else if(op==='S'){a=lastC?2*x-lastC[0]:x;b=lastC?2*y-lastC[1]:y;c=number()+(rel?ox:0);d=number()+(rel?oy:0);e=number()+(rel?ox:0);f=number()+(rel?oy:0);cubic(a,b,c,d,e,f);lastQ=null;}
  else{if(op==='Q'){a=number()+(rel?ox:0);b=number()+(rel?oy:0);}else{a=lastQ?2*x-lastQ[0]:x;b=lastQ?2*y-lastQ[1]:y;}e=number()+(rel?ox:0);f=number()+(rel?oy:0);cubic(x+(a-x)*2/3,y+(b-y)*2/3,e+(a-e)*2/3,f+(b-f)*2/3,e,f);lastQ=[a,b];lastC=null;}
 }
 finish(false);if(paths.reduce(function(n,p){return n+p.points.length;},0)>20000)throw Error('Vector exceeds 20000 vertices');return paths;
}
exports.svgPaths=svgPaths;
exports.normalize=function(payload,assetDir,tempDir){
 if(!payload||payload.protocol!=='transferify-figma'||payload.version!==1||!payload.source||!Array.isArray(payload.nodes)||payload.nodes.length>1000)throw Error('Invalid Transferify Figma package');
 var w=finite(payload.source.width),h=finite(payload.source.height);if(w<1||h<1||w>30000||h>30000)throw Error('Frame dimensions must be between 1 and 30000 px');
 var out={source:{name:String(payload.source.name||'Figma').slice(0,200),width:w,height:h},nodes:[],warnings:(payload.warnings||[]).slice(0,100).map(function(s){return String(s).slice(0,500);})},ids=Object.create(null);
 if(typeof payload.source.frameId==='string'&&payload.source.frameId.length<=200)out.source.frameId=payload.source.frameId;
 if(payload.compMode==='new'||payload.compMode==='current')out.compMode=payload.compMode;
 out.precompGroups=payload.precompGroups===true;
 if(payload.importOptions){var op=payload.importOptions;if(['new','current'].indexOf(op.mode)<0)throw Error('Invalid comp mode');var mult=finite(op.multiplier),fps=finite(op.fps),duration=finite(op.duration);if(mult<.1||mult>8||fps<1||fps>120||duration<.1||duration>10800)throw Error('Invalid comp settings');out.importOptions={mode:op.mode,multiplier:mult,fps:fps,duration:duration,parametric:op.parametric!==false,precompGroups:op.precompGroups===true};}
 payload.nodes.forEach(function(n,index){if(!n||['group','shape','text','image'].indexOf(n.kind)<0)throw Error('Unsupported Figma node');var id=String(n.id);if(ids[id])throw Error('Duplicate Figma node id');if(n.parentId===id)throw Error('Self parent is invalid');ids[id]=true;if(n.parentId!==null&&n.parentId!==undefined&&!ids[String(n.parentId)])throw Error('Parent must precede child');var o={id:id,parentId:n.parentId==null?null:String(n.parentId),kind:n.kind,name:String(n.name||n.kind).slice(0,200),matrix:matrix(n.matrix),width:finite(n.width),height:finite(n.height),opacity:clamp(n.opacity)};
  if(typeof n.frameBackgroundFor==='string'&&n.frameBackgroundFor.length<=200)o.frameBackgroundFor=n.frameBackgroundFor;
  if(n.reference===true)o.reference=true;
  if(n.blendMode==='OVERLAY')o.blendMode='OVERLAY';
  if(n.isMatte===true)o.isMatte=true;if(n.uncroppedPhoto===true)o.uncroppedPhoto=true;if(n.matteId!=null){o.matteId=String(n.matteId);if(['ALPHA','LUMA'].indexOf(n.matteMode)<0)throw Error('Invalid matte mode');o.matteMode=n.matteMode;}
  if(n.kind==='shape'){
   o.layerBlurs=(n.layerBlurs||[]).map(function(r){r=finite(r);if(r<0||r>1000)throw Error('Invalid layer blur radius');return r;});
   o.fill=paint((n.fills||[])[0],o.name+' / fill');o.stroke=paint((n.strokes||[])[0],o.name+' / stroke');if(o.stroke&&o.stroke.type!=='SOLID')throw Error('Gradient stroke must be outlined in this build');o.strokeWeight=finite(n.strokeWeight||0);o.strokeCap=String(n.strokeCap);o.strokeJoin=String(n.strokeJoin);o.strokeDashes=(n.strokeDashes||[]).slice(0,40).map(finite);
   if(n.primitive){if(['rectangle','ellipse'].indexOf(n.primitive.kind)<0)throw Error('Invalid primitive');o.primitive={kind:n.primitive.kind,radius:finite(n.primitive.radius||0)};}else{o.paths=[];(n.paths||[]).forEach(function(p){o.rule=p.windingRule==='EVENODD'?2:1;o.paths=o.paths.concat(svgPaths(p.data));});if(!o.paths.length)throw Error('Empty vector '+o.name);}
   if(o.fill&&o.fill.type!=='SOLID'){o.gradientFile=path.join(tempDir,'gradient_'+index+'.aep');fs.writeFileSync(o.gradientFile,palette.build(assetDir,o.fill.gradientStops));}
  }else if(n.kind==='group')o.containerType=String(n.containerType||'');
 if(n.kind==='image'){
   if(typeof n.imageBase64!=='string'||n.imageBase64.length>MAX_IMAGE_BASE64||!/^[A-Za-z0-9+/=]+$/.test(n.imageBase64))throw Error('Invalid image data');var bytes=Buffer.from(n.imageBase64,'base64');if(bytes.length>MAX_IMAGE_BYTES)throw Error(o.name+': foto maior que 12 MB.');if(bytes.length<24||bytes.slice(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Only generated PNG images accepted');o.pixelWidth=bytes.readUInt32BE(16);o.pixelHeight=bytes.readUInt32BE(20);if(!o.pixelWidth||!o.pixelHeight||o.pixelWidth*o.pixelHeight>MAX_IMAGE_PIXELS)throw Error(o.name+': dimensões inválidas ou imagem maior que 32 MP.');o.file=path.join(tempDir,'image_'+index+'.png');fs.writeFileSync(o.file,bytes);o.imageBox={x:finite(n.imageBox.x),y:finite(n.imageBox.y),width:finite(n.imageBox.width),height:finite(n.imageBox.height)};
  }else if(n.kind==='text'){
   if(typeof n.text!=='string'||n.text.length>100000||!Array.isArray(n.runs))throw Error('Invalid text');o.text=n.text;o.stroke=n.stroke?paint(n.stroke,o.name+' / text stroke'):null;if(o.stroke&&o.stroke.type!=='SOLID')throw Error('Text stroke must be solid');o.strokeWeight=finite(n.strokeWeight||0);if(o.strokeWeight<0||o.strokeWeight>10000)throw Error('Invalid text stroke width');o.strokeAlign=['CENTER','OUTSIDE','INSIDE'].indexOf(n.strokeAlign)>=0?n.strokeAlign:'CENTER';o.autoResize=String(n.autoResize);o.alignment=String(n.alignment);o.glyphBounds={x:finite(n.glyphBounds.x),y:finite(n.glyphBounds.y),width:finite(n.glyphBounds.width),height:finite(n.glyphBounds.height)};
   o.runs=n.runs.map(function(r){var start=finite(r.start),end=finite(r.end);if(start<0||end<start||end>o.text.length)throw Error('Invalid text range');return {start:start,end:end,fontFamily:String(r.fontFamily).slice(0,200),fontStyle:String(r.fontStyle).slice(0,100),size:finite(r.size),fill:r.fill?paint(r.fill,o.name+' / text range '+start+'-'+end):null,tracking:finite(r.tracking),lineHeight:r.lineHeight&&['PIXELS','PERCENT','AUTO'].indexOf(r.lineHeight.unit)>=0?{unit:r.lineHeight.unit,value:r.lineHeight.unit==='AUTO'?0:finite(r.lineHeight.value)}:{unit:'AUTO',value:0},textCase:String(r.textCase)};});
  }
  out.nodes.push(o);
 });

 var frameOwner=out.nodes.filter(function(n){return n.id===out.source.frameId&&n.kind==='group'&&n.containerType==='FRAME'&&n.parentId===null;});
 var backgrounds=out.nodes.filter(function(n){return n.frameBackgroundFor===out.source.frameId;});
 var identified=typeof out.source.frameId==='string'&&frameOwner.length===1&&backgrounds.length===1;
 out.nodes.forEach(function(n){
  if(!identified||n.frameBackgroundFor!==out.source.frameId||n.id!==out.source.frameId+':background'||n.parentId!==out.source.frameId||n.kind!=='shape'||!n.primitive||n.primitive.kind!=='rectangle'||n.reference||n.isMatte||n.matteId)delete n.frameBackgroundFor;
 });
 var byId=Object.create(null);out.nodes.forEach(function(n){byId[n.id]=n;});out.nodes.forEach(function(n){var seen=Object.create(null),current=n;while(current.matteId){if(seen[current.id])throw Error('Cyclic track matte');seen[current.id]=true;var matte=byId[current.matteId];if(!matte||!matte.isMatte||matte.kind==='group'||matte.parentId!==n.parentId)throw Error('Invalid track matte link');current=matte;}});return out;
};
