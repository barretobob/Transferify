/* Browser-side compatibility for Figma objectBoundingBox image patterns. */
function pruneUnusedIllustratorAssets(root,defs){
 function prune(tag){var used=Object.create(null),all=root.querySelectorAll('*');for(var i=0;i<all.length;i++)for(var j=0;j<all[i].attributes.length;j++){var a=all[i].attributes[j],m;if(/(^|:)href$/i.test(a.name)&&a.value.charAt(0)==='#')used[a.value.slice(1)]=true;var re=/url\(\s*["']?#([^\s"')]+)["']?\s*\)/g;while((m=re.exec(a.value)))used[m[1]]=true;}var candidates=defs.querySelectorAll(tag);for(var i=0;i<candidates.length;i++){var item=candidates[i],id=item.getAttribute('id');if(id&&!used[id]&&item.parentNode)item.parentNode.removeChild(item);}}
 // Remove dead patterns first so their image references no longer keep source images alive.
 prune('pattern');prune('image');
}

function openOriginalFigmaFrame(root,frame){
 if(!frame||frame.type!=='FRAME'||!frame.nodeId||!frame.clipsContent)return false;
 // Figma exports its selected Frame as the sole drawable SVG root. Never scan descendants.
 var drawable=Array.prototype.filter.call(root.children,function(n){return !/^(defs|title|desc|metadata|style)$/.test(n.localName);});
 if(drawable.length!==1||drawable[0].localName!=='g'||!drawable[0].hasAttribute('clip-path'))return false;
 drawable[0].removeAttribute('clip-path');root.setAttribute('overflow','visible');return true;
}

function prepareIllustratorSVG(svg,frame) {
 var ns='http://www.w3.org/2000/svg',doc=new DOMParser().parseFromString(svg,'image/svg+xml'),root=doc.documentElement,mount=null;
 if(root.localName!=='svg'||doc.querySelector('parsererror'))throw Error('Invalid SVG export.');
 var all=root.querySelectorAll('*');
 for(var i=0;i<all.length;i++){
  if(/^(script|foreignObject)$/i.test(all[i].localName))throw Error('Active SVG is not supported.');
  for(var ai=0;ai<all[i].attributes.length;ai++){var attr=all[i].attributes[ai];if(/^on/i.test(attr.name))throw Error('Active SVG attributes are not supported.');if(/(^|:)href$/i.test(attr.name)&&!/^#|^data:image\/(png|jpeg|webp|gif);base64,/i.test(attr.value))throw Error('External SVG resources are not supported.');var urls=attr.value.match(/url\([^)]*\)/ig)||[];for(var ui=0;ui<urls.length;ui++)if(urls[ui].slice(4,-1).trim().replace(/^['"]|['"]$/g,'').charAt(0)!=='#')throw Error('External SVG resources are not supported.');}
 }
 var frameOpened=openOriginalFigmaFrame(root,frame);var patterns=root.querySelectorAll('pattern');if(!patterns.length)return frameOpened?new XMLSerializer().serializeToString(root):svg;
 function id(value){var nodes=root.querySelectorAll('[id]');for(var i=0;i<nodes.length;i++)if(nodes[i].getAttribute('id')===value)return nodes[i];return null;}
 function node(name){return doc.createElementNS(ns,name);}
 var defs=root.querySelector('defs');if(!defs){defs=node('defs');root.appendChild(defs);}
 try{
  mount=document.createElement('div');mount.style.cssText='position:fixed;left:-100000px;top:-100000px;visibility:hidden;pointer-events:none';document.body.appendChild(mount);mount.appendChild(root);
  var shapes=root.querySelectorAll('[fill]'),converted=0;
  for(var si=0;si<shapes.length;si++){
   var shape=shapes[si],match=/^url\(#([^)]*)\)$/.exec(shape.getAttribute('fill')||'');if(!match)continue;
   var pattern=id(match[1]);if(!pattern||pattern.localName!=='pattern')continue;
   var use=pattern.querySelector('use'),ref=use&&(use.getAttributeNS('http://www.w3.org/1999/xlink','href')||use.getAttribute('href')),source=ref&&id(ref.slice(1));
   if(pattern.getAttribute('patternContentUnits')!=='objectBoundingBox'||pattern.hasAttribute('patternTransform')||!source||source.localName!=='image')throw Error('Unsupported image pattern. Rasterize this object before sending to Illustrator.');
   var consolidated=use.transform.baseVal.consolidate(),matrix=consolidated&&consolidated.matrix;
   var m=matrix?[matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f]:[1,0,0,1,0,0],box=shape.getBBox();if(m.length!==6||m.some(function(v){return !isFinite(v);})||box.width<=0||box.height<=0)throw Error('Invalid image pattern bounds.');
   var ux=Number(use.getAttribute('x')||0),uy=Number(use.getAttribute('y')||0);m[4]+=m[0]*ux+m[2]*uy;m[5]+=m[1]*ux+m[3]*uy;
   var clipId='transferifyImageClip'+converted++;while(id(clipId))clipId+='x';
   var clip=node('clipPath'),outline=shape.cloneNode(true);clip.setAttribute('id',clipId);clip.setAttribute('clipPathUnits','userSpaceOnUse');['id','transform','fill','fill-opacity','stroke','stroke-width','opacity','clip-path','mask','filter','style'].forEach(function(a){outline.removeAttribute(a);});outline.setAttribute('fill','#000');clip.appendChild(outline);defs.appendChild(clip);
   var group=node('g');['id','transform','opacity','clip-path','mask','filter','style'].forEach(function(a){if(shape.hasAttribute(a))group.setAttribute(a,shape.getAttribute(a));});
   var image=source.cloneNode(true);image.removeAttribute('id');image.setAttribute('transform','matrix('+[box.width*m[0],box.height*m[1],box.width*m[2],box.height*m[3],box.x+box.width*m[4],box.y+box.height*m[5]].join(' ')+')');if(shape.hasAttribute('fill-opacity'))image.setAttribute('opacity',shape.getAttribute('fill-opacity'));var clipped=node('g');clipped.setAttribute('clip-path','url(#'+clipId+')');clipped.appendChild(image);group.appendChild(clipped);
   if(shape.hasAttribute('stroke')&&shape.getAttribute('stroke')!=='none'){var stroke=shape.cloneNode(true);['id','transform','opacity','clip-path','mask','filter','style'].forEach(function(a){stroke.removeAttribute(a);});stroke.setAttribute('fill','none');group.appendChild(stroke);}
   shape.parentNode.replaceChild(group,shape);
  }
  pruneUnusedIllustratorAssets(root,defs);
  return new XMLSerializer().serializeToString(root);
 }finally{if(mount&&mount.parentNode)mount.parentNode.removeChild(mount);}
}
