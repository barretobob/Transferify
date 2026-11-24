'use strict';
var http=require('http'),crypto=require('crypto'),fs=require('fs'),os=require('os'),path=require('path'),normalize=require('./figma-normalize').normalize;
exports.start=function(options,ready){
 var token=crypto.randomBytes(24).toString('hex'),busy=false,clientId=fs.readFileSync(path.join(options.assetDir,'figma-client-id.txt'),'utf8').trim();if(!/^[a-f0-9]{64}$/.test(clientId))throw Error('Invalid public plugin identifier');
 function equal(a,b){return a.length===b.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));}
 var pendingPull=null,lastPluginPoll=0;
 var server=http.createServer(function(req,res){
  var origin=req.headers.origin;
  if(origin&&origin!=='null'&&!/^https:\/\/([a-z0-9-]+\.)?figma\.com$/.test(origin)){res.writeHead(403);return res.end();}
  if(!/^(localhost|127\.0\.0\.1):17860$/.test(req.headers.host||'')){res.writeHead(403);return res.end();}
  res.setHeader('Access-Control-Allow-Origin',origin||'null');res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, X-Transferify-Client');res.setHeader('Access-Control-Allow-Methods','POST, GET, OPTIONS');res.setHeader('Access-Control-Allow-Private-Network','true');res.setHeader('Content-Type','application/json');
  function reply(code,value){res.writeHead(code);res.end(JSON.stringify(value));}
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  if(req.method==='GET'&&req.url==='/health')return reply(200,{protocol:'transferify-figma',version:1});
  if(req.method==='GET'&&req.url==='/session'){if(!equal(String(req.headers['x-transferify-client']||''),clientId))return reply(401,{ok:false,message:'Atualize o plugin Figma e o painel After para a mesma versão.'});return reply(200,{protocol:'transferify-figma',version:1,token:token});}
  var auth=String(req.headers.authorization||''),expected='Bearer '+token;
  if(auth.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(auth),Buffer.from(expected)))return reply(401,{ok:false,message:'Código de conexão inválido.'});
  if(req.method==='GET'&&req.url==='/commands'){lastPluginPoll=Date.now();var command=pendingPull;pendingPull=null;return reply(200,{ok:true,command:command});}
  if(req.method==='POST'&&req.url==='/update'){
   if(busy||options.isBusy&&options.isBusy())return reply(409,{ok:false,message:'Transferify ocupado. Aguarde a transferência terminar.'});
   if(!options.update)return reply(503,{ok:false,message:'Reabra o painel atualizado do Transferify no After.'});
   busy=true;return options.update(function(result){busy=false;if(!res.destroyed)reply(result.ok?200:500,result);});
  }
  if(req.method==='POST'&&req.url==='/activate'){if(!options.activate)return reply(503,{ok:false,message:'Reload the After panel.'});return options.activate(function(error){reply(error?500:200,{ok:!error,message:error||'After activated'});});}
  if(req.method==='POST'&&req.url==='/illustrator/export'){
   if(busy||options.isBusy&&options.isBusy())return reply(409,{ok:false,message:'Transferify is busy.'});
   if(!options.exportIllustrator)return reply(503,{ok:false,message:'Reload the development After panel.'});
   busy=true;return options.exportIllustrator(function(result){busy=false;if(!res.destroyed)reply(result.ok?200:500,result);});
  }
  if(req.method!=='POST'||req.url!=='/send')return reply(404,{ok:false});
  if(busy||options.isBusy&&options.isBusy())return reply(409,{ok:false,message:'After ocupado. Tente novamente ao terminar.'});
  var chunks=[],size=0,failed=false;req.on('data',function(c){if(failed)return;size+=c.length;if(size>48*1024*1024){failed=true;chunks=[];reply(413,{ok:false,message:'A seleção excede 48 MB no envio. Envie em blocos menores.'});}else chunks.push(c);});
  req.on('end',function(){if(failed)return;var temp;try{busy=true;temp=fs.mkdtempSync(path.join(os.tmpdir(),'transferify-figma-'));var payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));var data=payload.protocol==='transferify-figma-svg'?require('./svg-transport').validate(payload):normalize(payload,options.assetDir,temp);
    options.importer(data,function(result){busy=false;try{fs.rmSync(temp,{recursive:true,force:true});}catch(e){}if(!res.destroyed)reply(result.ok?200:500,result);});
   }catch(e){busy=false;if(temp)try{fs.rmSync(temp,{recursive:true,force:true});}catch(ignore){}reply(400,{ok:false,message:String(e.message||e)});}
  });
 });
 server.requestPull=function(mode){if(busy||options.isBusy&&options.isBusy())return {ok:false,message:'After is busy.'};if(Date.now()-lastPluginPoll>6000)return {ok:false,message:'Open the Transferify plugin in Figma, select artwork, then click PUSH FROM FIGMA.'};if(pendingPull)return {ok:false,message:'A Figma selection request is already pending.'};pendingPull={type:'send-selection',mode:mode==='current'?'current':'new',id:crypto.randomBytes(8).toString('hex')};return {ok:true,message:'PUSH FROM FIGMA • waiting for selection export…'};};server.requestTimeout=130000;server.headersTimeout=15000;server.on('error',function(e){ready(e);});server.listen(17860,'127.0.0.1',function(){ready(null,token);});return server;
};
