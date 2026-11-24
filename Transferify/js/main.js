(function(){
  var cs=new CSInterface();
  function $(id){return document.getElementById(id);}
  function rawHost(){try{return String(cs.getHostEnvironment().appName||"").toLowerCase();}catch(e){return "";}}
  function host(){var h=rawHost();return (h.indexOf("illustrator")>=0||h==="ilst")?"ai":"ae";}
  function status(t){$("status").textContent=t;}
  function esc(s){return String(s).replace(/\\/g,"\\\\").replace(/"/g,'\\"');}
  var busy=false,hostReady=false;
  function setBusy(v,msg){
    busy=v;$("progressWrap").style.display=v?"block":"none";
    var bs=document.querySelectorAll("button");for(var i=0;i<bs.length;i++)bs[i].disabled=v;
    if(msg)status(msg);
  }
  function run(fn,args,cb){
    if(busy||!hostReady)return;
    var a=args||[],parts=[];
    for(var i=0;i<a.length;i++)parts.push('"'+esc(a[i])+'"');
    setBusy(true,"WORKING • "+fn);
    var freshHost=cs.getSystemPath(SystemPath.EXTENSION)+'/jsx/host.jsx';
    var reloadHost='$.evalFile(new File('+JSON.stringify(freshHost)+'));';
    cs.evalScript(reloadHost+"Transferify."+fn+"("+parts.join(",")+")",function(r){
      setBusy(false);status(r||"DONE");if(cb)cb(r);
    });
  }
  function runPS(fn,args){run(fn,args,function(message){if(message!=='PHOTOSHOP • request sent')return;setBusy(true,'WAITING FOR PHOTOSHOP…');var began=Date.now();function poll(){cs.evalScript('Transferify._lastPSResult?Transferify._plainJSON(Transferify._lastPSResult):"PENDING"',function(value){if(value==='PENDING'&&Date.now()-began<90000){setTimeout(poll,200);return;}setBusy(false);try{var result=JSON.parse(value);status(result.message);}catch(e){status('Photoshop did not finish in time. Check the destination before retrying.');}});}poll();});}
  function shadowScan(){return "true";}
  function customFolder(){return localStorage.getItem("transferify.qa.imageFolderMode")==="manual"?(localStorage.getItem("transferify.qa.imageFolder")||""):"";}
  function refreshFolder(){
    var f=customFolder();
    $("folder").textContent=$("folderAe").textContent=f||"AUTO · projeto/IMAGENS/";
    $("folder").title=$("folderAe").title=f||"Automático: IMAGENS do projeto. Dentro de AEP, usa a pasta IMAGENS ao lado de AEP. Clique na pasta para escolher outro destino.";
  }

  var h=host();
  document.body.className=h==="ai"?"host-ai":"host-ae";
  $("hostLabel").textContent=h==="ai"?"ILLUSTRATOR":"AFTER EFFECTS";

  $("chooseAe").onclick=$("choose").onclick=function(){
    run("chooseFolder",[],function(r){
      if(r&&r!=="CANCEL"&&r.indexOf("ERROR")!==0){
        localStorage.setItem("transferify.qa.imageFolderMode","manual");localStorage.setItem("transferify.qa.imageFolder",r);refreshFolder();syncOptions();
      }
    });
  };

  if($('pushFromPS'))$('pushFromPS').onclick=function(){runPS('pushFromPS',[customFolder()]);};
  if($('importGuidesPS'))$('importGuidesPS').onclick=function(){runPS('importGuidesFromPS',[]);};
  if($('pushGuidesPS'))$('pushGuidesPS').onclick=function(){runPS('pushGuidesToPS',[]);};
  if($("sendAE"))$("sendAE").onclick=function(){run("sendToAE",["",shadowScan()]);};
  if($("pushFromAE"))$("pushFromAE").onclick=function(){run("pushFromAE",[]);};
  if($("sendAI"))$("sendAI").onclick=function(){run("sendToAI",[]);};
  if($("pushFromAI"))$("pushFromAI").onclick=function(){run("pushFromAI",[customFolder(),shadowScan()]);};
  if($("createComp"))$("createComp").onclick=function(){run("createCompFromArtboard",[]);};
  if($("importGuidesAI"))$("importGuidesAI").onclick=function(){run("importGuidesFromAE",[]);};
  if($("pushGuidesAE"))$("pushGuidesAE").onclick=function(){run("pushGuidesToAE",[]);};
  if($("createArtboard"))$("createArtboard").onclick=function(){run("createArtboardFromComp",[]);};
  if($("importGuides"))$("importGuides").onclick=function(){run("importGuidesFromAI",[]);};
  if($("pushGuidesAI"))$("pushGuidesAI").onclick=function(){run("pushGuidesToAI",[]);};
  $('precomp').onclick=function(){run('precompSelected',[]);};
  $('toggleGuides').onclick=function(){run('toggleGuideLayers',[]);};
  $('removeControls').onclick=function(){run('removeGroupControls',[]);};
  if($("decomp"))$("decomp").onclick=function(){run("decomp",[]);};
  if($("split"))$("split").onclick=function(){run("splitLayers",[]);};
  if($("join"))$("join").onclick=function(){run("joinLayers",[]);};
  if($("removeArtboard"))$("removeArtboard").onclick=function(){run("removeArtboard",[]);};


  var figmaMode=localStorage.getItem('transferify.qa.figma.mode')||'new';
  function saveFigmaMode(mode){figmaMode=mode;localStorage.setItem('transferify.qa.figma.mode',mode);$('figmaNew').className=mode==='new'?'active':'';$('figmaCurrent').className=mode==='current'?'active':'';$('figmaFps').disabled=$('figmaDuration').disabled=false;}
  $('figmaNew').onclick=function(){saveFigmaMode('new');syncOptions();status('Next import → NEW COMP');};
  $('figmaCurrent').onclick=function(){saveFigmaMode('current');syncOptions();status('Next import → CURRENT COMP');};
  saveFigmaMode(figmaMode);

  var optionIds=['compBackground','figmaScale','figmaFps','figmaDuration','figmaParametric','figmaMatchAlpha'];
  optionIds.forEach(function(id){var e=$(id),saved=localStorage.getItem('transferify.qa.'+id);if(saved!==null){if(e.type==='checkbox')e.checked=saved==='true';else e.value=saved;}e.onchange=function(){localStorage.setItem('transferify.qa.'+id,e.type==='checkbox'?String(e.checked):e.value);syncOptions();};});
  $('resetFolderAe').onclick=$('resetFolder').onclick=function(){localStorage.setItem('transferify.qa.imageFolderMode','auto');localStorage.removeItem('transferify.qa.imageFolder');refreshFolder();syncOptions();};
  function figmaOptions(){var hex=$('compBackground').value;return {background:[parseInt(hex.substr(1,2),16)/255,parseInt(hex.substr(3,2),16)/255,parseInt(hex.substr(5,2),16)/255],mode:figmaMode,multiplier:Number($('figmaScale').value),fps:Number($('figmaFps').value),duration:Number($('figmaDuration').value),parametric:$('figmaParametric').checked,precompGroups:false};}
  function syncOptions(cb){if(h!=='ae'){if(cb)cb();return;}var o=figmaOptions();o.imageFolder=customFolder();o.matchFigmaAlpha=$('figmaMatchAlpha').checked;cs.evalScript('Transferify.setImportOptions('+JSON.stringify(JSON.stringify(o))+')',function(r){if(r&&r.indexOf('ERROR')===0)status(r);if(cb)cb(r);});}
  function paintBackground(){var value=$('compBackground').value||'#000000';$('compBackground').style.backgroundColor=value;}
  paintBackground();
  $('compBackground').onclick=function(){var button=this,old=button.value||'#000000';run('chooseBackgroundColor',[old],function(result){if(/^#[0-9a-fA-F]{6}$/.test(result||'')){button.value=result;localStorage.setItem('transferify.qa.compBackground',result);paintBackground();syncOptions();}});};
  $('pushFromFigma').onclick=function(){if(!figmaServer){status('Open the Figma plugin and wait for the connection.');return;}var result=figmaServer.requestPull(figmaMode);status(result.message);};
  $('applyComp').onclick=function(){var o=figmaOptions();run('applyCompSettings',[JSON.stringify(o)]);};
  var figmaServer=null;
  function startReceiver(){
    if(figmaServer)return;
    try{var nodeRequire=typeof require==='function'?require:window.cep_node.require,root=cs.getSystemPath(SystemPath.EXTENSION),bridgePath=root+'/js/figma-bridge.js';if(nodeRequire.cache&&nodeRequire.resolve){delete nodeRequire.cache[nodeRequire.resolve(bridgePath)];delete nodeRequire.cache[nodeRequire.resolve(root+'/js/figma-normalize.js')];}var bridge=nodeRequire(bridgePath);
      function loadNative(script,callback){cs.evalScript('$.evalFile(new File('+JSON.stringify(root+'/jsx/host.jsx')+'));'+script,callback);}
      function waitNativeResult(key,callback){var start=Date.now();function poll(){cs.evalScript('Transferify.'+key+'?Transferify._plainJSON(Transferify.'+key+'):"PENDING"',function(value){if(value==='PENDING'&&Date.now()-start<90000){setTimeout(poll,200);return;}try{callback(JSON.parse(value));}catch(e){callback({ok:false,message:'Destination timed out. Check the destination before retrying.'});}});}poll();}
      figmaServer=bridge.start({assetDir:root+'/assets',update:updateTransferify,exportIllustrator:function(done){setBusy(true,'EXPORTING FROM ILLUSTRATOR…');loadNative('Transferify.requestAISVG()',function(result){if(result!=='PENDING'){setBusy(false);return done({ok:false,message:result});}waitNativeResult('_lastAISVGResult',function(result){setBusy(false);status(result.ok?'ILLUSTRATOR → FIGMA • selection exported':result.message||'Illustrator export failed');done(result);});});},activate:function(done){cs.evalScript('(function(){try{BridgeTalk.bringToFront(BridgeTalk.appName);return "OK";}catch(e){return "ERROR: "+String(e);}})()',function(r){done(r==='OK'?null:r||'After did not respond');});},isBusy:function(){return busy;},importer:function(data,done){
        if(data.protocol==='transferify-figma-svg'){setBusy(true,'SENDING TO ILLUSTRATOR…');loadNative('Transferify.sendFigmaSVGToAI('+JSON.stringify(JSON.stringify(data))+')',function(result){if(result!=='PENDING'){setBusy(false);return done({ok:false,message:result});}waitNativeResult('_lastFigmaAIResult',function(result){setBusy(false);status(result.message);done(result);});});return;}
        var requestedMode=data.compMode,precompGroups=data.precompGroups===true;data.importOptions=figmaOptions();data.importOptions.precompGroups=precompGroups;if(requestedMode==='new'||requestedMode==='current')data.importOptions.mode=requestedMode;data.matchFigmaAlpha=$('figmaMatchAlpha').checked;setBusy(true,'IMPORTING FROM FIGMA…');
        var fs=nodeRequire('fs'),path=nodeRequire('path'),os=nodeRequire('os'),tempDir=null;
        function finish(result){setBusy(false);if(tempDir)try{fs.rmSync(tempDir,{recursive:true,force:true});}catch(ignore){}status(result.message+(result.warnings&&result.warnings.length?' • '+result.warnings.join(' | '):''));done(result);}
        try{
          tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'transferify-command-'));
          var payloadFile=path.join(tempDir,'payload.hex'),raw=JSON.stringify(data),chunks=[];
          for(var offset=0;offset<raw.length;offset+=8192){var hex='';for(var i=offset;i<Math.min(offset+8192,raw.length);i++)hex+=('0000'+raw.charCodeAt(i).toString(16)).slice(-4);chunks.push(hex);}
          fs.writeFileSync(payloadFile,chunks.join(''),'ascii');
          var command='(function(){var stage="load-host";try{$.evalFile(new File('+JSON.stringify(root+'/jsx/host.jsx')+'));stage="read-package";var f=new File('+JSON.stringify(payloadFile)+');f.encoding="BINARY";if(!f.open("r"))throw Error("Cannot read transfer package");var raw;try{raw=f.read();}finally{f.close();}stage="decode-package";var data=Transferify._decodePayload(raw);stage="import";var result=Transferify.receiveFigma(data,'+JSON.stringify(customFolder())+');return result||"TRANSFERIFY_EMPTY_RESULT";}catch(e){return "TRANSFERIFY_HOST_ERROR ["+stage+"]: "+String(e)+" | line "+e.line;}})()';
          command=command.replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
          cs.evalScript(command,function(value){var result;try{result=JSON.parse(value);if(!result||typeof result.ok!=='boolean')throw Error('Invalid response');}catch(e){result={ok:false,message:value&&String(value)!=='undefined'?String(value):'O After retornou uma resposta vazia ao importar. Confira se criou camadas antes de reenviar.'};}finish(result);var compId=result.destinationCompId||result.createdCompId;if(result.ok&&typeof compId==='number'&&compId>0&&Math.floor(compId)===compId){
            cs.evalScript('(function(){try{var c=app.project.itemByID('+compId+');if(!(c instanceof CompItem))return "Composition not found";c.openInViewer();return "OPENED";}catch(e){return String(e);}})()',function(opened){if(opened!=='OPENED')status(result.message+' • Composição importada, mas não foi possível abrir o painel: '+String(opened||'sem resposta'));});
          }});
        }catch(e){finish({ok:false,message:'Falha ao preparar envio ao After: '+String(e.message||e)});}

      }},function(error){if(error){figmaServer=null;$('connectionState').textContent='Connection: '+error.message;status('Connection: '+error.message);return;}$('connectionState').textContent='Automatic connection active · Figma and Illustrator settings shared.';$('figmaPause').textContent='Pause receiver';status('READY · FIGMA CONNECTED');});
    }catch(e){figmaServer=null;status('Connection: '+e.message);}
  }
  $('figmaReconnect').onclick=function(){if(figmaServer){var old=figmaServer;figmaServer=null;old.close(startReceiver);}else startReceiver();};
  $('figmaPause').onclick=function(){if(figmaServer){figmaServer.close();figmaServer=null;$('connectionState').textContent='Receiver paused';$('figmaPause').textContent='Resume receiver';}else startReceiver();};
  window.addEventListener('beforeunload',function(){if(figmaServer)figmaServer.close();});
  $('settingsToggle').onclick=function(){var menu=$('settingsMenu');menu.hidden=!menu.hidden;this.setAttribute('aria-expanded',String(!menu.hidden));};
  function updateTransferify(done){
    if(busy){if(done)done({ok:false,message:'Transferify ocupado. Aguarde a transferência terminar.'});return;}
    setBusy(true,'CHECKING FOR UPDATES…');
    try{var nr=typeof require==='function'?require:window.cep_node.require,root=cs.getSystemPath(SystemPath.EXTENSION);(function(){var modulePath=root+'/js/updater.js';if(nr.cache&&nr.resolve)delete nr.cache[nr.resolve(modulePath)];return nr(modulePath);})().run(root,'0.8.4').then(function(result){setBusy(false);status(result.message);if(done)done(result);},function(error){var result={ok:false,message:String(error.message||error)};setBusy(false);status(result.message);if(done)done(result);});}catch(error){var result={ok:false,message:String(error.message||error)};setBusy(false);status(result.message);if(done)done(result);}
  }
  $('updatePlugin').onclick=function(){$('settingsMenu').hidden=true;$('settingsToggle').setAttribute('aria-expanded','false');updateTransferify();};
  $('reloadPanel').onclick=function(){
    if(busy){status('Wait for the current transfer to finish before reloading.');return;}
    this.disabled=true;
    var reloaded=false;
    function reload(){if(reloaded)return;reloaded=true;window.location.reload(true);}
    // A persistent Figma HTTP connection must not block the panel refresh.
    if(figmaServer){
      var server=figmaServer;figmaServer=null;
      setTimeout(reload,750);
      try{server.close(reload);if(server.closeAllConnections)server.closeAllConnections();}catch(e){reload();}
    }else reload();
  };
  refreshFolder();status('LOADING…');
  var hostFile=cs.getSystemPath(SystemPath.EXTENSION)+'/jsx/host.jsx';
  cs.evalScript('(function(){try{$.evalFile(new File('+JSON.stringify(hostFile)+'));return "HOST_READY";}catch(e){return "ERROR: "+String(e);}})()',function(result){
    if(!result||result==='EvalScript error.'||String(result).indexOf('ERROR')===0){status(result||'ERROR: Host script did not load');return;}
    hostReady=true;status('READY');if(h==='ae')syncOptions(function(){startReceiver();});
  });
})();