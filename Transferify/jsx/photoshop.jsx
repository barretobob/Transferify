/* Transferify 0.7 development: Photoshop -> AE and guide exchange.
   Loaded by host.jsx only when an action is requested; no startup activity. */
Transferify._psSnapshot=function(destination){
  var original=null,copy=null,file=null,ok=false;
  try{
    if(!app.documents.length)throw Error('Open a Photoshop document first.');
    original=app.activeDocument;
    var directory=new Folder(destination);if(!directory.exists&&!directory.create())throw Error('Cannot create image folder.');
    var name=String(original.name).replace(/\.[^.]+$/,'').replace(/[\\\/:*?"<>|]/g,'_');
    file=new File(directory.fsName+'/'+name+'_'+new Date().getTime()+'_'+Math.floor(Math.random()*100000)+'.psd');
    copy=original.duplicate('__Transferify_Snapshot__',false);
    var options=new PhotoshopSaveOptions();options.layers=true;options.embedColorProfile=true;options.alphaChannels=true;
    copy.saveAs(file,options,true,Extension.LOWERCASE);ok=true;
    return {name:name,path:file.fsName,width:Number(original.width.as('px')),height:Number(original.height.as('px'))};
  }finally{
    if(copy)try{copy.close(SaveOptions.DONOTSAVECHANGES);}catch(_close){}
    if(original)try{app.activeDocument=original;}catch(_restore){}
    if(!ok&&file&&file.exists)try{file.remove();}catch(_remove){}
  }
};
Transferify._psReadGuides=function(){
  if(!app.documents.length)throw Error('Open a Photoshop document first.');
  var guides=app.activeDocument.guides,out=[];
  for(var i=0;i<guides.length;i++)out.push([guides[i].direction==Direction.HORIZONTAL?0:1,Number(guides[i].coordinate.as('px'))]);
  return out;
};
Transferify._psWriteGuides=function(guides){
  if(!app.documents.length)throw Error('Open a Photoshop document first.');
  var doc=app.activeDocument,added=0;
  for(var i=0;i<guides.length;i++){
    var direction=guides[i][0]===0?Direction.HORIZONTAL:Direction.VERTICAL,position=Number(guides[i][1]),exists=false;
    if(!isFinite(position))throw Error('Invalid guide coordinate.');
    for(var j=0;j<doc.guides.length;j++)if(doc.guides[j].direction==direction&&Math.abs(doc.guides[j].coordinate.as('px')-position)<.5){exists=true;break;}
    if(!exists){doc.guides.add(direction,new UnitValue(position,'px'));added++;}
  }
  return {added:added};
};
Transferify._psRequest=function(operation,args,callback){
  try{
    var target=Transferify._bridgeTarget('photoshop');
    if(!BridgeTalk.isRunning(target))return 'Open Photoshop before using this action.';
    var bt=new BridgeTalk();bt.target=target;

    // Serialize without requiring JSON to exist in the Photoshop ExtendScript runtime.
    bt.body='(function(){try{var Transferify={_plainJSON:'+Transferify._plainJSON.toString()+'};return ('+Transferify._encodePayload.toString()+')(('+operation.toString()+').apply(null,'+Transferify._plainJSON(args||[])+'));}catch(e){return "ERROR: "+String(e);}})();';
    bt.body=Transferify._bridgeScript(bt.body);
    if(!Transferify._pendingBridge)Transferify._pendingBridge=[];Transferify._pendingBridge.push(bt);
    function release(){for(var i=Transferify._pendingBridge.length-1;i>=0;i--)if(Transferify._pendingBridge[i]===bt)Transferify._pendingBridge.splice(i,1);}
    Transferify._lastPSResult=null;
    bt.onResult=function(res){release();try{if(String(res.body).indexOf('ERROR:')===0)throw Error(res.body);var message=callback(Transferify._decodePayload(res.body));Transferify._lastPSResult={ok:true,message:typeof message=='string'?message:'PHOTOSHOP • completed'};}catch(e){Transferify._lastPSResult={ok:false,message:String(e)};}};
    bt.onError=function(res){release();Transferify._lastPSResult={ok:false,message:String(res.body)};};
    bt.onTimeout=function(){release();Transferify._lastPSResult={ok:false,message:'Photoshop did not respond. Check before retrying.'};};
    if(!bt.send()){release();return 'ERROR: Photoshop request could not be sent.';}
    return 'PHOTOSHOP • request sent';
  }catch(e){return 'ERROR: '+String(e);}
};
Transferify._transferFolder=function(){
  var target=null;
  for(var i=1;i<=app.project.numItems;i++){var item=app.project.item(i);if(item instanceof FolderItem&&item.name=='TRANSFER'&&(!target||(target.parentFolder==app.project.rootFolder&&item.parentFolder!=app.project.rootFolder)))target=item;}
  return target||app.project.items.addFolder('TRANSFER');
};
Transferify._receivePS=function(snapshot,compID){
  var comp=null,began=false,known={},copied=[],imported=null;
  try{
    for(var i=1;i<=app.project.numItems;i++){var item=app.project.item(i);known[item.id]=true;if(item.id==compID&&item instanceof CompItem)comp=item;}
    if(!comp)throw Error('The target composition was closed.');
    var file=new File(snapshot.path);if(!file.exists)throw Error('Photoshop snapshot is missing.');
    var options=new ImportOptions(file);if(!options.canImportAs(ImportAsType.COMP_CROPPED_LAYERS))throw Error('This Photoshop document cannot be imported as layers.');options.importAs=ImportAsType.COMP_CROPPED_LAYERS;
    app.beginUndoGroup('Transferify Photoshop to After');began=true;
    imported=app.project.importFile(options);if(!(imported instanceof CompItem))throw Error('Photoshop import did not produce a composition.');
    var folder=Transferify._transferFolder();
    for(var i=1;i<=app.project.numItems;i++){var item=app.project.item(i);if(!known[item.id]&&item!=folder){var solid=false;try{solid=item instanceof FootageItem&&item.mainSource instanceof SolidSource;}catch(_solid){}if(!solid&&!(item instanceof FolderItem))item.parentFolder=folder;}}
    // Capture IDs because copies change the indices of every destination layer.
    var sourceOrder=[];for(var i=1;i<=imported.numLayers;i++){sourceOrder.push(String(imported.layer(i).name));var ids={};for(var j=1;j<=comp.numLayers;j++)ids[comp.layer(j).id]=true;imported.layer(i).copyToComp(comp);for(var j=1;j<=comp.numLayers;j++)if(!ids[comp.layer(j).id]){copied.push(comp.layer(j).id);break;}}for(var i=copied.length-1;i>=0;i--){for(var j=1;j<=comp.numLayers;j++)if(comp.layer(j).id==copied[i]){var layer=comp.layer(j),locked=layer.locked;layer.locked=false;try{layer.moveToBeginning();}finally{layer.locked=locked;}break;}}Transferify._lastPSLayerOrder=sourceOrder;
    if(!imported.usedIn.length)imported.remove();
    for(var i=app.project.numItems;i>=1;i--){var item=app.project.item(i);if(!known[item.id]&&item instanceof FolderItem&&item!=folder&&item.name!='Solids'&&!item.numItems)item.remove();}
    return 'PHOTOSHOP → AE • '+copied.length+' layers. Native PSD conversion; inspect appearance.';
  }finally{if(began)app.endUndoGroup();}
};
Transferify.pushFromPS=function(destination){
  if(Transferify._host()!='ae')return 'After Effects only';
  var comp=Transferify._aeComp();if(!comp)return 'Open the target composition first.';
  var folder;try{folder=Transferify._imageFolder(destination).fsName;}catch(error){return 'ERROR: '+String(error);}
  var compID=comp.id;
  return Transferify._psRequest(Transferify._psSnapshot,[folder],function(snapshot){return Transferify._receivePS(snapshot,compID);});
};
Transferify.importGuidesFromPS=function(){
  var comp=Transferify._aeComp();if(!comp)return 'Open the target composition first.';var compID=comp.id;
  return Transferify._psRequest(Transferify._psReadGuides,[],function(guides){var target=null;for(var i=1;i<=app.project.numItems;i++)if(app.project.item(i).id==compID)target=app.project.item(i);if(!target)throw Error('Target composition was closed.');app.beginUndoGroup('Transferify Guides PS to AE');try{Transferify._addAEGuides(target,guides);return 'PHOTOSHOP → AE • guides imported';}finally{app.endUndoGroup();}});
};
Transferify.pushGuidesToPS=function(){var comp=Transferify._aeComp();if(!comp)return 'Open the source composition first.';return Transferify._psRequest(Transferify._psWriteGuides,[Transferify._readAEGuides(comp)],function(result){return 'PHOTOSHOP • '+result.added+' guides added';});};
