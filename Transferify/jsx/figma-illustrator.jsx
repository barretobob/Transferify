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
 var source=null,original=null,destinationLayer=null,created=[],unownedCopies=[],files=[],addedBoards=[],boardBefore=null,stage="start",oldInteraction=app.userInteractionLevel;
 try{
  app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS;
  if(!app.documents.length)throw Error('Open the destination Illustrator document first.');
  stage="destination";original=app.activeDocument;var ab=original.artboards[original.artboards.getActiveArtboardIndex()].artboardRect;destinationLayer=original.layers.add();destinationLayer.name='Transferify - Figma';destinationLayer.visible=true;destinationLayer.locked=false;original.activeLayer=destinationLayer;
  for(var i=0;i<pack.items.length;i++){
   var item=pack.items[i];if(item.frame&&item.frame.type=='FRAME'&&item.frame.nodeId){stage="Frame artboard";if(!boardBefore){var activeBoard=original.artboards.getActiveArtboardIndex();boardBefore={index:activeBoard,rect:original.artboards[activeBoard].artboardRect,name:original.artboards[activeBoard].name};}var frameRect=[ab[0]+item.x,ab[1]-item.y,ab[0]+item.x+item.frame.width,ab[1]-item.y-item.frame.height];if(i===0){original.artboards[original.artboards.getActiveArtboardIndex()].artboardRect=frameRect;original.artboards[original.artboards.getActiveArtboardIndex()].name=item.name;}else{var frameBoard=original.artboards.add(frameRect);addedBoards.push(frameBoard);frameBoard.name=item.name;}}var file=item.file?new File(item.file):new File(Folder.temp.fsName+'/transferify-figma-'+new Date().getTime()+'-'+i+'.svg');files.push(file);
   if(item.file){if(!file.exists)throw Error('SVG transport file is missing.');}else{file.encoding='UTF-8';if(!file.open('w'))throw Error('Cannot write SVG transport.');file.write(item.svg);file.close();}
   stage="open SVG";source=app.open(file);var rect=source.artboards[0].artboardRect,top=[];
   for(var j=0;j<source.pageItems.length;j++)if(source.pageItems[j].parent.typename=='Layer')top.push(source.pageItems[j]);
   var sourceLeft=Infinity,sourceTop=-Infinity;for(var bi=0;bi<top.length;bi++){var bb=top[bi].geometricBounds;sourceLeft=Math.min(sourceLeft,bb[0]);sourceTop=Math.max(sourceTop,bb[1]);}if(!top.length)throw Error("SVG has no drawable roots");stage="duplicate artwork";app.activeDocument=original;var targetLayer=destinationLayer,copies=[];
   for(var j=0;j<top.length;j++){var copy=top[j].duplicate(targetLayer,ElementPlacement.PLACEATEND);copies.push(copy);unownedCopies.push(copy);}
   stage="create group";var group=targetLayer.groupItems.add();group.name=item.name;created.push(group);
   for(var j=0;j<copies.length;j++)copies[j].move(group,ElementPlacement.PLACEATEND);
   stage="position artwork";var copiedBounds=group.geometricBounds;group.translate(sourceLeft+ab[0]+item.x-rect[0]-copiedBounds[0],sourceTop+ab[1]-item.y-rect[1]-copiedBounds[1]);
   if(item.frame&&item.frame.type=='FRAME'&&item.frame.nodeId){stage="clip overflowing objects";clipOverflow(group,frameRect);}
   app.activeDocument=source;source.close(SaveOptions.DONOTSAVECHANGES);source=null;app.activeDocument=original;
  }
  app.activeDocument=original;original.selection=null;for(var i=0;i<created.length;i++)created[i].selected=true;
  return 'FIGMA \u2192 AI \u2022 '+created.length+' selection roots imported as editable SVG artwork';
 }catch(e){for(var ai=addedBoards.length-1;ai>=0;ai--)try{addedBoards[ai].remove();}catch(_boardCleanup){}if(boardBefore)try{original.artboards[boardBefore.index].artboardRect=boardBefore.rect;original.artboards[boardBefore.index].name=boardBefore.name;}catch(_boardRestore){}for(var i=created.length-1;i>=0;i--)try{created[i].remove();}catch(_cleanup){}for(var i=unownedCopies.length-1;i>=0;i--)try{unownedCopies[i].remove();}catch(_copyCleanup){}if(destinationLayer)try{if(!destinationLayer.pageItems.length)destinationLayer.remove();}catch(_emptyLayer){}return 'ERROR: '+String(e)+' | stage '+stage+' | line '+e.line;}
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
 var original=null,temporary=null,file=null,stage="selection",oldInteraction=app.userInteractionLevel;
 try{
  app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS;
  if(!app.documents.length||!app.activeDocument.selection.length)throw Error('Select artwork in Illustrator first.');
  original=app.activeDocument;var selected=original.selection,roots=[],left=Infinity,top=-Infinity,right=-Infinity,bottom=Infinity;
  for(var i=0;i<selected.length;i++){
   var node=selected[i],ancestor=node.parent,skip=false;
   while(ancestor&&ancestor.typename!='Document'){for(var j=0;j<selected.length;j++)if(selected[j]==ancestor)skip=true;ancestor=ancestor.parent;}
   if(skip)continue;var bounds=node.visibleBounds;left=Math.min(left,bounds[0]);top=Math.max(top,bounds[1]);right=Math.max(right,bounds[2]);bottom=Math.min(bottom,bounds[3]);roots.push(node);
  }
  if(!roots.length||right<=left||top<=bottom)throw Error('Selection has no drawable bounds.');
  var width=right-left,height=top-bottom;if(width>16383||height>16383)throw Error('Selection is too large for this SVG transfer.');
  stage="sort artwork";var ordered=[];for(var pi=0;pi<original.pageItems.length;pi++){var candidate=original.pageItems[pi];for(var ri=0;ri<roots.length;ri++)if(candidate==roots[ri])ordered.push(roots[ri]);}for(var ri=0;ri<roots.length;ri++){var found=false;for(var oi=0;oi<ordered.length;oi++)if(ordered[oi]==roots[ri])found=true;if(!found)ordered.push(roots[ri]);}roots=ordered;
  stage="create temporary document";temporary=app.documents.add(DocumentColorSpace.RGB,width,height);
  stage="set export bounds";temporary.artboards[0].artboardRect=[left,top,right,bottom];
  // Document pageItems supplies paint order; zOrderPosition can throw on imported SVG groups.
  
  stage="copy artwork";var copiedLeft=Infinity,copiedTop=-Infinity;for(var i=0;i<roots.length;i++){var duplicate=roots[i].duplicate(temporary.activeLayer,ElementPlacement.PLACEATEND),copyBounds=duplicate.visibleBounds;copiedLeft=Math.min(copiedLeft,copyBounds[0]);copiedTop=Math.max(copiedTop,copyBounds[1]);}temporary.artboards[0].artboardRect=[copiedLeft,copiedTop,copiedLeft+width,copiedTop-height];
  var options=new ExportOptionsSVG();options.documentEncoding=SVGDocumentEncoding.UTF8;options.embedRasterImages=true;options.fontType=SVGFontType.OUTLINEFONT;options.coordinatePrecision=5;
  stage="export SVG";file=new File(outputSVGPath||Folder.temp.fsName+'/transferify-ai-'+new Date().getTime()+'.svg');temporary.exportFile(file,ExportType.SVG,options);
  stage="read SVG";var svg=null;if(!outputSVGPath){file.encoding='UTF-8';if(!file.open('r'))throw Error('Cannot read Illustrator SVG export.');svg=file.read();file.close();}
  return {name:roots.length==1?String(roots[0].name||'Illustrator selection'):'Illustrator selection',svg:svg,svgFile:outputSVGPath?file.fsName:null,width:width,height:height,warnings:['Illustrator text is outlined during SVG transfer to Figma. Inspect effects and clipping.']};
 }catch(e){throw Error('Illustrator SVG export failed at '+stage+': '+String(e)+' | line '+e.line);}finally{stage="restore source";if(original)try{app.activeDocument=original;}catch(_restore){}stage="close temporary";if(temporary)try{temporary.close(SaveOptions.DONOTSAVECHANGES);}catch(_close){}stage="cleanup SVG";if(file&&!outputSVGPath)try{file.remove();}catch(_remove){}app.userInteractionLevel=oldInteraction;}
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
