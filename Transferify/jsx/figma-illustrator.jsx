/* SVG transport for Figma <-> Illustrator. Development, no startup actions. */
Transferify._receiveFigmaSVG=function(pack){
 // Selective clipping is local to this import and uses the metadata-confirmed Frame artboard.
 function directChildren(parent){var out=[];for(var ci=0;ci<parent.pageItems.length;ci++){var child=parent.pageItems[ci];if(child.parent==parent)out.push(child);}return out;}
 function effectiveBounds(item){
  if(item.typename!='GroupItem')return item.visibleBounds;
  var children=directChildren(item),bounds=null,clip=null;
  for(var ci=0;ci<children.length;ci++){
   var child=children[ci],isClip=child.typename=='PathItem'&&child.clipping;
   if(child.typename=='CompoundPathItem'&&child.pathItems.length)isClip=child.pathItems[0].clipping;
   if(item.clipped&&isClip){clip=child.geometricBounds;continue;}
   var b=effectiveBounds(child);if(!b)continue;
   if(!bounds)bounds=[b[0],b[1],b[2],b[3]];else{bounds[0]=Math.min(bounds[0],b[0]);bounds[1]=Math.max(bounds[1],b[1]);bounds[2]=Math.max(bounds[2],b[2]);bounds[3]=Math.min(bounds[3],b[3]);}
  }
  if(item.clipped&&clip&&bounds){bounds=[Math.max(bounds[0],clip[0]),Math.min(bounds[1],clip[1]),Math.min(bounds[2],clip[2]),Math.max(bounds[3],clip[3])];if(bounds[0]>=bounds[2]||bounds[1]<=bounds[3])return null;}
  // Unknown clipping structures stay atomic, retaining their original appearance.
  return item.clipped&&!clip?item.visibleBounds:bounds;
 }
 function clipOverflow(item,frame){
  var bounds=effectiveBounds(item),epsilon=0.01;if(!bounds)return;
  if(bounds[0]>=frame[0]-epsilon&&bounds[1]<=frame[1]+epsilon&&bounds[2]<=frame[2]+epsilon&&bounds[3]>=frame[3]-epsilon)return;
  if(item.typename=='GroupItem'&&!item.clipped){var children=directChildren(item);for(var ci=0;ci<children.length;ci++)clipOverflow(children[ci],frame);return;}
  var parent=item.parent,wrapper=parent.groupItems.add();wrapper.name=item.name||'Frame clip';wrapper.move(item,ElementPlacement.PLACEBEFORE);item.move(wrapper,ElementPlacement.PLACEATEND);
  var mask=wrapper.pathItems.rectangle(frame[1],frame[0],frame[2]-frame[0],frame[1]-frame[3]);mask.name='Frame bounds';mask.filled=false;mask.stroked=false;mask.clipping=true;mask.move(wrapper,ElementPlacement.PLACEATBEGINNING);wrapper.clipped=true;
 }
 function simplifyGroups(item,keep,insideGroup){
  if(item.typename!='GroupItem'||item.clipped)return [item];
  var sourceName=keep[item.name],hasSourceName=typeof sourceName=='string',appearance=false;
  try{appearance=Number(item.opacity)!=100||item.blendingMode!=BlendModes.NORMAL;}catch(_appearance){appearance=true;}
  var preserve=appearance||hasSourceName&&!insideGroup,children=directChildren(item);
  for(var gi=0;gi<children.length;gi++)simplifyGroups(children[gi],keep,insideGroup||preserve);
  if(preserve){if(hasSourceName)item.name=sourceName;return [item];}
  var released=directChildren(item);for(var gi=0;gi<released.length;gi++)released[gi].move(item,ElementPlacement.PLACEBEFORE);item.remove();return released;
 }
 function nextBoardRect(rects,width,height,gap,wrap){
  var left=Infinity,rowTop=Infinity,bottom=Infinity,right=-Infinity;
  for(var bi=0;bi<rects.length;bi++){var r=rects[bi];left=Math.min(left,r[0]);rowTop=Math.min(rowTop,r[1]);bottom=Math.min(bottom,r[3]);}
  for(var bi=0;bi<rects.length;bi++)if(Math.abs(rects[bi][1]-rowTop)<1)right=Math.max(right,rects[bi][2]);
  if(wrap)return [left,bottom-gap,left+width,bottom-gap-height];
  var x=right+gap,y=rowTop,changed=true;
  while(changed){changed=false;for(var bi=0;bi<rects.length;bi++){var r=rects[bi];if(x<r[2]+gap&&x+width>r[0]-gap&&y>r[3]-gap&&y-height<r[1]+gap){x=r[2]+gap;changed=true;}}}
  return [x,y,x+width,y-height];
 }
 function findOrigin(item,id){if(item.typename=='PathItem'&&item.name==id)return item;if(item.typename=='GroupItem'){var children=directChildren(item);for(var oi=0;oi<children.length;oi++){var found=findOrigin(children[oi],id);if(found)return found;}}return null;}
 function ensureOrigin(file,item){
  if(item.originId)return;
  file.encoding='UTF-8';if(!file.open('r'))throw Error('Cannot read SVG transport.');var svg=file.read();file.close();var root=/<svg\b[^>]*>/i.exec(svg);if(!root)throw Error('Invalid SVG root');var view=/\bviewBox\s*=\s*(["'])(.*?)\1/.exec(root[0]),x=0,y=0;if(view){var box=view[2].split(/[\s,]+/);x=Number(box[0]);y=Number(box[1]);if(!isFinite(x)||!isFinite(y))throw Error('Invalid SVG origin');}item.originId='TFORIGIN'+new Date().getTime()+Math.floor(Math.random()*100000);svg=svg.replace(/<\/svg\s*>\s*$/i,'<rect id="'+item.originId+'" x="'+x+'" y="'+y+'" width="1" height="1" fill="#000" stroke="none"/></svg>');if(!file.open('w'))throw Error('Cannot prepare SVG origin.');file.write(svg);file.close();
 }
 var source=null,original=null,destinationLayer=null,created=[],unownedCopies=[],files=[],addedBoards=[],boardBefore=null,selectedItems=[],reuseFirst=false,stage="start",oldInteraction=app.userInteractionLevel;
 try{
  app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS;
  if(!app.documents.length)throw Error('Open the destination Illustrator document first.');
  stage="destination";original=app.activeDocument;reuseFirst=original.pageItems.length===0&&original.artboards.length===1;var ab=original.artboards[original.artboards.getActiveArtboardIndex()].artboardRect;destinationLayer=original.layers.add();destinationLayer.name='Transferify - Figma';destinationLayer.visible=true;destinationLayer.opacity=0;destinationLayer.locked=false;original.activeLayer=destinationLayer;
  for(var i=0;i<pack.items.length;i++){
   var item=pack.items[i],targetX=ab[0]+item.x,targetY=ab[1]-item.y,frameRect=null,frameIndex=-1;
   if(item.frame&&item.frame.type=='FRAME'&&item.frame.nodeId){
    stage="Frame artboard";
    if(reuseFirst){frameIndex=original.artboards.getActiveArtboardIndex();var board=original.artboards[frameIndex];boardBefore={index:frameIndex,rect:board.artboardRect,name:board.name};frameRect=[ab[0],ab[1],ab[0]+item.frame.width,ab[1]-item.frame.height];board.artboardRect=frameRect;board.name=item.name;reuseFirst=false;}
    else{var rects=[];for(var bi=0;bi<original.artboards.length;bi++)rects.push(original.artboards[bi].artboardRect);var gap=150;frameRect=nextBoardRect(rects,item.frame.width,item.frame.height,gap,false);var frameBoard;
     try{frameBoard=original.artboards.add(frameRect);}catch(_rightLimit){frameRect=nextBoardRect(rects,item.frame.width,item.frame.height,gap,true);frameBoard=original.artboards.add(frameRect);}
     addedBoards.push(frameBoard);frameBoard.name=item.name;frameIndex=original.artboards.length-1;
    }
    targetX=frameRect[0];targetY=frameRect[1];
   }
   var file=item.file?new File(item.file):new File(Folder.temp.fsName+'/transferify-figma-'+new Date().getTime()+'-'+i+'.svg');files.push(file);
   if(item.file){if(!file.exists)throw Error('SVG transport file is missing.');}else{file.encoding='UTF-8';if(!file.open('w'))throw Error('Cannot write SVG transport.');file.write(item.svg);file.close();}
   stage="import SVG in place";ensureOrigin(file,item);var group=destinationLayer.groupItems.createFromFile(file);created.push(group);group.name=item.name;
   var anchor=findOrigin(group,item.originId);if(!anchor)throw Error('SVG origin marker is missing.');var origin=anchor.geometricBounds,unitX=origin[2]-origin[0],unitY=origin[1]-origin[3];if(unitX<=0||unitY<=0)throw Error('Invalid SVG scale');if(Math.abs(unitX-1)>0.0001||Math.abs(unitY-1)>0.0001){group.resize(100/unitX,100/unitY,true,true,true,true,100/unitX,Transformation.TOPLEFT);origin=anchor.geometricBounds;}var dx=targetX-origin[0],dy=targetY-origin[1];anchor.remove();group.translate(dx,dy);
   if(item.frame&&item.frame.type=='FRAME'&&item.frame.nodeId){stage="clip overflowing objects";clipOverflow(group,frameRect);}
   stage="remove transport groups";var keep={};for(var ki=0;ki<(item.groups||[]).length;ki++){var meta=item.groups[ki];keep[meta.token]=meta.name;keep[meta.token.replace(/_/g,' ')]=meta.name;}var released=simplifyGroups(group,keep,false);for(var si=0;si<released.length;si++)selectedItems.push(released[si]);

  }
  app.activeDocument=original;destinationLayer.opacity=100;original.selection=null;for(var i=0;i<selectedItems.length;i++)selectedItems[i].selected=true;
  return 'FIGMA \u2192 AI \u2022 '+pack.items.length+' selection roots imported as editable SVG artwork';
 }catch(e){for(var ai=addedBoards.length-1;ai>=0;ai--)try{addedBoards[ai].remove();}catch(_boardCleanup){}if(boardBefore)try{original.artboards[boardBefore.index].artboardRect=boardBefore.rect;original.artboards[boardBefore.index].name=boardBefore.name;}catch(_boardRestore){}for(var i=created.length-1;i>=0;i--)try{created[i].remove();}catch(_cleanup){}for(var i=unownedCopies.length-1;i>=0;i--)try{unownedCopies[i].remove();}catch(_copyCleanup){}if(destinationLayer)try{destinationLayer.remove();}catch(_emptyLayer){}return 'ERROR: '+String(e)+' | stage '+stage+' | line '+e.line;}
 finally{if(source)try{source.close(SaveOptions.DONOTSAVECHANGES);}catch(_close){}if(original)try{app.activeDocument=original;}catch(_restore){}for(var i=0;i<files.length;i++)try{files[i].remove();}catch(_remove){}app.userInteractionLevel=oldInteraction;}
};
Transferify.sendFigmaSVGToAI=function(raw){
 try{
  var pack=Transferify._parsePanelSettings(raw),target=Transferify._bridgeTarget('illustrator');
  if(!BridgeTalk.isRunning(target))return 'ERROR: Open Illustrator and a destination document first.';
  var transport=new File(Folder.temp.fsName+'/transferify-figma-payload-'+new Date().getTime()+'-'+Math.floor(Math.random()*1000000)+'.txt');
  transport.encoding='UTF-8';if(!transport.open('w'))return 'ERROR: Cannot write Illustrator transport.';transport.write(Transferify._encodePayload(pack));transport.close();
  var bt=new BridgeTalk();bt.target=target;
  bt.body='(function(){var payloadFile=new File('+Transferify._quote(transport.fsName)+');try{payloadFile.encoding="UTF-8";if(!payloadFile.open("r"))throw Error("Cannot read Illustrator transport.");var payload=payloadFile.read();payloadFile.close();return ('+Transferify._receiveFigmaSVG.toString()+')(('+Transferify._decodePayload.toString()+')(payload));}finally{try{payloadFile.remove();}catch(_cleanup){}}})();';
  bt.body=Transferify._bridgeScript(bt.body);
  if(!Transferify._pendingBridge)Transferify._pendingBridge=[];Transferify._pendingBridge.push(bt);
  function release(){try{transport.remove();}catch(_transportCleanup){}for(var i=Transferify._pendingBridge.length-1;i>=0;i--)if(Transferify._pendingBridge[i]===bt)Transferify._pendingBridge.splice(i,1);}
  bt.onResult=function(r){release();Transferify._lastFigmaAIResult={ok:String(r.body).indexOf('ERROR:')!==0,message:String(r.body)};};
  bt.onError=function(r){release();Transferify._lastFigmaAIResult={ok:false,message:String(r.body)};};
  Transferify._lastFigmaAIResult=null;
  if(bt.send())return 'PENDING';release();return 'ERROR: Illustrator request failed.';
 }catch(e){return 'ERROR: '+String(e);}
};
Transferify._exportAISVG=function(outputSVGPath){
 var original=null,asset=null,folder=null,output=null,selection=[],stage="selection",oldInteraction=app.userInteractionLevel;
 function clean(dir){if(!dir||!dir.exists)return;var entries=dir.getFiles();for(var i=0;i<entries.length;i++){if(entries[i] instanceof Folder)clean(entries[i]);else entries[i].remove();}dir.remove();}
 function svgFiles(dir,out){var entries=dir.getFiles();for(var i=0;i<entries.length;i++){if(entries[i] instanceof Folder)svgFiles(entries[i],out);else if(/\.svg$/i.test(entries[i].name))out.push(entries[i]);}}
 try{
  app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS;
  if(!app.documents.length||!app.activeDocument.selection.length)throw Error('Select artwork in Illustrator first.');
  original=app.activeDocument;var selected=original.selection,roots=[],left=Infinity,top=-Infinity,right=-Infinity,bottom=Infinity;
  for(var i=0;i<selected.length;i++)selection.push(selected[i]);
  for(var i=0;i<selection.length;i++){var node=selection[i],ancestor=node.parent,skip=false;while(ancestor&&ancestor.typename!='Document'){for(var j=0;j<selection.length;j++)if(selection[j]==ancestor)skip=true;ancestor=ancestor.parent;}if(skip)continue;var bounds=node.visibleBounds;left=Math.min(left,bounds[0]);top=Math.max(top,bounds[1]);right=Math.max(right,bounds[2]);bottom=Math.min(bottom,bounds[3]);roots.push(node);}
  if(!roots.length||right<=left||top<=bottom)throw Error('Selection has no drawable bounds.');
  stage="selection asset";original.selection=null;for(var i=0;i<roots.length;i++)roots[i].selected=true;asset=original.assets.addFromSelection();asset.assetName='TransferifyExport';
  folder=new Folder(Folder.temp.fsName+'/transferify-export-'+new Date().getTime()+'-'+Math.floor(Math.random()*1000000));if(!folder.create())throw Error('Cannot create export folder.');
  stage="export SVG";var options=new ExportForScreensOptionsWebOptimizedSVG();options.fontType=SVGFontType.OUTLINEFONT;options.coordinatePrecision=5;options.cssProperties=SVGCSSPropertyLocation.PRESENTATIONATTRIBUTES;options.rasterImageLocation=RasterImageLocation.EMBED;options.svgResponsive=false;options.svgMinify=false;var scope=new ExportForScreensItemToExport();scope.artboards='';scope.assets=[asset.assetID];scope.document=false;original.exportForScreens(new File(folder.fsName),ExportForScreensType.SE_SVG,options,scope);
  var found=[];svgFiles(folder,found);if(found.length!=1)throw Error('Illustrator did not produce a unique SVG export.');
  var svg=null;if(outputSVGPath){output=new File(outputSVGPath);if(!found[0].copy(output.fsName))throw Error('Cannot copy SVG export.');}else{found[0].encoding='UTF-8';if(!found[0].open('r'))throw Error('Cannot read SVG export.');svg=found[0].read();found[0].close();}
  return {name:roots.length==1?String(roots[0].name||original.name.replace(/\.ai$/i,'')):String(original.name.replace(/\.ai$/i,'')),svg:svg,svgFile:output?output.fsName:null,width:right-left,height:top-bottom,warnings:['Textos do Illustrator s\u00e3o enviados como contornos edit\u00e1veis.']};
 }catch(e){if(output)try{output.remove();}catch(_){}throw Error('Illustrator SVG export failed at '+stage+': '+String(e)+' | line '+e.line);}
 finally{if(original){if(asset)try{original.assets.remove(asset.assetID);}catch(_){}try{original.selection=null;for(var i=0;i<selection.length;i++)selection[i].selected=true;}catch(_){}}try{clean(folder);}catch(_){}app.userInteractionLevel=oldInteraction;}
};
Transferify.requestAISVG=function(){
 try{
  var target=Transferify._bridgeTarget('illustrator');if(!BridgeTalk.isRunning(target))return 'ERROR: Open Illustrator first.';
  var bt=new BridgeTalk();bt.target=target;bt.body='(function(){try{var Transferify={_plainJSON:'+Transferify._plainJSON.toString()+'};return ('+Transferify._encodePayload.toString()+')(('+Transferify._exportAISVG.toString()+')());}catch(e){return "ERROR: "+String(e);}})();';
  bt.body=Transferify._bridgeScript(bt.body);
  if(!Transferify._pendingBridge)Transferify._pendingBridge=[];Transferify._pendingBridge.push(bt);
  function release(){for(var i=Transferify._pendingBridge.length-1;i>=0;i--)if(Transferify._pendingBridge[i]===bt)Transferify._pendingBridge.splice(i,1);}
  Transferify._lastAISVGResult=null;
  bt.onResult=function(r){release();try{if(String(r.body).indexOf('ERROR:')===0)throw Error(r.body);Transferify._lastAISVGResult={ok:true,data:Transferify._decodePayload(r.body)};}catch(e){Transferify._lastAISVGResult={ok:false,message:String(e)};}};
  bt.onError=function(r){release();Transferify._lastAISVGResult={ok:false,message:String(r.body)};};
  return bt.send()?'PENDING':'ERROR: Illustrator request failed.';
 }catch(e){return 'ERROR: '+String(e);}
};

// Direct entry points: called by this Illustrator panel's local receiver.
Transferify.importFigmaSVGFile=function(filePath){
 try{
  if(Transferify._host()!='ai')throw Error('Abra o painel Transferify no Illustrator.');
  var file=new File(filePath);file.encoding='BINARY';if(!file.open('r'))throw Error('Não foi possível ler o pacote do Figma.');var raw;try{raw=file.read();}finally{file.close();}
  var result=Transferify._receiveFigmaSVG(Transferify._decodePayload(raw));
  return Transferify._plainJSON({ok:String(result).indexOf('ERROR:')!==0,message:String(result)});
 }catch(error){return Transferify._plainJSON({ok:false,message:String(error)});}
};
Transferify.exportAISVGFile=function(filePath){
 var file=null;
 try{
  if(Transferify._host()!='ai')throw Error('Abra o painel Transferify no Illustrator.');
  var data=Transferify._exportAISVG(filePath+'.svg');file=new File(filePath);file.encoding='UTF-8';if(!file.open('w'))throw Error('Não foi possível gravar a exportação do Illustrator.');try{file.write(Transferify._plainJSON(data));}finally{file.close();}return 'OK';
 }catch(error){if(file)try{file.remove();}catch(_){}return 'ERROR: '+String(error);}
};
