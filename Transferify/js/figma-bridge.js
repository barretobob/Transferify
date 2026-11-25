'use strict';
var http=require('http'),crypto=require('crypto'),fs=require('fs'),os=require('os'),path=require('path'),normalize=require('./figma-normalize').normalize;
exports.start=function(options,ready){
 var receiverHost=options.host==='ai'?'ai':'ae',port=receiverHost==='ai'?17861:17860;
 var token=crypto.randomBytes(24).toString('hex'),busy=false,clientId=fs.readFileSync(path.join(options.assetDir,'figma-client-id.txt'),'utf8').trim();if(!/^[a-f0-9]{64}$/.test(clientId))throw Error('Invalid public plugin identifier');
 function equal(a,b){return a.length===b.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));}
 var pendingPull=null,lastPluginPoll=0,lastPluginSession='',lastPluginPage='',pendingSend=null;
 function connected(){return lastPluginPoll>0&&!!lastPluginSession&&Date.now()-lastPluginPoll<6500;}
 function finishSend(result){if(!pendingSend)return;var pending=pendingSend;pendingSend=null;clearTimeout(pending.timer);busy=false;if(options.onFigmaComplete)options.onFigmaComplete(result);pending.done(result);}

 var server=http.createServer(function(req,res){
  var origin=req.headers.origin;
  if(origin&&origin!=='null'&&!/^https:\/\/([a-z0-9-]+\.)?figma\.com$/.test(origin)){res.writeHead(403);return res.end();}
  if(['localhost:'+port,'127.0.0.1:'+port].indexOf(req.headers.host||'')<0){res.writeHead(403);return res.end();}
  res.setHeader('Access-Control-Allow-Origin',origin||'null');res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, X-Transferify-Client, X-Transferify-Figma-Session, X-Transferify-Page');res.setHeader('Access-Control-Allow-Methods','POST, GET, OPTIONS');res.setHeader('Access-Control-Allow-Private-Network','true');res.setHeader('Content-Type','application/json');
  function reply(code,value){res.writeHead(code);res.end(JSON.stringify(value));}
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  if(req.method==='GET'&&req.url==='/health')return reply(200,{protocol:'transferify-figma',version:1,host:receiverHost,build:'0.8.7',figmaConnected:connected()});
  if(req.method==='GET'&&req.url==='/session'){if(!equal(String(req.headers['x-transferify-client']||''),clientId))return reply(401,{ok:false,message:'Atualize o plugin Figma e o painel Adobe para a mesma versão.'});return reply(200,{protocol:'transferify-figma',version:1,host:receiverHost,token:token,figmaSession:lastPluginSession,figmaPage:lastPluginPage});}
  var auth=String(req.headers.authorization||''),expected='Bearer '+token;
  if(auth.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(auth),Buffer.from(expected)))return reply(401,{ok:false,message:'Código de conexão inválido.'});
  if(req.method==='GET'&&req.url==='/commands'){
   var session=String(req.headers['x-transferify-figma-session']||''),page=String(req.headers['x-transferify-page']||'');if(!/^[a-zA-Z0-9_-]{8,80}$/.test(session)||!/^[a-zA-Z0-9:_-]{0,120}$/.test(page))return reply(400,{ok:false,message:'Atualize o plugin Figma.'});lastPluginPoll=Date.now();lastPluginSession=session;lastPluginPage=page;var command=null;
   if(pendingPull&&pendingPull.session===session&&pendingPull.page===page){command={type:pendingPull.type,mode:pendingPull.mode,id:pendingPull.id};pendingPull=null;}
   if(pendingSend&&pendingSend.session===session&&pendingSend.page===page&&Date.now()-pendingSend.lastSent>10000){command=pendingSend.command;pendingSend.lastSent=Date.now();}return reply(200,{ok:true,command:command});
  }
  if(req.method==='POST'&&req.url==='/result'){
   var ack=[],ackSize=0,ackFailed=false;req.on('data',function(c){ackSize+=c.length;if(ackSize>4096){if(!ackFailed){ackFailed=true;reply(413,{ok:false});}return;}ack.push(c);});req.on('end',function(){if(ackFailed)return;try{var result=JSON.parse(Buffer.concat(ack).toString('utf8'));if(!pendingSend||result.id!==pendingSend.command.id||typeof result.ok!=='boolean'||String(req.headers['x-transferify-figma-session']||'')!==pendingSend.session||String(req.headers['x-transferify-page']||'')!==pendingSend.page)return reply(409,{ok:false,message:'Confirmação sem transferência correspondente.'});reply(200,{ok:true});finishSend({ok:result.ok,message:result.ok?'ILLUSTRATOR → FIGMA • transferência concluída'+(pendingSend.warnings.length?' • '+pendingSend.warnings.join(' | '):''):String(result.message||'Figma não concluiu a importação.').slice(0,1000)});}catch(error){reply(400,{ok:false});}});return;
  }
  if(req.method==='POST'&&req.url==='/update'){
   if(busy||options.isBusy&&options.isBusy())return reply(409,{ok:false,message:'Transferify ocupado. Aguarde a transferência terminar.'});
   if(!options.update)return reply(503,{ok:false,message:'Reabra o painel atualizado do Transferify neste aplicativo.'});
   busy=true;return options.update(function(result){busy=false;if(!res.destroyed)reply(result.ok?200:500,result);});
  }
  if(req.method==='POST'&&req.url==='/activate'){if(!options.activate)return reply(503,{ok:false,message:'Reload the After panel.'});return options.activate(function(error){reply(error?500:200,{ok:!error,message:error||'After activated'});});}
  if(req.method==='POST'&&req.url==='/figma/send')return server.sendToFigma(function(result){if(!res.destroyed)reply(result.ok?200:500,result);},req.headers['x-transferify-figma-session']);
  if(req.method==='POST'&&req.url==='/illustrator/export'){
   if(receiverHost!=='ai')return reply(409,{ok:false,message:'Abra o Transferify no Illustrator para este fluxo direto.'});
   if(busy||options.isBusy&&options.isBusy())return reply(409,{ok:false,message:'Transferify is busy.'});
   if(!options.exportIllustrator)return reply(503,{ok:false,message:'Reabra o painel Transferify no Illustrator.'});
   busy=true;return options.exportIllustrator(function(result){busy=false;if(!res.destroyed)reply(result.ok?200:500,result);});
  }
  if(req.method!=='POST'||req.url!=='/send')return reply(404,{ok:false});
  if(busy||options.isBusy&&options.isBusy())return reply(409,{ok:false,message:'Transferify ocupado. Tente novamente ao terminar.'});
  var chunks=[],size=0,failed=false;req.on('data',function(c){if(failed)return;size+=c.length;if(size>48*1024*1024){failed=true;chunks=[];reply(413,{ok:false,message:'A seleção excede 48 MB no envio. Envie em blocos menores.'});}else chunks.push(c);});
  req.on('end',function(){if(failed)return;var temp;try{busy=true;temp=fs.mkdtempSync(path.join(os.tmpdir(),'transferify-figma-'));var payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));if((payload.protocol==='transferify-figma-svg')!==(receiverHost==='ai'))throw Error('Destino incompatível. Atualize o plugin Figma e use o painel do aplicativo de destino.');var data=payload.protocol==='transferify-figma-svg'?require('./svg-transport').validate(payload):normalize(payload,options.assetDir,temp);
    options.importer(data,function(result){busy=false;try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){}if(!res.destroyed)reply(result.ok?200:500,result);});
   }catch(e){busy=false;if(temp)try{fs.rmSync(temp,{recursive:true,force:true});}catch(ignore){}reply(400,{ok:false,message:String(e.message||e)});}
  });
 });
 server.getStatus=function(){return {figmaConnected:connected(),sending:!!pendingSend,sessionId:lastPluginSession,pageId:lastPluginPage};};
 server.sendToFigma=function(done,expectedSession){
  if(receiverHost!=='ai')return done({ok:false,message:'Este envio está disponível no Illustrator.'});
  if(busy||options.isBusy&&options.isBusy())return done({ok:false,message:'Transferify ocupado.'});
  if(!connected())return done({ok:false,message:'Abra o plugin Transferify no Figma e aguarde a conexão.'});
  if(expectedSession&&expectedSession!==lastPluginSession)return done({ok:false,message:'O documento de destino no Figma mudou. Confira o destino e tente novamente.'});
  var destinationSession=lastPluginSession,destinationPage=lastPluginPage;
  if(!options.exportIllustrator)return done({ok:false,message:'Recarregue o painel Illustrator.'});
  busy=true;options.exportIllustrator(function(result){if(!result.ok){busy=false;return done(result);}var data=result.data;if(!data||typeof data.svg!=='string'||Buffer.byteLength(data.svg,'utf8')>48*1024*1024){busy=false;return done({ok:false,message:'SVG inválido ou maior que 48 MB.'});}var id=crypto.randomBytes(16).toString('hex');pendingSend={command:{type:'import-illustrator',id:id,data:data},lastSent:0,session:destinationSession,page:destinationPage,done:done,warnings:data.warnings||[]};pendingSend.timer=setTimeout(function(){finishSend({ok:false,message:'Sem confirmação do Figma. Confira o destino antes de reenviar.'});},120000);if(options.onFigmaWaiting)options.onFigmaWaiting();});
 };
 server.on('close',function(){finishSend({ok:false,message:'Painel fechado antes da confirmação do Figma.'});});
 server.requestPull=function(mode){if(busy||options.isBusy&&options.isBusy())return {ok:false,message:'Transferify is busy.'};if(Date.now()-lastPluginPoll>6000)return {ok:false,message:'Open the Transferify plugin in Figma, select artwork, then click PUSH FROM FIGMA.'};if(pendingPull)return {ok:false,message:'A Figma selection request is already pending.'};pendingPull={session:lastPluginSession,page:lastPluginPage,type:'send-selection',mode:mode==='current'?'current':'new',id:crypto.randomBytes(8).toString('hex')};return {ok:true,message:'PUSH FROM FIGMA • waiting for selection export…'};};server.requestTimeout=130000;server.headersTimeout=15000;server.on('error',function(e){ready(e);});server.listen(port,'127.0.0.1',function(){ready(null,token);});return server;
};
