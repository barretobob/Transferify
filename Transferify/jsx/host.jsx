var Transferify=Transferify||{};
Transferify._hostScriptPath=String($.fileName);
Transferify._parsePanelSettings=function(raw){if(typeof JSON!='undefined'&&JSON.parse)return JSON.parse(raw);var text=String(raw);if(!/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,'@').replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,']').replace(/(?:^|:|,)(?:\s*\[)+/g,'')))throw Error('Invalid settings JSON');return eval('('+text+')');};


Transferify._host=function(){
  try{
    var n=String(app.name||"").toLowerCase();
    if(n.indexOf("illustrator")>=0)return "ai";
    if(n.indexOf("after effects")>=0)return "ae";
  }catch(e){}
  try{
    var b=String(BridgeTalk.appName||"").toLowerCase();
    if(b.indexOf("illustrator")>=0)return "ai";
    if(b.indexOf("aftereffects")>=0)return "ae";
  }catch(e2){}
  return "unknown";
};

Transferify._quote=function(value){return Transferify._plainJSON(String(value||""));};

Transferify._bridgeTarget=function(target){
  try{
    var running=BridgeTalk.getTargets();
    var prefix=String(target||'').toLowerCase();
    for(var index=0;index<running.length;index++){
      var candidate=String(running[index]);
      if(candidate.toLowerCase().split('-')[0]===prefix&&BridgeTalk.isRunning(candidate))return candidate;
    }
  }catch(_runningTarget){}
  try{var resolved=BridgeTalk.getSpecifier(String(target||'').toLowerCase());if(resolved)return resolved;}catch(_resolveTarget){}
  try{
    var want=String(target||"").toLowerCase(),ts=BridgeTalk.getTargets();
    for(var i=0;i<ts.length;i++){
      var s=String(ts[i]),low=s.toLowerCase();
      if(want=="illustrator"&&low.indexOf("illustrator")==0)return s;
      if(want=="aftereffects"&&low.indexOf("aftereffects")==0)return s;
      if(want=="photoshop"&&low.indexOf("photoshop")==0)return s;
    }
  }catch(_bt){}
  return target;
};

Transferify._encodePayload=function(data){
  var raw=Transferify._plainJSON(data),hex="";
  for(var i=0;i<raw.length;i++){var part=raw.charCodeAt(i).toString(16);while(part.length<4)part="0"+part;hex+=part;}
  return hex;
};
Transferify._decodePayload=function(hex){
  if(typeof hex!='string'||hex.length%4||/[^0-9a-f]/i.test(hex))throw Error('Invalid transfer encoding');
  var raw='',i;for(i=0;i<hex.length;i+=4)raw+=String.fromCharCode(parseInt(hex.substr(i,4),16));
  // Private JSON reader: other CEP extensions can replace the shared JSON global.
  var pos=0;
  function fail(){throw Error('Invalid transfer JSON at character '+pos);}
  function ws(){while(pos<raw.length&&/\s/.test(raw.charAt(pos)))pos++;}
  function str(){var out='',c,e,h;pos++;while(pos<raw.length){c=raw.charAt(pos++);if(c=='"')return out;if(c=='\\'){e=raw.charAt(pos++);if(e=='u'){h=raw.substr(pos,4);if(!/^[0-9a-f]{4}$/i.test(h))fail();out+=String.fromCharCode(parseInt(h,16));pos+=4;}else if(e=='"'||e=='\\'||e=='/')out+=e;else if(e=='b')out+='\b';else if(e=='f')out+='\f';else if(e=='n')out+='\n';else if(e=='r')out+='\r';else if(e=='t')out+='\t';else fail();}else{if(c.charCodeAt(0)<32)fail();out+=c;}}fail();}
  function value(depth){if(depth>256)fail();ws();var c=raw.charAt(pos),v,k,m;if(c=='"')return str();if(c=='{'||c=='['){var object=c=='{',end=object?'}':']';v=object?{}:[];pos++;ws();if(raw.charAt(pos)==end){pos++;return v;}while(true){if(object){if(raw.charAt(pos)!='"')fail();k=str();ws();if(raw.charAt(pos++)!=':')fail();if(k=='__proto__'||k=='constructor'||k=='prototype')fail();v[k]=value(depth+1);}else v.push(value(depth+1));ws();c=raw.charAt(pos++);if(c==end)return v;if(c!=',')fail();ws();}}
   if(raw.substr(pos,4)=='true'){pos+=4;return true;}if(raw.substr(pos,5)=='false'){pos+=5;return false;}if(raw.substr(pos,4)=='null'){pos+=4;return null;}m=raw.substr(pos).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+\-]?[0-9]+)?/);if(!m)fail();pos+=m[0].length;v=Number(m[0]);if(!isFinite(v))fail();return v;
  }
  var result=value(0);ws();if(pos!=raw.length)fail();return result;
};
Transferify._aiMessage=function(data,folderPath,gradients){
  return "("+Transferify._receiveAI.toString()+")(("+Transferify._decodePayload.toString()+")('"+Transferify._encodePayload(data)+"'),"+Transferify._quote(folderPath)+","+Transferify._plainJSON(gradients||[])+");";
};

Transferify._send=function(target,body){
  try{
    var bt=new BridgeTalk();bt.target=Transferify._bridgeTarget(target);bt.body=body;
    if(!Transferify._pendingBridge)Transferify._pendingBridge=[];
    Transferify._pendingBridge.push(bt);
    var answered=false;
    function release(){for(var i=Transferify._pendingBridge.length-1;i>=0;i--)if(Transferify._pendingBridge[i]===bt)Transferify._pendingBridge.splice(i,1);}
    bt.onResult=function(e){answered=true;Transferify._lastBridgeNotice=null;release();if(String(e.body).indexOf('ERROR')==0)alert('Transferify: destination reported an error. Check the destination application.');};
    bt.onError=function(e){answered=true;release();try{alert("Transferify BridgeTalk error:\n"+e.body);}catch(_e){}};
    bt.onTimeout=function(){if(answered)return;release();Transferify._lastBridgeNotice={target:target,message:'No confirmation received. Check the destination before sending again.',time:new Date().getTime()};};
    try{BridgeTalk.bringToFront(bt.target);}catch(_front){}
    if(!bt.send()){release();return false;}return true;
  }catch(e){return false;}
};

Transferify._plainJSON=function(v){
  function esc(x){
    x=String(x);var out="",slash=String.fromCharCode(92);
    // Numeric character codes avoid ExtendScript/toString escape ambiguity in BridgeTalk.
    for(var i=0;i<x.length;i++){
      var n=x.charCodeAt(i);
      if(n==92)out+=slash+slash;
      else if(n==34)out+=slash+String.fromCharCode(34);
      else if(n==10)out+=slash+"n";
      else if(n==13)out+=slash+"r";
      else if(n==9)out+=slash+"t";
      else if(n<32||n==0x2028||n==0x2029){var hex=n.toString(16);while(hex.length<4)hex="0"+hex;out+=slash+"u"+hex;}
      else out+=x.charAt(i);
    }
    return out;
  }
  function enc(x){
    if(x===null||typeof x=="undefined")return "null";
    var t=typeof x;
    if(t=="number"){var n=Number(x);return (isNaN(n)||!isFinite(n))?"0":String(n);}
    if(t=="boolean")return x?"true":"false";
    if(t=="string")return '"'+esc(x)+'"';
    var isA=false;
    try{isA=(x instanceof Array)||(x.constructor===Array)||Object.prototype.toString.call(x)=="[object Array]";}catch(e){}
    if(isA){
      var a=[]; for(var i=0;i<x.length;i++)a.push(enc(x[i]));
      return "["+a.join(",")+"]";
    }
    var p=[];
    for(var k in x){
      try{
        if(typeof x[k]=="function")continue;
        if(x.hasOwnProperty&&!x.hasOwnProperty(k))continue;
        p.push('"'+esc(k)+'":'+enc(x[k]));
      }catch(e2){}
    }
    return "{"+p.join(",")+"}";
  }
  return enc(v);
};


// Resolve on every import: never persist an automatic absolute project path.
Transferify._imageFolder=function(requestedFolder){
  var folder;
  if(requestedFolder&&String(requestedFolder).length){
    folder=new Folder(String(requestedFolder));
  }else{
    if(!app.project||!app.project.file)throw Error('Salve o projeto AE ou escolha IMG FOLDER antes de enviar imagens.');
    var base=app.project.file.parent;
    // Standard template: project/AEP/file.aep -> project/IMAGENS.
    if(String(base.name).toUpperCase()=='AEP'){
      folder=new Folder(base.parent.fsName+'/IMAGENS');
    }else{
      folder=new Folder(base.fsName+'/IMAGENS');
      // Also recognize an existing sibling when the AEP folder has another name.
      if(!folder.exists&&base.parent&&base.parent.fsName!=base.fsName){
        var sibling=new Folder(base.parent.fsName+'/IMAGENS');
        if(sibling.exists)folder=sibling;
      }
    }
  }
  if(!folder.exists&&!folder.create())throw Error('Não foi possível criar a pasta de imagens: '+folder.fsName);
  return folder;
};

Transferify.chooseFolder=function(){
  try{var f=Folder.selectDialog("Transferify - Image Folder");return f?f.fsName:"CANCEL";}
  catch(e){return "ERROR "+e.number+": "+e.message;}
};

Transferify.createCompFromArtboard=function(){
  if(Transferify._host()!="ai")return "CREATE COMP from Artboard • Illustrator only";
  try{
    if(!app.documents.length)return "No Illustrator document";
    var d=app.activeDocument,ab=d.artboards[d.artboards.getActiveArtboardIndex()],r=ab.artboardRect;
    var body="(function(){try{if(!app.project)app.newProject();var o={multiplier:1,duration:5,fps:30};try{if(app.settings.haveSetting('Transferify QA','importOptions'))o=eval('('+app.settings.getSetting('Transferify QA','importOptions')+')');}catch(_){}var c=app.project.items.addComp("+Transferify._quote(ab.name||d.name)+",Math.round("+Math.round(r[2]-r[0])+"*o.multiplier),Math.round("+Math.round(r[1]-r[3])+"*o.multiplier),1,o.duration,o.fps);c.openInViewer();}catch(e){alert('Transferify CREATE COMP: '+e.toString());}})();";
    return Transferify._send("aftereffects",body)?"CREATE COMP → AE":"ERROR • AE not reachable";
  }catch(e){return "ERROR "+e.number+": "+e.message+" line "+e.line;}
};

Transferify.createArtboardFromComp=function(){
  if(Transferify._host()!="ae")return "CREATE ARTBOARD from Comp • After Effects only";
  try{
    var c=Transferify._aeComp();if(!(c instanceof CompItem))return "Open/select a Comp";
    var body="(function(){try{var doc;if(!app.documents.length){doc=app.documents.add(DocumentColorSpace.RGB,"+c.width+","+c.height+");doc.artboards[0].artboardRect=[0,"+c.height+","+c.width+",0];doc.artboards[0].name="+Transferify._quote(c.name)+";}else{doc=app.activeDocument;var gap=100,maxR=-999999,top=0;for(var i=0;i<doc.artboards.length;i++){var r=doc.artboards[i].artboardRect;if(r[2]>maxR){maxR=r[2];top=r[1];}}var left=maxR+gap,ab=doc.artboards.add([left,top,left+"+c.width+",top-"+c.height+"]);ab.name="+Transferify._quote(c.name)+";doc.artboards.setActiveArtboardIndex(doc.artboards.length-1);}app.redraw();}catch(e){alert('Transferify CREATE ARTBOARD: '+e.toString());}})();";
    return Transferify._send("illustrator",body)?"CREATE ARTBOARD → AI":"ERROR • AI not reachable";
  }catch(e){return "ERROR "+e.number+": "+e.message+" line "+e.line;}
};

Transferify._aeComp=function(){
  try{
    var viewer=app.activeViewer;
    if(viewer&&viewer.type==ViewerType.VIEWER_COMPOSITION){
      viewer.setActive();
      if(app.project&&app.project.activeItem instanceof CompItem)return app.project.activeItem;
    }
  }catch(_viewer){}
  try{if(app.project&&app.project.activeItem instanceof CompItem)return app.project.activeItem;}catch(_active){}
  return null;
};

Transferify._readAEGuides=function(comp){
  var out=[],gs=comp.guides||[];
  for(var i=0;i<gs.length;i++){
    var g=gs[i],orientation=Number(g.orientationType!==undefined?g.orientationType:g.orientation),position=Number(g.position),modern=false;
    try{if(typeof GuideOrientationType!="undefined"){if(orientation!=0&&orientation!=1)orientation=g.orientationType==GuideOrientationType.VERTICAL?1:0;modern=true;}}catch(_enum){}
    var extent=orientation==1?comp.width:comp.height;
    try{if(modern&&g.positionType==GuidePositionType.PERCENTAGE)position=position*extent/100;}catch(_percent){}
    if(g.pinned===true)position=extent-position;
    out.push([orientation,position]);
  }
  return out;
};

Transferify._addAEGuides=function(comp,guides){
  var made=0,existing=Transferify._readAEGuides(comp);
  for(var i=0;i<guides.length;i++){
    var o=Number(guides[i][0]),p=Number(guides[i][1]),found=false;
    for(var j=0;j<existing.length;j++)if(existing[j][0]==o&&Math.abs(existing[j][1]-p)<0.5){found=true;break;}
    if(found)continue;
    comp.addGuide(o,p); // Stable pixel API: 0 horizontal, 1 vertical.
    existing.push([o,p]);made++;
  }
  return made;
};

Transferify._receiveGuidesAI=function(guides,documentIndex,documentName,artboardIndex){
  try{
    if(!app.documents.length)return "NO_DOC";
    var d=null;
    if(documentIndex>=0&&documentIndex<app.documents.length&&String(app.documents[documentIndex].name)==documentName)d=app.documents[documentIndex];
    if(!d)for(var di=0;di<app.documents.length;di++)if(String(app.documents[di].name)==documentName){d=app.documents[di];break;}
    if(!d)return "Target Illustrator document was closed";
    d.activate();
    var ai=Math.max(0,Math.min(artboardIndex,d.artboards.length-1)),r=d.artboards[ai].artboardRect,made=0;
    var layer=d.layers.add();layer.name="TRANSFERIFY Guides";
    for(var i=0;i<guides.length;i++){
      var o=Number(guides[i][0]),pos=Number(guides[i][1]),line=layer.pathItems.add();
      line.stroked=false;line.filled=false;
      if(o==1)line.setEntirePath([[r[0]+pos,r[1]],[r[0]+pos,r[3]]]);
      else line.setEntirePath([[r[0],r[1]-pos],[r[2],r[1]-pos]]);
      line.guides=true;made++;
    }
    if(!made)layer.remove();app.redraw();return "GUIDES: "+made;
  }catch(e){return "ERROR: "+e.toString()+" line "+e.line;}
};

/* ---------- AI LOCAL SERIALIZER ---------- */
Transferify._rgb=function(c){
  try{
    if(!c)return[1,1,1];
    if(c.typename=="RGBColor")return[Number(c.red)/255,Number(c.green)/255,Number(c.blue)/255];
    if(c.typename=="GrayColor"){var g=1-Number(c.gray)/100;return[g,g,g];}
    if(c.typename=="CMYKColor"){
      var C=Number(c.cyan)/100,M=Number(c.magenta)/100,Y=Number(c.yellow)/100,K=Number(c.black)/100;
      return[(1-C)*(1-K),(1-M)*(1-K),(1-Y)*(1-K)];
    }
  }catch(e){}
  return[1,1,1];
};

Transferify._plainArray=function(v,n){
  var a=[],len=(typeof n=="number")?n:(v?v.length:0);
  for(var i=0;i<len;i++){try{a.push(Number(v[i]));}catch(e){a.push(0);}}
  return a;
};

Transferify._isGenericLayerName=function(n){
  n=String(n||"");
  return !n.length || /^Layer\s*\d+$/i.test(n) || /^Layer\s+/i.test(n);
};

Transferify._itemName=function(it,fallback){
  try{
    var n=String(it.name||"");
    if(n.length&&n!="PlacedItem"&&n!="RasterItem"&&n!="PathItem"&&n!="GroupItem"&&n!="TextFrame")return n;
  }catch(e){}
  try{
    var ln=String(it.layer&&it.layer.name||"");
    if(ln.length&&!Transferify._isGenericLayerName(ln))return ln;
  }catch(e2){}
  return fallback||String(it.typename||"Item");
};

Transferify._textLayerName=function(it,txt){
  try{
    var own=String(it.name||"");
    if(own.length&&own!="TextFrame")return own;
  }catch(_n){}
  try{
    var ln=String(it.layer&&it.layer.name||"");
    if(ln.length&&!Transferify._isGenericLayerName(ln))return ln;
  }catch(_l){}
  var first=String(txt||"").split(/\r\n|\r|\n|\x03/)[0];
  if(first.length>30)first=first.substring(0,30);
  return first.length?first:"Text";
};

Transferify._hasGradient=function(it){
  try{
    if(it.typename=="PathItem"){
      if(it.filled&&it.fillColor&&it.fillColor.typename=="GradientColor")return true;
      if(it.stroked&&it.strokeColor&&it.strokeColor.typename=="GradientColor")return true;
    }else if(it.typename=="CompoundPathItem"){
      for(var i=0;i<it.pathItems.length;i++)if(Transferify._hasGradient(it.pathItems[i]))return true;
    }else if(it.typename=="GroupItem"){
      for(var j=0;j<it.pageItems.length;j++)if(Transferify._hasGradient(it.pageItems[j]))return true;
    }
  }catch(e){}
  return false;
};

Transferify._safeName=function(s,fallback){
  var src=String(s||fallback||"image"),bad='\\/:*?"<>|',out="";
  for(var i=0;i<src.length;i++){
    var ch=src.charAt(i),ok=true;
    for(var j=0;j<bad.length;j++)if(ch==bad.charAt(j)){ok=false;break;}
    out+=ok?ch:"_";
  }
  return out.length?out:String(fallback||"image");
};


Transferify._extractGradientSVG=function(svg,itemName){
  if(!svg||!itemName)return "";
  try{
    var root=new XML(svg),nodes=root.descendants(),target=null,defs="";
    for(var i=0;i<nodes.length();i++){
      if(String(nodes[i].localName())=="defs")defs+=nodes[i].toXMLString();
      if(String(nodes[i].attribute("id"))==String(itemName)){if(target)return "";target=nodes[i];}
    }
    if(!target)return "";
    var body=target.toXMLString(),parent=target.parent();
    while(parent&&String(parent.localName())!="svg"){
      if(String(parent.localName())=="g"){
        var markup=parent.toXMLString(),close=markup.indexOf(">");
        body=markup.substring(0,close+1)+body+"</g>";
      }
      parent=parent.parent();
    }
    var header=root.toXMLString(),opening=header.substring(0,header.indexOf(">")+1);
    return opening+defs+body+"</svg>";
  }catch(_svg){return "";}
};

Transferify._shadowFromSVG=function(svg,itemName){
  if(!svg||!itemName)return null;
  try{
    var xml=new XML(svg),nodes=xml.descendants(),target=null,id=String(itemName);
    for(var i=0;i<nodes.length();i++)if(String(nodes[i].attribute("id"))==id){target=nodes[i];break;}
    if(!target)return null;
    var raw=String(target.attribute("filter"))+" "+String(target.attribute("style")),start=raw.indexOf("url(#");
    if(start<0){var descendants=target.descendants();for(var k=0;k<descendants.length();k++){raw=String(descendants[k].attribute("filter"))+" "+String(descendants[k].attribute("style"));start=raw.indexOf("url(#");if(start>=0)break;}}
    if(start<0)return null;
    var end=raw.indexOf(")",start),filterID=raw.substring(start+5,end),filter=null;
    for(var j=0;j<nodes.length();j++)if(String(nodes[j].localName())=="filter"&&String(nodes[j].attribute("id"))==filterID){filter=nodes[j];break;}
    if(!filter)return null;
    var parts=filter.descendants(),dx=0,dy=0,blur=0,opacity=100,color=[0,0,0],offset=false,gaussian=false;
    function attr(n,key,defaultValue){var value=String(n.attribute(key));return value.length?value:String(defaultValue);}
    for(var pi=0;pi<parts.length();pi++){
      var node=parts[pi],tag=String(node.localName());
      if(tag=="feOffset"||tag=="feDropShadow"){dx=parseFloat(attr(node,"dx",0));dy=parseFloat(attr(node,"dy",0));offset=true;}
      if(tag=="feGaussianBlur"||tag=="feDropShadow"){blur=parseFloat(attr(node,"stdDeviation",0))*2;gaussian=true;}
      if(tag=="feColorMatrix"&&attr(node,"type","matrix")=="matrix"){
        var values=attr(node,"values",""),tokens=[],token="";
        for(var vi=0;vi<=values.length;vi++){var vc=values.charAt(vi);if(vi==values.length||values.charCodeAt(vi)<=32){if(token){tokens.push(Number(token));token="";}}else token+=vc;}
        if(tokens.length==20){color=[tokens[4],tokens[9],tokens[14]];opacity=tokens[18]*100;}
      }
      if(tag=="feFlood"||tag=="feDropShadow"){
        opacity=parseFloat(attr(node,"flood-opacity",1))*100;var c=attr(node,"flood-color","#000000");
        if(c.charAt(0)=="#"&&c.length==7)color=[parseInt(c.substr(1,2),16)/255,parseInt(c.substr(3,2),16)/255,parseInt(c.substr(5,2),16)/255];
      }
    }
    if(!offset||!gaussian)return null;
    return {enabled:true,opacity:opacity,size:blur,distance:Math.sqrt(dx*dx+dy*dy),angle:(180-Math.atan2(dy,dx)*180/Math.PI+360)%360,color:color};
  }catch(_svg){return null;}
};
Transferify._shadowFromFXG=function(fxg){
  if(!fxg)return null;
  var matches=fxg.match(/<(?:[\w-]+:)?DropShadowFilter\b[^>]*>/g);
  if(!matches||matches.length!=1)return null;
  var tag=matches[0];
  function attr(key,fallback){var m=tag.match(new RegExp("\\b"+key+"=[\"']([^\"']*)[\"']"));return m?m[1]:fallback;}
  if(attr("inner","false")=="true"||attr("hideObject","false")=="true"||attr("knockout","false")=="true")return null;
  var c=attr("color","#000000"),color=[0,0,0];
  if(c.charAt(0)=="#"&&c.length==7)color=[parseInt(c.substr(1,2),16)/255,parseInt(c.substr(3,2),16)/255,parseInt(c.substr(5,2),16)/255];
  var bx=Number(attr("blurX",4)),by=Number(attr("blurY",4));
  if(Math.abs(bx-by)>0.01)return null; // AE Drop Shadow softness is isotropic.
  return {enabled:true,color:color,opacity:Number(attr("alpha",1))*100,distance:Number(attr("distance",4)),size:bx,angle:(180-Number(attr("angle",45))+360)%360};
};
Transferify._shadowFromAI=function(raw,itemID){
  if(!raw)return null;
  // Illustrator private PostScript is split into PDF streams even with compression disabled.
  raw=raw.replace(/\rendstream\rendobj\r\d+ 0 obj\r<<\/Length \d+>>stream\r\n/g,"");
  var uid="XMLUID : ("+String(itemID||"Transferify_x5F_Object")+")",at=raw.indexOf(uid);
  if(at<0)return null;
  var use=raw.substring(at,at+1200).match(/\d+ \(([^)]*)\) XW/);if(!use)return null;
  var cursor=0,start=-1,end=raw.length;
  for(var guard=0;guard<10000;guard++){
    var next=raw.indexOf("/KnownStyle",cursor);if(next<0)break;
    if(start>=0){end=next;break;}
    var header=raw.substring(next,next+250),name=header.match(/\(([^)]*)\) \/Name/);
    if(name&&name[1]==use[1])start=next;
    cursor=next+11;
  }
  if(start<0)return null;
  var style=raw.substring(start,end),shadow=style.indexOf("(Adobe Drop Shadow)");
  if(shadow<0)return null;
  if(style.indexOf("(Adobe Drop Shadow)",shadow+1)>=0)return null;
  var part=style.substring(shadow),stop=part.indexOf(" /Part");if(stop>=0)part=part.substring(0,stop);
  if(part.indexOf("0 /Visible")>=0)return null;
  function value(key,fallback){var r=new RegExp("([-+0-9.eE]+) /(?:Real|Int|Bool) \\("+key+"\\)").exec(part);return r?Number(r[1]):fallback;}
  var dx=value("horz",0),dy=value("vert",0),color=[0,0,0];
  var paint=part.match(/([0-9.eE+\- ]+) Xa/);if(paint){var nums=paint[1].split(/ +/),v=[];for(var n=0;n<nums.length;n++)if(nums[n].length)v.push(Number(nums[n]));if(v.length>=3)color=v.slice(v.length-3);}
  if(value("csrc",0)==1){var dark=value("dark",100)/100;color=[1-dark,1-dark,1-dark];}
  return {enabled:true,color:color,opacity:value("opac",0.75)*100,distance:Math.sqrt(dx*dx+dy*dy),angle:(180-Math.atan2(dy,dx)*180/Math.PI+360)%360,size:value("blur",0)*2,blendMode:value("blnd",1)};
};
Transferify._exportItemAppearance=function(it,sourceDoc,needGradient,needShadow,session){
  var result={svg:"",nativeAI:"",shadow:null,error:""},temporary=null,folder=null;
  var oldInteraction=app.userInteractionLevel;
  try{
    app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS;
    folder=session&&session.folder;temporary=session&&session.document;
    if(!folder){folder=new Folder(Folder.temp.fsName+"/transferify_appearance_"+new Date().getTime()+"_"+Math.floor(Math.random()*100000));
    if(!folder.create())throw new Error("Cannot create appearance directory");
    if(session)session.folder=folder;}
    var ar=sourceDoc.artboards[sourceDoc.artboards.getActiveArtboardIndex()].artboardRect;
    if(!temporary){
      temporary=app.documents.add(sourceDoc.documentColorSpace,ar[2]-ar[0],ar[1]-ar[3]);
      if(session)session.document=temporary;
      temporary.artboards[0].artboardRect=ar;
    }else{if(app.activeDocument!=temporary)temporary.activate();temporary.pageItems.removeAll();}
    try{temporary.rasterEffectSettings.resolution=sourceDoc.rasterEffectSettings.resolution;}catch(_res){}
    var copy=it.duplicate(temporary.layers[0],ElementPlacement.PLACEATEND);copy.name="Transferify_Object";
    // Cross-document duplicate can shift artwork; restore source coordinates on the copy only.
    var sourceBounds=it.geometricBounds,copyBounds=copy.geometricBounds;
    copy.translate(sourceBounds[0]-copyBounds[0],sourceBounds[1]-copyBounds[1]);
    if(needGradient){
      // AE 26 native Illustrator conversion retains gradient opacity stops, unlike SVG import.
      var gradientFile=new File(Folder.temp.fsName+"/transferify_native_gradient_"+new Date().getTime()+"_"+Math.floor(Math.random()*100000)+".ai");
      var gradientOptions=new IllustratorSaveOptions();gradientOptions.compressed=true;gradientOptions.pdfCompatible=true;
      temporary.saveAs(gradientFile,gradientOptions);result.nativeAI=gradientFile.fsName;
    }
    if(needShadow){
      // Read the actual assigned appearance from an uncompressed native copy; FXG was saving as AI.
      var nativeFile=new File(folder.fsName+"/shadow_"+new Date().getTime()+".ai"),nativeOptions=new IllustratorSaveOptions();
      nativeOptions.compressed=false;nativeOptions.pdfCompatible=true;
      temporary.saveAs(nativeFile,nativeOptions);nativeFile.encoding="BINARY";
      if(!nativeFile.open("r"))throw new Error("Native appearance copy not readable");
      var nativeData=nativeFile.read();nativeFile.close();result.shadow=Transferify._shadowFromAI(nativeData,"Transferify_x5F_Object");
      if(!result.shadow&&nativeData.indexOf("(Adobe Drop Shadow)")>=0&&Transferify._hasGradient(it))result.error="Shadow appearance not uniquely resolved";
    }
  }catch(e){result.error=String(e)+" line "+e.line;}
  finally{
    if(!session&&temporary)try{temporary.close(SaveOptions.DONOTSAVECHANGES);}catch(_close){}
    if(!session)try{sourceDoc.activate();}catch(_activate){}
    app.userInteractionLevel=oldInteraction;
    function cleanup(dir){var files=dir.getFiles();for(var i=0;i<files.length;i++){if(files[i] instanceof Folder)cleanup(files[i]);else files[i].remove();}dir.remove();}
    if(!session&&folder&&folder.exists)try{cleanup(folder);}catch(_cleanup){}
  }
  return result;
};
Transferify._aiDropShadow=function(it,svg){
  var fromSVG=Transferify._shadowFromSVG(svg,String(it.name||""));if(fromSVG)return fromSVG;
  try{
    var raw=String(it.note||"");
    if(raw.indexOf("TRANSFERIFY_SHADOW:")==0){
      if(typeof JSON=="undefined"||typeof JSON.parse!="function")return null;
      var ds=JSON.parse(raw.substring(19));
      if(ds&&ds.enabled)return ds;
    }
  }catch(_metadata){}
  return null;
};

Transferify._aiData=function(scanShadows){
  scanShadows=scanShadows===true||scanShadows=="true";
  var doc=app.activeDocument,ab=doc.artboards[doc.artboards.getActiveArtboardIndex()],ar=ab.artboardRect,orig=[],oi;
  for(oi=0;oi<doc.selection.length;oi++)orig.push(doc.selection[oi]);
  var out={artboard:{name:String(ab.name||doc.name),left:Number(ar[0]),top:Number(ar[1]),width:Number(ar[2]-ar[0]),height:Number(ar[1]-ar[3])},items:[],guides:[]};

  var shadowSVG="",appearanceSession={}; // One lazy temporary document for this selection.
  function mayHaveEffect(item){
    try{
      var visible=item.visibleBounds,geometry=item.geometricBounds,allowance=(Number(item.strokeWidth)||0)/2+0.5;
      return visible[0]<geometry[0]-allowance||visible[1]>geometry[1]+allowance||visible[2]>geometry[2]+allowance||visible[3]<geometry[3]-allowance;
    }catch(_bounds){return false;}
  }

  function pathData(p){
    var a=[];
    for(var i=0;i<p.pathPoints.length;i++){
      var q=p.pathPoints[i];
      a.push({a:[Number(q.anchor[0]),Number(q.anchor[1])],l:[Number(q.leftDirection[0]),Number(q.leftDirection[1])],r:[Number(q.rightDirection[0]),Number(q.rightDirection[1])]});
    }
    return a;
  }
  function styleOf(p){
    var s={
      filled:false,stroked:false,fill:[1,1,1],stroke:[1,1,1],strokeWidth:1,
      fillOpacity:100,strokeOpacity:100,groupOpacity:100,objectOpacity:100,
      dashes:[],dashOffset:0,lineCap:"",lineJoin:"",miterLimit:4,
      strokeAlignment:""
    };
    try{
      s.filled=!!p.filled;
      if(s.filled){
        if(p.fillColor&&p.fillColor.typename=="GradientColor"){
          try{s.fill=Transferify._rgb(p.fillColor.gradient.gradientStops[0].color);}catch(gf){}
        }else s.fill=Transferify._rgb(p.fillColor);
      }
    }catch(e){}
    try{
      s.stroked=!!p.stroked;
      s.strokeWidth=Number(p.strokeWidth)||1;
      if(s.stroked){
        if(p.strokeColor&&p.strokeColor.typename=="GradientColor"){
          try{s.stroke=Transferify._rgb(p.strokeColor.gradient.gradientStops[0].color);}catch(gs){}
        }else s.stroke=Transferify._rgb(p.strokeColor);

        try{
          var dd=p.strokeDashes;
          s.dashes=[];
          if(dd){
            if(typeof dd.length!="undefined"){
              for(var di=0;di<dd.length;di++){var dv=Number(dd[di]);if(!isNaN(dv))s.dashes.push(dv);}
            }else{
              var keys=[];for(var dk in dd)if(/^\d+$/.test(String(dk)))keys.push(Number(dk));
              keys.sort(function(a,b){return a-b;});
              for(var ki=0;ki<keys.length;ki++){var dv2=Number(dd[keys[ki]]);if(!isNaN(dv2))s.dashes.push(dv2);}
            }
          }
        }catch(de){s.dashes=[];}

        try{s.dashOffset=Number(p.strokeDashOffset)||0;}catch(doff){}
        try{s.lineCap=String(p.strokeCap||"");}catch(cap){}
        try{s.lineJoin=String(p.strokeJoin||"");}catch(join){}
        try{s.miterLimit=Number(p.strokeMiterLimit)||4;}catch(ml){}
      }
    }catch(e2){}

    /* Illustrator exposes object opacity reliably. If only one paint exists,
       map it directly to the corresponding AE native appearance opacity. */
    try{
      var op=Number(p.opacity);
      if(isNaN(op))op=100;
      op=Math.max(0,Math.min(100,op));
      s.objectOpacity=op;
    }catch(_op){}

    /* Metadata only. AE Shape Stroke has no true Inside/Outside equivalent. */
    try{s.strokeAlignment=String(p.strokeAlignment||"");}catch(_sa){}

    return s;
  }
  function textRuns(tf,text){
    var runs=[],chars=tf.characters,lim=Math.min(chars.length,text.length),start=0,last=null;
    function st(i){
      try{
        var ca=chars[i].characterAttributes;
        return{font:ca.textFont?String(ca.textFont.name):"",size:Number(ca.size)||12,applyFill:(ca.fillColor&&ca.fillColor.typename!="NoColor"),fill:Transferify._rgb(ca.fillColor),applyStroke:(ca.strokeColor&&ca.strokeColor.typename!="NoColor"&&Number(ca.strokeWeight)>0),stroke:Transferify._rgb(ca.strokeColor),strokeWidth:Number(ca.strokeWeight)||0,tracking:Number(ca.tracking)||0,hscale:(Number(ca.horizontalScale)||100)/100,vscale:(Number(ca.verticalScale)||100)/100};
      }catch(e){return last||{font:"",size:12,applyFill:true,fill:[1,1,1],applyStroke:false,stroke:[0,0,0],strokeWidth:0,tracking:0,hscale:1,vscale:1};}
    }
    function same(a,b){return a&&b&&a.font==b.font&&a.size==b.size&&a.applyFill==b.applyFill&&a.applyStroke==b.applyStroke&&a.strokeWidth==b.strokeWidth&&a.tracking==b.tracking&&a.hscale==b.hscale&&a.vscale==b.vscale&&String(a.fill)==String(b.fill)&&String(a.stroke)==String(b.stroke);}
    for(var z=0;z<lim;z++){
      var s=st(z);
      if(last===null){last=s;start=z;}
      else if(!same(last,s)){runs.push({start:start,end:z,font:last.font,size:last.size,applyFill:last.applyFill,fill:last.fill,applyStroke:last.applyStroke,stroke:last.stroke,strokeWidth:last.strokeWidth,tracking:last.tracking,hscale:last.hscale,vscale:last.vscale});start=z;last=s;}
    }
    if(last&&start<lim)runs.push({start:start,end:lim,font:last.font,size:last.size,applyFill:last.applyFill,fill:last.fill,applyStroke:last.applyStroke,stroke:last.stroke,strokeWidth:last.strokeWidth,tracking:last.tracking,hscale:last.hscale,vscale:last.vscale});
    return runs;
  }
  function exportEmbedded(it,index){
    var nm=Transferify._safeName(Transferify._itemName(it,"Embedded_"+(index+1)),"Embedded_"+(index+1));
    var f=new File(Folder.temp.fsName+"/transferify_embedded_"+(new Date().getTime())+"_"+index+"_"+nm+".png");
    try{
      if(typeof doc.exportSelectionAsPNG=="function"){
        doc.selection=null;it.selected=true;doc.exportSelectionAsPNG(f);
        if(f.exists)return f.fsName;
      }
    }catch(e){}
    return "";
  }

  function detectPrimitive(p){
    try{
      if(!p.closed)return null;
      var pts=p.pathPoints,n=pts.length,tol=0.05;
      function eq(a,b){return Math.abs(Number(a)-Number(b))<=tol;}
      function handleZero(q){
        return eq(q.anchor[0],q.leftDirection[0])&&eq(q.anchor[1],q.leftDirection[1])&&
               eq(q.anchor[0],q.rightDirection[0])&&eq(q.anchor[1],q.rightDirection[1]);
      }
      var gb=p.geometricBounds,left=Number(gb[0]),top=Number(gb[1]),right=Number(gb[2]),bottom=Number(gb[3]);
      var w=Math.abs(right-left),hh=Math.abs(top-bottom),cx=(left+right)/2,cy=(top+bottom)/2;

      /* Exact axis-aligned rectangle: four corner anchors and no Bezier handles. */
      if(n==4){
        var corners=0,allZero=true;
        for(var i=0;i<4;i++){
          var a=pts[i].anchor;
          if((eq(a[0],left)||eq(a[0],right))&&(eq(a[1],top)||eq(a[1],bottom)))corners++;
          if(!handleZero(pts[i]))allZero=false;
        }
        if(corners==4&&allZero)return {kind:"rectangle",center:[cx,cy],size:[w,hh],roundness:0};

        /* Canonical axis-aligned ellipse: four anchors at side midpoints, with handles. */
        var mids=0,hasHandles=true;
        for(var e=0;e<4;e++){
          var ea=pts[e].anchor;
          var isMid=(eq(ea[0],cx)&&(eq(ea[1],top)||eq(ea[1],bottom)))||
                    (eq(ea[1],cy)&&(eq(ea[0],left)||eq(ea[0],right)));
          if(isMid)mids++;
          if(handleZero(pts[e]))hasHandles=false;
        }
        if(mids==4&&hasHandles)return {kind:"ellipse",center:[cx,cy],size:[w,hh],roundness:0};
      }

      /* Canonical rounded rectangle: 8 anchors, two on each outer edge.
         Radius is inferred from the anchor offset from the nearest corner. */
      if(n==8){
        var edgeCount=0,topPts=[],bottomPts=[],leftPts=[],rightPts=[];
        for(var r=0;r<8;r++){
          var ra=pts[r].anchor;
          if(eq(ra[1],top)){topPts.push(ra);edgeCount++;}
          else if(eq(ra[1],bottom)){bottomPts.push(ra);edgeCount++;}
          else if(eq(ra[0],left)){leftPts.push(ra);edgeCount++;}
          else if(eq(ra[0],right)){rightPts.push(ra);edgeCount++;}
        }
        if(edgeCount==8&&topPts.length==2&&bottomPts.length==2&&leftPts.length==2&&rightPts.length==2){
          var rad=Math.min(
            Math.abs(Number(topPts[0][0])-left),Math.abs(right-Number(topPts[0][0])),
            Math.abs(Number(topPts[1][0])-left),Math.abs(right-Number(topPts[1][0])),
            Math.abs(Number(leftPts[0][1])-top),Math.abs(bottom-Number(leftPts[0][1])),
            Math.abs(Number(leftPts[1][1])-top),Math.abs(bottom-Number(leftPts[1][1]))
          );
          if(rad>tol&&rad<=Math.min(w,hh)/2+tol)
            return {kind:"rectangle",center:[cx,cy],size:[w,hh],roundness:rad};
        }
      }
    }catch(_prim){}
    return null;
  }

  function visibleRoundedPrimitive(p){
    var original=detectPrimitive(p);
    if(!original||original.kind!="rectangle"||original.roundness||mayHaveEffect(p))return original;
    var saved=[],dupe=null,expanded=[],answer=original;
    for(var si=0;si<doc.selection.length;si++)saved.push(doc.selection[si]);
    try{
      dupe=p.duplicate();doc.selection=null;dupe.selected=true;
      app.executeMenuCommand("expandStyle");
      for(var ei=0;ei<doc.selection.length;ei++)expanded.push(doc.selection[ei]);
      function scan(q){
        if(q.typename=="PathItem"){
          var candidate=detectPrimitive(q);
          if(candidate&&candidate.kind=="rectangle"&&candidate.roundness>0&&
             Math.abs(candidate.size[0]-original.size[0])<0.1&&Math.abs(candidate.size[1]-original.size[1])<0.1)answer=candidate;
        }else if(q.typename=="GroupItem")for(var qi=0;qi<q.pageItems.length;qi++)scan(q.pageItems[qi]);
      }
      for(var ex=0;ex<expanded.length;ex++)scan(expanded[ex]);
    }catch(_expand){}
    finally{
      for(var er=expanded.length-1;er>=0;er--)try{expanded[er].remove();}catch(_rm){}
      if(dupe)try{dupe.remove();}catch(_dup){}
      doc.selection=null;for(var sr=0;sr<saved.length;sr++)try{saved[sr].selected=true;}catch(_restore){}
    }
    return answer;
  }

  function ser(it,index,appearanceCovered){
    try{
      if(it.typename=="PathItem"&&it.guides){
        var xs=[],ys=[];for(var pi=0;pi<it.pathPoints.length;pi++){xs.push(Number(it.pathPoints[pi].anchor[0]));ys.push(Number(it.pathPoints[pi].anchor[1]));}
        if(xs.length>=2){var x0=Math.min.apply(null,xs),x1=Math.max.apply(null,xs),y0=Math.min.apply(null,ys),y1=Math.max.apply(null,ys);
          if(Math.abs(x1-x0)<0.5)out.guides.push([1,(x0+x1)/2-ar[0]]);
          else if(Math.abs(y1-y0)<0.5)out.guides.push([0,ar[1]-(y0+y1)/2]);
        }
        return null;
      }
    }catch(_guide){}
    var x={type:String(it.typename),name:Transferify._itemName(it,String(it.typename)||"Item"),hasGradient:Transferify._hasGradient(it)};
    var needsShadow=scanShadows&&mayHaveEffect(it)&&(it.typename=="PathItem"||it.typename=="CompoundPathItem"||it.typename=="GroupItem"||it.typename=="TextFrame"),appearance=null;
    if(!appearanceCovered&&(x.hasGradient||needsShadow))appearance=Transferify._exportItemAppearance(it,doc,x.hasGradient,needsShadow,appearanceSession);
    if(x.hasGradient){
      x.gradientAIFile=appearance?appearance.nativeAI:"";x.gradientError=appearance?appearance.error:"No appearance export";
      try{x.bounds=Transferify._plainArray(it.visibleBounds,4);}catch(_gb){}
      try{
        var gc=null;
        if(it.typename=="PathItem"&&it.filled&&it.fillColor&&it.fillColor.typename=="GradientColor")gc=it.fillColor;
        else if(it.typename=="CompoundPathItem"&&it.pathItems.length&&it.pathItems[0].filled&&it.pathItems[0].fillColor&&it.pathItems[0].fillColor.typename=="GradientColor")gc=it.pathItems[0].fillColor;
        if(gc){
          x.gradient={type:String(gc.gradient.type),angle:Number(gc.angle)||0,origin:[Number(gc.origin[0]),Number(gc.origin[1])],length:Number(gc.length)||100,stops:[]};
          var gm=gc.matrix;x.gradient.matrix=[gm.mValueA,gm.mValueB,gm.mValueC,gm.mValueD,gm.mValueTX,gm.mValueTY];
          x.gradient.hiliteAngle=Number(gc.hiliteAngle)||0;x.gradient.hiliteLength=Number(gc.hiliteLength)||0;
          for(var gs=0;gs<gc.gradient.gradientStops.length;gs++){var stp=gc.gradient.gradientStops[gs];x.gradient.stops.push({ramp:Number(stp.rampPoint)||0,mid:Number(stp.midPoint)||50,opacity:isNaN(Number(stp.opacity))?100:Number(stp.opacity),color:Transferify._rgb(stp.color)});}
        }
      }catch(gmeta){}
    }
    if(it.typename=="PathItem"){
      var st=styleOf(it);x.closed=!!it.closed;x.path=pathData(it);
      try{x.primitive=(appearance&&appearance.shadow)?detectPrimitive(it):visibleRoundedPrimitive(it);}catch(_primser){x.primitive=null;}x.filled=st.filled;x.stroked=st.stroked;x.fill=st.fill;x.stroke=st.stroke;x.strokeWidth=st.strokeWidth;x.fillOpacity=st.fillOpacity;x.strokeOpacity=st.strokeOpacity;x.groupOpacity=st.groupOpacity;x.objectOpacity=st.objectOpacity;x.dashes=st.dashes;x.dashOffset=st.dashOffset;x.lineCap=st.lineCap;x.lineJoin=st.lineJoin;x.miterLimit=st.miterLimit;x.strokeAlignment=st.strokeAlignment;
    }else if(it.typename=="CompoundPathItem"){
      x.paths=[];
      for(var j=0;j<it.pathItems.length;j++){
        var p=it.pathItems[j],ps=styleOf(p);x.paths.push({closed:!!p.closed,path:pathData(p)});
        if(j===0){x.filled=ps.filled;x.stroked=ps.stroked;x.fill=ps.fill;x.stroke=ps.stroke;x.strokeWidth=ps.strokeWidth;x.fillOpacity=ps.fillOpacity;x.strokeOpacity=ps.strokeOpacity;x.groupOpacity=ps.groupOpacity;x.objectOpacity=ps.objectOpacity;x.dashes=ps.dashes;x.dashOffset=ps.dashOffset;x.lineCap=ps.lineCap;x.lineJoin=ps.lineJoin;x.miterLimit=ps.miterLimit;x.strokeAlignment=ps.strokeAlignment;}
      }
    }else if(it.typename=="GroupItem"){
      x.children=[];for(var k=0;k<it.pageItems.length;k++){var child=ser(it.pageItems[k],index*1000+k,appearanceCovered||x.hasGradient||needsShadow);if(child)x.children.push(child);}
    }else if(it.typename=="TextFrame"){
      x.text=String(it.contents);
      x.name=Transferify._textLayerName(it,x.text);
      try{
        var _tm=it.matrix,_a=Number(_tm.mValueA),_b=Number(_tm.mValueB);
        x.rotation=Math.atan2(_b,_a)*180/Math.PI;
      }catch(_rot){x.rotation=0;}
      try{x.position=[Number(it.position[0]),Number(it.position[1])];}catch(p){}
      try{x.bounds=[Number(it.visibleBounds[0]),Number(it.visibleBounds[1]),Number(it.visibleBounds[2]),Number(it.visibleBounds[3])];}catch(tb){}
      // Illustrator text bounds include font metrics; AE sourceRect uses visible glyphs.
      if(/[^\s\u0003]/.test(x.text)){
        var outlineCopy=null,outlineGroup=null;
        try{outlineCopy=it.duplicate();outlineGroup=outlineCopy.createOutline();outlineCopy=null;x.bounds=Transferify._plainArray(outlineGroup.visibleBounds,4);}
        catch(_outlineBounds){}finally{if(outlineGroup)try{outlineGroup.remove();}catch(_removeOutline){}if(outlineCopy)try{outlineCopy.remove();}catch(_removeText){}}
      }
      try{x.justification=String(it.paragraphs[0].paragraphAttributes.justification);}catch(tj){x.justification="Justification.LEFT";}
      try{x.textKind=String(it.kind);}catch(tk){x.textKind="POINTTEXT";}
      try{
        var _gb=it.geometricBounds;
        x.boxWidth=Math.abs(Number(_gb[2])-Number(_gb[0]));
        x.boxHeight=Math.abs(Number(_gb[1])-Number(_gb[3]));
      }catch(tbox){x.boxWidth=0;x.boxHeight=0;}
      try{
        var _pa=it.paragraphs[0].paragraphAttributes;
        x.paragraph={
          justification:String(_pa.justification),
          firstLineIndent:Number(_pa.firstLineIndent)||0,
          leftIndent:Number(_pa.leftIndent)||0,
          rightIndent:Number(_pa.rightIndent)||0,
          spaceBefore:Number(_pa.spaceBefore)||0,
          spaceAfter:Number(_pa.spaceAfter)||0
        };
      }catch(tpara){x.paragraph={justification:x.justification};}
      try{x.paragraph.leading=Number(it.characters[0].characterAttributes.leading)||0;}catch(tlead){x.paragraph.leading=0;}
      x.runs=textRuns(it,x.text);
    }else if(it.typename=="PlacedItem"){
      x.linked=true;try{x.file=it.file.fsName;var _fn=String(it.file.name||x.name);try{_fn=File.decode(_fn);}catch(_fd){}x.name=_fn;}catch(pf){x.file="";}try{x.bounds=Transferify._plainArray(it.geometricBounds,4);}catch(pb){}
    }else if(it.typename=="RasterItem"){
      x.linked=false;try{x.bounds=Transferify._plainArray(it.geometricBounds,4);}catch(rb){}
      try{
        var _rn=String(it.name||"");
        if(!_rn.length||_rn=="RasterItem"||_rn=="PlacedItem"){
          var _rln=String(it.layer&&it.layer.name||"");
          if(_rln.length&&!Transferify._isGenericLayerName(_rln))_rn=_rln;
        }
        x.name=(_rn.length&&_rn!="RasterItem"&&_rn!="PlacedItem")?_rn:"Embedded_"+(index+1);
      }catch(_rnm){x.name="Embedded_"+(index+1);}
      x.tempFile=exportEmbedded(it,index);
    }
    try{x.dropShadow=(appearance&&appearance.shadow)||Transferify._aiDropShadow(it,shadowSVG);}catch(_shadow){x.dropShadow=null;}
    if(!appearanceCovered&&needsShadow&&!x.dropShadow&&appearance&&appearance.error)x.appearanceWarning=appearance.error;
    return x;
  }

  try{
    for(oi=0;oi<orig.length;oi++){var item=ser(orig[oi],oi);if(item)out.items.push(item);}
    return out;
  }finally{
    if(appearanceSession.document)try{appearanceSession.document.close(SaveOptions.DONOTSAVECHANGES);}catch(_closeSession){}
    function cleanupSession(dir){var fs=dir.getFiles();for(var fi=0;fi<fs.length;fi++){if(fs[fi] instanceof Folder)cleanupSession(fs[fi]);else fs[fi].remove();}dir.remove();}
    if(appearanceSession.folder&&appearanceSession.folder.exists)try{cleanupSession(appearanceSession.folder);}catch(_sessionCleanup){}
    try{doc.activate();}catch(_original){}
    doc.selection=null;for(oi=0;oi<orig.length;oi++){try{orig[oi].selected=true;}catch(rs){}}
  }
};

Transferify._copyGradientSelection=function(data){
  var doc=app.activeDocument,orig=[],grad=[],names=[],i;
  for(i=0;i<doc.selection.length;i++)orig.push(doc.selection[i]);
  for(i=0;i<orig.length;i++)if(data.items[i]&&data.items[i].hasGradient){grad.push(orig[i]);names.push(data.items[i].name);}
  if(grad.length){
    try{doc.selection=null;for(i=0;i<grad.length;i++)grad[i].selected=true;app.executeMenuCommand("copy");}catch(e){}
    doc.selection=null;for(i=0;i<orig.length;i++){try{orig[i].selected=true;}catch(rs){}}
  }
  return names;
};

/* ---------- SELF-CONTAINED AE RECEIVER ---------- */
Transferify._receiveAI=function(data,requestedFolder,gradientNames){
  function trackProjectItems(currentComp){
    var known={},done=false,target=null;
    for(var i=1;i<=app.project.numItems;i++){var item=app.project.item(i);known[item.id]=true;if(item instanceof FolderItem&&item.name=='TRANSFER'&&(!target||(target.parentFolder==app.project.rootFolder&&item.parentFolder!=app.project.rootFolder)))target=item;}
    function folder(){if(!target)target=app.project.items.addFolder('TRANSFER');return target;}
    var finish=function(){if(done)return;done=true;var incoming=[],folders=[];for(var i=1;i<=app.project.numItems;i++){var item=app.project.item(i);if(!known[item.id]){if(item instanceof FolderItem)folders.push(item);else{var solid=false;try{solid=item instanceof FootageItem&&item.mainSource instanceof SolidSource;}catch(_solid){}if(!solid)incoming.push(item);}}}var destination=folder();for(var j=0;j<incoming.length;j++)incoming[j].parentFolder=destination;for(var k=folders.length-1;k>=0;k--){var f=folders[k];if(f==destination||f.name=='Solids')continue;if(!f.numItems)f.remove();else f.parentFolder=destination;}};
    finish.folder=folder;
    finish.findImage=function(name,originalPhoto){if(!target)return null;for(var i=1;i<=app.project.numItems;i++){var item=app.project.item(i);if(!(item instanceof FootageItem)||item.parentFolder!=target)continue;var comment=String(item.comment||''),isOriginal=comment.indexOf('TRANSFERIFY_PHOTO_ORIGINAL')>=0;if(isOriginal!==(originalPhoto===true))continue;if(item.name==name||comment.split(String.fromCharCode(10))[0]=='TRANSFERIFY_IMAGE:'+name)return item;}return null;};
    finish.confirmImage=function(name){
      var dialog=new Window('dialog','Transferify');
      dialog.orientation='column';dialog.alignChildren='fill';dialog.margins=20;dialog.spacing=14;
      var message=dialog.add('statictext',undefined,'A imagem "'+name+'" já existe em TRANSFER. Substituir atualiza todas as camadas que usam essa imagem. Criar cópia mantém a anterior e importa a nova.',{multiline:true});
      message.preferredSize=[430,70];
      var row=dialog.add('group');row.alignment='right';row.spacing=10;
      function choice(label,result){
        var button=row.add('button',undefined,label);
        button.onClick=function(){dialog.close(result);};
        return button;
      }
      var reuse=choice('Usar a mesma',1);
      choice('Substituir',2);
      choice('Criar uma cópia',3);
      dialog.defaultElement=reuse;dialog.cancelElement=reuse;
      var result=dialog.show();
      return result==2?'replace':result==3?'copy':'reuse';
    };
    return finish;
  }
  var finishProjectItems=null;
  var applyShadow=function(layer,ds){
  if(!layer||!ds||!ds.enabled)return false;
  try{
    var styles=layer.property("ADBE Layer Styles"),shadow=styles?styles.property("dropShadow/enabled"):null;
    if(shadow&&!shadow.canSetEnabled){
      var c=layer.containingComp,saved=[];
      for(var i=1;i<=c.numLayers;i++){var sl=c.layer(i);if(sl.selected)saved.push(sl);sl.selected=false;}
      try{c.openInViewer();layer.selected=true;var command=app.findMenuCommandId("Drop Shadow");if(command>0)app.executeCommand(command);}
      finally{layer.selected=false;for(var j=0;j<saved.length;j++)try{saved[j].selected=true;}catch(_selection){}}
      styles=layer.property("ADBE Layer Styles");shadow=styles?styles.property("dropShadow/enabled"):null;
    }
    if(shadow&&shadow.canSetEnabled){
      shadow.enabled=true;
      function set(name,value){var prop=shadow.property(name);if(prop)prop.setValue(value);}
      set("dropShadow/color",ds.color||[0,0,0]);set("dropShadow/opacity",Math.max(0,Math.min(100,Number(ds.opacity))));
      set("dropShadow/useGlobalAngle",0);set("dropShadow/localLightingAngle",Number(ds.angle));
      set("dropShadow/distance",Number(ds.distance));set("dropShadow/chokeMatte",0);set("dropShadow/blur",Number(ds.size)||0);return true;
    }
    var effects=layer.property("ADBE Effect Parade"),effect=effects.addProperty("ADBE Drop Shadow");
    effect.property("ADBE Drop Shadow-0001").setValue(ds.color||[0,0,0]);
    var op=effect.property("ADBE Drop Shadow-0002");op.setValue(Math.max(0,Math.min(100,Number(ds.opacity)))*(op.maxValue==255?2.55:1));
    effect.property("ADBE Drop Shadow-0003").setValue((270-Number(ds.angle)+360)%360);
    effect.property("ADBE Drop Shadow-0004").setValue(Number(ds.distance));effect.property("ADBE Drop Shadow-0005").setValue((Number(ds.size)||0)*2);return true;
  }catch(_shadow){return false;}
};
  var warnings=[],_began=false;
  var resolveComp=function(){
  try{
    var viewer=app.activeViewer;
    if(viewer&&viewer.type==ViewerType.VIEWER_COMPOSITION){
      viewer.setActive();
      if(app.project&&app.project.activeItem instanceof CompItem)return app.project.activeItem;
    }
  }catch(_viewer){}
  try{if(app.project&&app.project.activeItem instanceof CompItem)return app.project.activeItem;}catch(_active){}
  return null;
};
  try{
    if(!app.project)app.newProject();
    var options={mode:'current',multiplier:1,fps:30,duration:5,parametric:true,precompGroups:false};
    try{if(app.settings.haveSetting('Transferify QA','importOptions'))options=(typeof JSON!='undefined'&&JSON.parse)?JSON.parse(app.settings.getSetting('Transferify QA','importOptions')):eval('('+app.settings.getSetting('Transferify QA','importOptions')+')');}catch(_settings){}
    // AI transfers never create a composition; creation is an explicit separate action.
    options.mode='current';
    if(!requestedFolder&&typeof options.imageFolder=='string')requestedFolder=options.imageFolder;
    var comp=resolveComp();
    if(!comp)return 'Open an After composition, or use CREATE COMP FROM ARTBOARD first.';
    app.beginUndoGroup('Transferify AI to AE');_began=true;
    finishProjectItems=trackProjectItems(options.mode=='current'?comp:null);
    if(!finishProjectItems){app.endUndoGroup();_began=false;return 'CANCELLED';}
    if(finishProjectItems.currentComp)comp=finishProjectItems.currentComp;
    try{if(options.matchFigmaAlpha&&!app.project.linearizeWorkingSpace)app.project.linearBlending=false;}catch(_alpha){}
    if(!comp){alert("Transferify: abra a composição de destino no viewer do After Effects antes de enviar.");return "NO_COMP";}
    var _insertRef=null,_newLayers=[],_groupBatches=[];
    try{if(comp.selectedLayers&&comp.selectedLayers.length)_insertRef=comp.selectedLayers[0];}catch(_ir){}

    function safeName(s,fallback){
      var src=String(s||fallback||"image"),bad='\\/:*?"<>|',out="";
      for(var i=0;i<src.length;i++){
        var ch=src.charAt(i),ok=true;
        for(var j=0;j<bad.length;j++)if(ch==bad.charAt(j)){ok=false;break;}
        out+=ok?ch:"_";
      }
      return out.length?out:String(fallback||"image");
    }
    function resolveFolder(){
      return Transferify._imageFolder(requestedFolder);
    }
    function unique(folder,name){
      var clean=safeName(name,"image.png"),base=clean,dst=new File(folder.fsName+"/"+clean),ix=1;
      while(dst.exists){
        var dot=base.lastIndexOf("."),stem=dot>=0?base.substring(0,dot):base,ext=dot>=0?base.substring(dot):"";
        dst=new File(folder.fsName+"/"+stem+"_"+(ix++)+ext);
      }
      return dst;
    }
    function pt(p){return[Number(p[0])-data.artboard.left,data.artboard.top-Number(p[1])];}
    function mk(raw){
      var s=new Shape(),v=[],inn=[],out=[];
      for(var i=0;i<raw.path.length;i++){
        var q=raw.path[i],a=pt(q.a),l=pt(q.l),r=pt(q.r);
        v.push(a);inn.push([l[0]-a[0],l[1]-a[1]]);out.push([r[0]-a[0],r[1]-a[1]]);
      }
      s.vertices=v;s.inTangents=inn;s.outTangents=out;s.closed=!!raw.closed;return s;
    }
    function appearance(c,x,compound){
      if(x.filled){
        var f=c.addProperty("ADBE Vector Graphic - Fill");
        f.property("ADBE Vector Fill Color").setValue(x.fill||[1,1,1]);
        try{
          var fop=f.property("ADBE Vector Fill Opacity");
          if(fop)fop.setValue(typeof x.fillOpacity=="number"?x.fillOpacity:100);
        }catch(_fop){}
        if(compound){try{f.property("ADBE Vector Fill Rule").setValue(2);}catch(fr){}}
      }
      if(x.stroked){
        var st=c.addProperty("ADBE Vector Graphic - Stroke");
        st.property("ADBE Vector Stroke Color").setValue(x.stroke||[1,1,1]);
        st.property("ADBE Vector Stroke Width").setValue(Number(x.strokeWidth)||1);
        try{
          var sop=st.property("ADBE Vector Stroke Opacity");
          if(sop)sop.setValue(typeof x.strokeOpacity=="number"?x.strokeOpacity:100);
        }catch(_sop){}

        try{
          var cap=String(x.lineCap||"").toLowerCase(),capVal=1;
          if(cap.indexOf("round")>=0)capVal=2;
          else if(cap.indexOf("project")>=0||cap.indexOf("square")>=0)capVal=3;
          var capProp=st.property("ADBE Vector Stroke Line Cap");
          if(capProp)capProp.setValue(capVal);
        }catch(_cap){}
        try{
          var join=String(x.lineJoin||"").toLowerCase(),joinVal=1;
          if(join.indexOf("round")>=0)joinVal=2;
          else if(join.indexOf("bevel")>=0)joinVal=3;
          var joinProp=st.property("ADBE Vector Stroke Line Join");
          if(joinProp)joinProp.setValue(joinVal);
        }catch(_join){}
        try{
          var mlp=st.property("ADBE Vector Stroke Miter Limit");
          if(mlp&&typeof x.miterLimit!="undefined")mlp.setValue(Number(x.miterLimit)||4);
        }catch(_miter){}

        try{
          var dg=st.property("ADBE Vector Stroke Dashes");
          var d=x.dashes||[];
          if(dg&&d.length){
            for(var di=0;di<d.length;di++){
              var pair=Math.floor(di/2)+1;
              var propName=(di%2==0)?"ADBE Vector Stroke Dash "+pair:"ADBE Vector Stroke Gap "+pair;
              dg=st.property("ADBE Vector Stroke Dashes");
              var dp=dg.addProperty(propName);
              if(dp)dp.setValue(Number(d[di])||0);
            }
            try{
              dg=st.property("ADBE Vector Stroke Dashes");
              var off=dg.property("ADBE Vector Stroke Offset");
              if(!off)off=dg.addProperty("ADBE Vector Stroke Offset");
              if(off)off.setValue(Number(x.dashOffset)||0);
            }catch(_off){}
          }
        }catch(_dash){}
      }
    }
    function applyGroupOpacity(g,x){
      try{
        if(typeof x.groupOpacity!="number"||x.groupOpacity>=100)return;
        var gt=g.property("ADBE Vector Transform Group");
        if(!gt)return;
        var op=gt.property("ADBE Vector Group Opacity");
        if(op)op.setValue(Math.max(0,Math.min(100,Number(x.groupOpacity))));
      }catch(_gop){}
    }
    function normalizeText(s){
      s=String(s||"");var out="",i=0;
      while(i<s.length){
        var code=s.charCodeAt(i);
        if(code==3){out+=String.fromCharCode(10);i++;continue;}
        if(code==92){
          var j=i;while(j<s.length&&s.charCodeAt(j)==92)j++;
          var ch=s.charAt(j),u=s.substr(j,5).toLowerCase(),n=0,end=j;
          if(ch=="r"){n=13;end=j+1;}
          else if(ch=="n"){n=10;end=j+1;}
          else if(u=="u0003"||u=="u000a"){n=10;end=j+5;}
          else if(u=="u000d"){n=13;end=j+5;}
          if(n){out+=String.fromCharCode(n);i=end;continue;}
        }
        out+=s.charAt(i++);
      }
      return out;
    }
    function resetCharacter(td){
      try{td.resetCharStyle();}catch(_reset){}
      try{td.fontCapsOption=FontCapsOption.FONT_NORMAL_CAPS;}catch(_caps){}
      try{td.fauxBold=false;}catch(_bold){}
      try{td.fauxItalic=false;}catch(_italic){}
    }
    function createTextLayer(x){
      var _area=false;
      try{_area=String(x.textKind||"").toUpperCase().indexOf("AREA")>=0;}catch(_atk){}
      var t;
      if(_area&&Number(x.boxWidth)>0&&Number(x.boxHeight)>0){
        try{
          t=comp.layers.addBoxText([Number(x.boxWidth),Number(x.boxHeight)]);
          var _btp=t.property("ADBE Text Properties").property("ADBE Text Document"),_btd=_btp.value;
          _btd.text=normalizeText(String(x.text||""));_btp.setValue(_btd);
        }catch(_box){t=comp.layers.addText(normalizeText(String(x.text||"")));}
      }else t=comp.layers.addText(normalizeText(String(x.text||"")));
      t.name=x.name||"Text";
      var tp=t.property("ADBE Text Properties").property("ADBE Text Document"),td=tp.value;
      resetCharacter(td);
      td.text=normalizeText(String(x.text||""));
      try{
        var j=String((x.paragraph&&x.paragraph.justification)||x.justification||"").toUpperCase();
        if(j.indexOf("CENTER")>=0)td.justification=ParagraphJustification.CENTER_JUSTIFY;
        else if(j.indexOf("RIGHT")>=0)td.justification=ParagraphJustification.RIGHT_JUSTIFY;
        else if(j.indexOf("FULL")>=0||j.indexOf("JUSTIFY")>=0){
          try{td.justification=ParagraphJustification.FULL_JUSTIFY_LASTLINE_LEFT;}catch(_fj){td.justification=ParagraphJustification.LEFT_JUSTIFY;}
        }else td.justification=ParagraphJustification.LEFT_JUSTIFY;
        try{if(x.paragraph&&Number(x.paragraph.leading)>0){td.autoLeading=false;td.leading=Number(x.paragraph.leading);}}catch(_lead){}
      }catch(justErr){}
      if(x.runs&&x.runs.length){
        var r0=x.runs[0];
        try{if(r0.font)td.font=r0.font;}catch(a){}try{td.fontSize=r0.size;}catch(b){}
        try{td.applyFill=!!r0.applyFill;if(r0.applyFill)td.fillColor=r0.fill;}catch(c){}
        try{td.applyStroke=!!r0.applyStroke;if(r0.applyStroke){td.strokeColor=r0.stroke;td.strokeWidth=r0.strokeWidth;}}catch(cs){}
        try{td.tracking=r0.tracking;}catch(d){}
      }
      tp.setValue(td);
      try{
        td=tp.value;
        if(x.runs&&typeof td.characterRange=="function"){
          var len=String(td.text).length;
          for(var rr=0;rr<x.runs.length;rr++){
            var run=x.runs[rr];if(run.end<=run.start)continue;
            var decodedStart=normalizeText(String(x.text||"").substring(0,run.start)).length;
            var decodedEnd=normalizeText(String(x.text||"").substring(0,run.end)).length;
            if(decodedEnd<=decodedStart||decodedStart>=len)continue;
            var cr=td.characterRange(decodedStart,Math.min(decodedEnd,len));
            try{if(run.font)cr.font=run.font;}catch(e1){}try{cr.fontSize=run.size;}catch(e2){}
            try{cr.applyFill=!!run.applyFill;if(run.applyFill)cr.fillColor=run.fill;}catch(e3){}
            try{cr.applyStroke=!!run.applyStroke;if(run.applyStroke){cr.strokeColor=run.stroke;cr.strokeWidth=run.strokeWidth;}}catch(e3s){}
            try{cr.tracking=run.tracking;}catch(e4){}try{cr.horizontalScale=run.hscale;}catch(e5){}try{cr.verticalScale=run.vscale;}catch(e6){}
          }
          tp.setValue(td);
        }
      }catch(range){}
      try{
        var tr=t.property("ADBE Transform Group"),pos=tr.property("ADBE Position"),angle=-Number(x.rotation||0);
        tr.property("ADBE Rotate Z").setValue(angle);
        if(x.bounds&&x.bounds.length==4){
          var desiredLeft=Number(x.bounds[0])-data.artboard.left,desiredTop=data.artboard.top-Number(x.bounds[1]);
          var sr=t.sourceRectAtTime(comp.time,false),anchor=tr.property("ADBE Anchor Point").value,scale=tr.property("ADBE Scale").value;
          var rad=angle*Math.PI/180,cos=Math.cos(rad),sin=Math.sin(rad),minX=1e20,minY=1e20;
          var corners=[[sr.left,sr.top],[sr.left+sr.width,sr.top],[sr.left,sr.top+sr.height],[sr.left+sr.width,sr.top+sr.height]];
          for(var ci=0;ci<4;ci++){
            var dx=(corners[ci][0]-anchor[0])*scale[0]/100,dy=(corners[ci][1]-anchor[1])*scale[1]/100;
            minX=Math.min(minX,cos*dx-sin*dy);minY=Math.min(minY,sin*dx+cos*dy);
          }
          pos.setValue([desiredLeft-minX,desiredTop-minY]);
        }else if(x.position)pos.setValue(pt(x.position));
      }catch(tpErr){}
      try{if(x.dropShadow&&!applyShadow(t,x.dropShadow))t.comment="TRANSFERIFY: Drop Shadow could not be applied";}catch(_tds){}
      try{_newLayers.push(t);}catch(_ntl){}
      return t;
    }

    function addNode(x,parent){
      if(x.type=="TextFrame"){
        createTextLayer(x);
      }else if(x.type=="PathItem"){
        var g=parent.addProperty("ADBE Vector Group"),cc=g.property("ADBE Vectors Group");
        g.name=x.name||"Path";
        if(options.parametric!==false&&x.primitive&&x.primitive.kind=="rectangle"){
          var rp=cc.addProperty("ADBE Vector Shape - Rect");
          rp.property("ADBE Vector Rect Size").setValue([Number(x.primitive.size[0]),Number(x.primitive.size[1])]);
          rp.property("ADBE Vector Rect Position").setValue(pt(x.primitive.center));
          try{rp.property("ADBE Vector Rect Roundness").setValue(Number(x.primitive.roundness)||0);}catch(_round){}
        }else if(options.parametric!==false&&x.primitive&&x.primitive.kind=="ellipse"){
          var ep=cc.addProperty("ADBE Vector Shape - Ellipse");
          ep.property("ADBE Vector Ellipse Size").setValue([Number(x.primitive.size[0]),Number(x.primitive.size[1])]);
          ep.property("ADBE Vector Ellipse Position").setValue(pt(x.primitive.center));
        }else{
          var p=cc.addProperty("ADBE Vector Shape - Group");
          p.property("ADBE Vector Shape").setValue(mk(x));
        }
        appearance(cc,x,false);applyGroupOpacity(g,x);
        try{if(typeof x.objectOpacity=="number")g.property("ADBE Vector Transform Group").property("ADBE Vector Group Opacity").setValue(x.objectOpacity);}catch(_nestedOp){}
      }else if(x.type=="CompoundPathItem"){
        var cg=parent.addProperty("ADBE Vector Group"),cgc=cg.property("ADBE Vectors Group");cg.name=x.name||"Compound Path";
        for(var q=0;q<x.paths.length;q++){var pp=cgc.addProperty("ADBE Vector Shape - Group");pp.name="Path "+(q+1);pp.property("ADBE Vector Shape").setValue(mk(x.paths[q]));}
        appearance(cgc,x,true);applyGroupOpacity(cg,x);
        try{if(typeof x.objectOpacity=="number")cg.property("ADBE Vector Transform Group").property("ADBE Vector Group Opacity").setValue(x.objectOpacity);}catch(_nestedCpOp){}
      }else if(x.type=="GroupItem"){
        var gg=parent.addProperty("ADBE Vector Group"),gc=gg.property("ADBE Vectors Group");gg.name=x.name||"Group";
        for(var j=0;j<x.children.length;j++)addNode(x.children[j],gc);
      }
    }
    function centerAnchor(layer){
      try{
        var tr=layer.property("ADBE Transform Group"),ap=tr.property("ADBE Anchor Point"),pos=tr.property("ADBE Position");
        var oldA=ap.value,oldP=pos.value,r=layer.sourceRectAtTime(comp.time,false),newA=[r.left+r.width/2,r.top+r.height/2];
        var sc=tr.property("ADBE Scale").value,rad=Number(tr.property("ADBE Rotate Z").value)*Math.PI/180;
        var dx=(newA[0]-oldA[0])*sc[0]/100,dy=(newA[1]-oldA[1])*sc[1]/100;
        ap.setValue(newA);pos.setValue([oldP[0]+Math.cos(rad)*dx-Math.sin(rad)*dy,oldP[1]+Math.sin(rad)*dx+Math.cos(rad)*dy]);
      }catch(e){}
    }
    function pasteGradients(){
      if(!gradientNames||!gradientNames.length)return 0;
      try{
        var id=app.findMenuCommandId("Paste");if(!id)id=20,before=comp.numLayers;
        try{$.sleep(120);}catch(_sl){}
        app.executeCommand(id);
        var added=comp.numLayers-before;
        if(added<=0){try{$.sleep(250);}catch(_sl2){}app.executeCommand(id);added=comp.numLayers-before;}
        var sel=comp.selectedLayers;
        if(added>0){
          var gi=0;
          for(var i=0;i<sel.length;i++)if(sel[i] instanceof ShapeLayer){
            var gl=sel[i];if(gi<gradientNames.length)gl.name=gradientNames[gi];
            centerAnchor(gl);
            /* Native paste often centers the gradient shape; restore AI visual center. */
            try{
              var target=null;
              for(var di=0;di<data.items.length;di++)if(data.items[di].hasGradient&&String(data.items[di].name)==String(gradientNames[gi])){target=data.items[di];break;}
              if(target&&target.bounds&&target.bounds.length==4){
                gl.property("ADBE Transform Group").property("ADBE Position").setValue([
                  (Number(target.bounds[0])+Number(target.bounds[2]))/2-data.artboard.left,
                  data.artboard.top-(Number(target.bounds[1])+Number(target.bounds[3]))/2
                ]);
              }
            }catch(_gpos){}
            try{_newLayers.push(gl);}catch(_ngl){}
            gi++;
          }
        }
        return added;
      }catch(e){return 0;}
    }
    function cleanNativeGradient(layer,x){
      if((x.type!='PathItem'&&x.type!='CompoundPathItem')||!x.gradient)return false;
      var root=layer.property('ADBE Root Vectors Group');if(root.numProperties!=1||root.property(1).matchName!='ADBE Vector Group')return false;
      var group=root.property(1),contents=group.property('ADBE Vectors Group'),gradIndex=0,count=0;
      for(var i=1;i<=contents.numProperties;i++)if(contents.property(i).matchName=='ADBE Vector Graphic - G-Fill'){gradIndex=i;count++;}
      if(count!=1)return false;
      var gt=group.property('ADBE Vector Transform Group');
      function mul(a,b){return[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
      function rot(a){a*=Math.PI/180;return[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0];}
      var a=gt.property('ADBE Vector Anchor').value,p=gt.property('ADBE Vector Position').value,s=gt.property('ADBE Vector Scale').value,axis=gt.property('ADBE Vector Skew Axis').value,skew=gt.property('ADBE Vector Skew').value;
      var m=mul([1,0,0,1,p[0],p[1]],rot(gt.property('ADBE Vector Rotation').value));m=mul(m,rot(axis));m=mul(m,[1,0,-Math.tan(skew*Math.PI/180),1,0,0]);m=mul(m,rot(-axis));m=mul(m,[s[0]/100,0,0,s[1]/100,0,0]);m=mul(m,[1,0,0,1,-a[0],-a[1]]);
      var det=m[0]*m[3]-m[1]*m[2];if(Math.abs(det)<0.0000001)return false;
      function local(point){var q=layer.compPointToSource(pt(point)),xx=q[0]-m[4],yy=q[1]-m[5];return[(m[3]*xx-m[2]*yy)/det,(-m[1]*xx+m[0]*yy)/det];}
      // Preserve Adobe's native stop data, but replace PDF clipping/helper paths with source geometry.
      for(var i=contents.numProperties;i>=1;i--){var mn=contents.property(i).matchName;if(mn=='ADBE Vector Shape - Group'||mn=='ADBE Vector Filter - Merge')contents.property(i).remove();}
      var raws=x.type=='PathItem'?[x]:x.paths;
      for(var ri=0;ri<raws.length;ri++){
        var raw=raws[ri],shape=new Shape(),v=[],it=[],ot=[];
        for(var vi=0;vi<raw.path.length;vi++){var q=raw.path[vi],aa=local(q.a),ll=local(q.l),rr=local(q.r);v.push(aa);it.push([ll[0]-aa[0],ll[1]-aa[1]]);ot.push([rr[0]-aa[0],rr[1]-aa[1]]);}
        shape.vertices=v;shape.inTangents=it;shape.outTangents=ot;shape.closed=!!raw.closed;
        var path=contents.addProperty('ADBE Vector Shape - Group');path.property('ADBE Vector Shape').setValue(shape);path.moveTo(ri+1);
      }
      return true;
    }

    function nativeGradient(x){
      if(!x.gradientAIFile){x.gradientError=x.gradientError||"Illustrator returned no native gradient file";return null;}
      if(parseFloat(app.version)<26){x.gradientError="Native Illustrator gradients require AE 26+";return null;}
      var file=null,imported=null,created=[],before=[],answer=null,vectorLayer=null;
      for(var bi=1;bi<=app.project.numItems;bi++)before.push(app.project.item(bi).id);
      try{
        file=new File(x.gradientAIFile);if(!file.exists)throw new Error("Native Illustrator gradient file unavailable");
        var options=new ImportOptions(file);options.importAs=ImportAsType.FOOTAGE;
        imported=app.project.importFile(options);if(!(imported instanceof FootageItem))throw new Error("Native Illustrator import returned no footage");
        var selected=comp.selectedLayers;for(var si=0;si<selected.length;si++)selected[si].selected=false;
        vectorLayer=comp.layers.add(imported);vectorLayer.selected=true;comp.openInViewer();
        // Some localized After Effects installations do not resolve the English menu label.
        var convertID=app.findMenuCommandId("Create Shapes from Vector Layer")||3973;
        var layerIDs=[];for(var pi=1;pi<=comp.numLayers;pi++)layerIDs.push(comp.layer(pi).id);
        app.executeCommand(convertID);
        function hasGradient(contents){for(var gi=1;gi<=contents.numProperties;gi++){var prop=contents.property(gi);if(prop.matchName=="ADBE Vector Graphic - G-Fill"||prop.matchName=="ADBE Vector Graphic - G-Stroke")return true;if(prop.matchName=="ADBE Vector Group"&&hasGradient(prop.property("ADBE Vectors Group")))return true;}return false;}
        for(var li=1;li<=comp.numLayers;li++){
          var candidate=comp.layer(li),known=false;for(var ki=0;ki<layerIDs.length;ki++)if(candidate.id==layerIDs[ki])known=true;
          if(!known){created.push(candidate);if(candidate instanceof ShapeLayer&&hasGradient(candidate.property("ADBE Root Vectors Group"))){if(answer)throw new Error("Native conversion produced multiple gradient layers");answer=candidate;}}
        }
        vectorLayer.remove();vectorLayer=null;
        for(var restore=0;restore<selected.length;restore++)try{selected[restore].selected=true;}catch(_selection){}
        if(!answer)throw new Error("Native conversion produced no editable Gradient Fill/Stroke");
        if(answer.property("ADBE Mask Parade").numProperties||answer.property("ADBE Effect Parade").numProperties)throw new Error("Native gradient conversion required masks or effects");
        answer.name=x.name||"Gradient";
        if(!cleanNativeGradient(answer,x))warnings.push('Gradiente '+x.name+': complex native conversion retained; geometry cleanup unavailable');
        // AE 26's Illustrator converter adds a half-turn to radial gradients,
        // mirroring off-centre origins. Remove that conversion-only rotation.
        function fixRadial(g){for(var gi=1;gi<=g.numProperties;gi++){var prop=g.property(gi);if(prop.matchName=='ADBE Vector Group')fixRadial(prop.property('ADBE Vectors Group'));else if(prop.matchName=='ADBE Vector Graphic - G-Fill'&&prop.property('ADBE Vector Grad Type').value==2){var rotation=prop.property('ADBE Vector Grad Rotation');if(rotation)rotation.setValue(Number(rotation.value)-180);}}}
        fixRadial(answer.property('ADBE Root Vectors Group'));
        centerAnchor(answer);
        var r=answer.sourceRectAtTime(comp.time,false),tr=answer.property("ADBE Transform Group"),pos=tr.property("ADBE Position"),old=pos.value;
        var corners=[[r.left,r.top],[r.left+r.width,r.top],[r.left,r.top+r.height],[r.left+r.width,r.top+r.height]],minX=1e20,minY=1e20;
        for(var corner=0;corner<4;corner++){var q=answer.sourcePointToComp(corners[corner]);minX=Math.min(minX,q[0]);minY=Math.min(minY,q[1]);}
        if(x.bounds)pos.setValue([old[0]+Number(x.bounds[0])-data.artboard.left-minX,old[1]+data.artboard.top-Number(x.bounds[1])-minY]);
        if(x.dropShadow)applyShadow(answer,x.dropShadow);_newLayers.push(answer);return answer;
      }catch(_gradient){x.gradientError=String(_gradient)+" line "+_gradient.line;for(var ci=0;ci<created.length;ci++)try{created[ci].remove();}catch(_remove){}return null;}
      finally{
        try{if(vectorLayer){vectorLayer.remove();vectorLayer=null;}}catch(_vector){}
        for(var cleanup=app.project.numItems;cleanup>=1;cleanup--){
          var item=app.project.item(cleanup),exists=false;for(var bk=0;bk<before.length;bk++)if(before[bk]==item.id)exists=true;
          if(!exists)try{item.remove();}catch(_import){}
        }
        try{if(vectorLayer)vectorLayer.remove();}catch(_vector){}
        try{if(file){file.close();file.remove();}}catch(_file){}
      }
    }
    function reportPendingGradient(layer,x){
      if(!x.hasGradient)return;
      layer.comment="TRANSFERIFY: native gradient conversion unavailable for this item";
      warnings.push("Gradiente "+x.name+": "+(x.gradientError||"Unknown import failure"));
    }
    function imagePos(b){return[(b[0]+b[2])/2-data.artboard.left,data.artboard.top-(b[1]+b[3])/2];}
    function fileBytes(file){
      file.encoding="BINARY";if(!file.open("r"))throw new Error("Cannot read "+file.fsName);
      try{return file.read();}finally{file.close();}
    }
    function comparablePNG(bytes){
      if(bytes.length<8||bytes.substr(1,3)!="PNG")return bytes;
      var result=bytes.substr(0,8),i=8;
      while(i+12<=bytes.length){
        var size=0;for(var k=0;k<4;k++)size=size*256+bytes.charCodeAt(i+k);
        if(size<0||i+size+12>bytes.length)return bytes;
        var type=bytes.substr(i+4,4);
        if(type!="tIME"&&type!="tEXt"&&type!="zTXt"&&type!="iTXt")result+=bytes.substr(i,size+12);
        i+=size+12;
      }
      return i==bytes.length?result:bytes;
    }
    function sameImage(a,b,isTemp){
      if(String(a.fsName)==String(b.fsName))return true;
      if(!a.exists||!b.exists)return false;
      if(!isTemp&&a.length!=b.length)return false;
      try{
        var aa=fileBytes(a),bb=fileBytes(b);
        return isTemp?comparablePNG(aa)==comparablePNG(bb):aa==bb;
      }catch(_compare){return false;}
    }
    function importImage(srcPath,name,bounds,isTemp){
      var src=new File(srcPath);if(!src.exists)throw new Error("Image not found: "+srcPath);
      var foot=finishProjectItems.findImage(String(name||"")),identical=false,tag="TRANSFERIFY_IMAGE:"+String(name||""),sourceTag=tag+String.fromCharCode(10)+"SOURCE:"+(isTemp?"EMBEDDED:"+String(name||""):String(src.fsName));
      if(!foot){
        for(var ui=1;ui<=app.project.numItems;ui++){
          var prior=app.project.item(ui);if(!(prior instanceof FootageItem)||prior.parentFolder!=finishProjectItems.folder())continue;
          var comment=String(prior.comment||""),legacyName=String(prior.name||"");
          if(comment==sourceTag||comment==tag||(!comment&&legacyName==String(name||""))){foot=prior;break;}
        }
      }
      var makeCopy=false;
      if(foot){
        // Also ask on an identical resend: users can explicitly reload a recently updated asset.
        var action=finishProjectItems.confirmImage(name);
        if(action=="replace"){
          var updateFolder=resolveFolder();if(!updateFolder)return;
          var updateExt=src.name.substr(src.name.lastIndexOf(".")),updateName=safeName(name||"image","image");
          if(updateName.toLowerCase().substr(-updateExt.length)!=updateExt.toLowerCase())updateName+=updateExt;
          var updateFile=unique(updateFolder,updateName);
          if(!src.copy(updateFile.fsName))throw new Error("Could not copy updated image");
          foot.replace(updateFile);foot.comment=sourceTag;
        }else if(action=="copy"){makeCopy=true;foot=null;}
        else if(!String(foot.comment||""))foot.comment=sourceTag;
      }
      if(!foot){
        var folder=resolveFolder();if(!folder)return;
        var dot=src.name.lastIndexOf("."),ext=dot>=0?src.name.substring(dot):".png";
        var filename=safeName(name||"image","image");
        if(filename.toLowerCase().substr(-ext.length)!=ext.toLowerCase())filename+=ext;
        var dst=new File(folder.fsName+"/"+filename);
        if(makeCopy)dst=unique(folder,filename.substring(0,filename.length-ext.length)+"_copy"+ext);
        else if(dst.exists&&!sameImage(src,dst,isTemp))dst=unique(folder,filename);
        if(!dst.exists&&!src.copy(dst.fsName))throw new Error("Could not copy image");
        foot=app.project.importFile(new ImportOptions(dst));
        foot.comment=makeCopy?"TRANSFERIFY_IMAGE:"+foot.name:sourceTag;
        foot.parentFolder=finishProjectItems.folder();
      }
      var lay=comp.layers.add(foot);lay.name=name||foot.name;
      if(bounds){
        var bw=Math.abs(bounds[2]-bounds[0]),bh=Math.abs(bounds[1]-bounds[3]);
        lay.property("ADBE Transform Group").property("ADBE Position").setValue(imagePos(bounds));
        if(foot.width&&foot.height)lay.property("ADBE Transform Group").property("ADBE Scale").setValue([bw/foot.width*100,bh/foot.height*100]);
      }
      if(isTemp)try{src.remove();}catch(_temp){}
      _newLayers.push(lay);return lay;
    }

    var readGuides=function(comp){
  var out=[],gs=comp.guides||[];
  for(var i=0;i<gs.length;i++){
    var g=gs[i],orientation=Number(g.orientationType!==undefined?g.orientationType:g.orientation),position=Number(g.position),modern=false;
    try{if(typeof GuideOrientationType!="undefined"){if(orientation!=0&&orientation!=1)orientation=g.orientationType==GuideOrientationType.VERTICAL?1:0;modern=true;}}catch(_enum){}
    var extent=orientation==1?comp.width:comp.height;
    try{if(modern&&g.positionType==GuidePositionType.PERCENTAGE)position=position*extent/100;}catch(_percent){}
    if(g.pinned===true)position=extent-position;
    out.push([orientation,position]);
  }
  return out;
};
    var addGuides=function(comp,guides){
  var made=0,existing=readGuides(comp);
  for(var i=0;i<guides.length;i++){
    var o=Number(guides[i][0]),p=Number(guides[i][1])*options.multiplier,found=false;
    for(var j=0;j<existing.length;j++)if(existing[j][0]==o&&Math.abs(existing[j][1]-p)<0.5){found=true;break;}
    if(found)continue;
    comp.addGuide(o,p); // Stable pixel API: 0 horizontal, 1 vertical.
    existing.push([o,p]);made++;
  }
  return made;
};
    if(!_began){app.beginUndoGroup("Transferify AI to AE");_began=true;}
    if(data.guides&&data.guides.length)addGuides(comp,data.guides);
    var pasted=pasteGradients();

    for(var n=data.items.length-1;n>=0;n--){
      var x=data.items[n],_batchStart=_newLayers.length;
      if(x.appearanceWarning)warnings.push("Sombra/aparência "+x.name+": "+x.appearanceWarning);
      if(pasted>0&&x.hasGradient)continue;

      if(x.hasGradient&&nativeGradient(x))continue;
      if(x.type=="PathItem"||x.type=="CompoundPathItem"||x.type=="GroupItem"){
        var l=comp.layers.addShape();l.name=x.name||"Shape";
        l.property("ADBE Transform Group").property("ADBE Anchor Point").setValue([0,0]);
        l.property("ADBE Transform Group").property("ADBE Position").setValue([0,0]);
        var originalOpacity=x.objectOpacity;x.objectOpacity=100;
        addNode(x,l.property("ADBE Root Vectors Group"));x.objectOpacity=originalOpacity;
        if(typeof originalOpacity=="number")l.property("ADBE Transform Group").property("ADBE Opacity").setValue(originalOpacity);
        centerAnchor(l);reportPendingGradient(l,x);try{if(x.dropShadow&&!applyShadow(l,x.dropShadow))l.comment="TRANSFERIFY: Drop Shadow could not be applied";}catch(_dsl){}
        try{_newLayers.push(l);}catch(_nsl){}
      }else if(x.type=="TextFrame"){
        createTextLayer(x);
      }else if(x.type=="PlacedItem"&&x.file){
        importImage(x.file,x.name,x.bounds,false);
      }else if(x.type=="RasterItem"&&x.tempFile){
        importImage(x.tempFile,x.name,x.bounds,true);
      }
      if(options.precompGroups&&x.type=='GroupItem'&&_newLayers.length>_batchStart){var groupIDs=[];for(var oi=_batchStart;oi<_newLayers.length;oi++)groupIDs.push(_newLayers[oi].id);_groupBatches.push({name:x.name||'Group',ids:groupIDs});}
    }
    var newIDs=[];for(var li=0;li<_newLayers.length;li++)newIDs.push(_newLayers[li].id);
    for(var bi=0;bi<_groupBatches.length;bi++){var batch=_groupBatches[bi],indices=[],member={};for(var bj=0;bj<batch.ids.length;bj++)member[batch.ids[bj]]=true;for(var bj=1;bj<=comp.numLayers;bj++)if(member[comp.layer(bj).id])indices.push(bj);if(!indices.length)continue;var sub=comp.layers.precompose(indices,batch.name,true),pl=null;for(var bj=1;bj<=comp.numLayers;bj++){try{if(comp.layer(bj).source.id==sub.id){pl=comp.layer(bj);break;}}catch(_source){}}var next=[],added=false;for(var bj=0;bj<newIDs.length;bj++){if(member[newIDs[bj]]){if(pl&&!added){next.push(pl.id);added=true;}}else next.push(newIDs[bj]);}if(pl)try{pl.collapseTransformation=true;}catch(_){}newIDs=next;}
    _newLayers=[];for(var ni=0;ni<newIDs.length;ni++)for(var li=1;li<=comp.numLayers;li++)if(comp.layer(li).id==newIDs[ni]){_newLayers.push(comp.layer(li));break;}
    if(options.multiplier!=1&&_newLayers.length){var scaleControl=comp.layers.addNull();scaleControl.name='Illustrator / '+options.multiplier+'×';scaleControl.guideLayer=true;scaleControl.shy=true;scaleControl.comment='Transferify Illustrator scale';var tr=scaleControl.property('ADBE Transform Group');tr.property('ADBE Anchor Point').setValue([0,0]);tr.property('ADBE Position').setValue([0,0]);for(var si=0;si<_newLayers.length;si++)if(!_newLayers[si].parent)_newLayers[si].parent=scaleControl;tr.property('ADBE Scale').setValue([options.multiplier*100,options.multiplier*100]);}
    try{
      if(_insertRef){
        for(var _mi=0;_mi<_newLayers.length;_mi++){
          var _ml=_newLayers[_mi];
          if(_ml&&_ml!==_insertRef)try{_ml.moveBefore(_insertRef);}catch(_mvb){}
        }
      }
    }catch(_place){}
    if(finishProjectItems)finishProjectItems();
    app.endUndoGroup();_began=false;if(warnings.length)alert("Transferify — itens pendentes:\n"+warnings.join("\n"));
    return "OK";
  }catch(e){
    if(finishProjectItems)try{finishProjectItems();}catch(_folder){}
    if(_began)try{app.endUndoGroup();}catch(end){}
    alert("Transferify AI → AE: "+e.toString()+" | Line: "+e.line);return "ERROR";
  }
};

Transferify.sendToAE=function(folderPath,scanShadows){
  if(Transferify._host()!="ai")return "SEND TO AE • Illustrator only";
  try{
    if(!app.documents.length||!app.activeDocument.selection.length)return "Select shape/text/image";
    var data=Transferify._aiData(scanShadows);
    if(!data.items.length)return "SEND TO AE • no supported objects";
    var packet=new File(Folder.temp.fsName+"/transferify-ai-ae-"+new Date().getTime()+"-"+Math.floor(Math.random()*1000000000)+".txt");
    packet.encoding="ASCII";
    if(!packet.open("w"))throw Error("Cannot create transfer packet: "+packet.error);
    try{
      if(!packet.write(Transferify._encodePayload(data)))throw Error("Cannot write transfer packet: "+packet.error);
    }finally{packet.close();}
    var body="(function(){var packet=new File("+Transferify._quote(packet.fsName)+");"+
      "try{packet.encoding='ASCII';if(!packet.open('r'))throw Error('Cannot read transfer packet: '+packet.error);"+
      "var payload;try{payload=packet.read();}finally{packet.close();}"+
      "$.evalFile(new File("+Transferify._quote(Transferify._hostScriptPath)+"));"+
      "return Transferify._receiveAI(Transferify._decodePayload(payload),"+Transferify._quote(folderPath)+",[]);"+
      "}finally{try{packet.remove();}catch(_cleanup){}}})();";
    if(!Transferify._send("aftereffects",body)){
      packet.remove();
      return "ERROR • AE not reachable";
    }
    return "SEND TO AE • awaiting After Effects";
  }catch(e){return "ERROR "+e.number+": "+e.message+" line "+e.line;}
};

/* ---------- AE LOCAL SERIALIZER ---------- */
Transferify._captureAECurrentFrame=function(layer,white){
  var comp=layer.containingComp,copy=null,whiteSource=null,backdropSource=null;
  var output=new File(Folder.temp.fsName+'/transferify_frame_'+new Date().getTime()+'_'+Math.floor(Math.random()*1000000000)+'.png');
  var previous=app.project.activeItem;
  try{
    copy=comp.duplicate();
    var target=copy.layer(layer.index);
    for(var i=1;i<=copy.numLayers;i++)copy.layer(i).solo=false;
    target.enabled=true;target.guideLayer=false;target.solo=true;
    if(white){
      var temporary=copy.layers.addSolid([1,1,1],'__Transferify white mask__',layer.source.width,layer.source.height,layer.source.pixelAspect,copy.duration);
      whiteSource=temporary.source;temporary.remove();target.replaceSource(whiteSource,false);
      var backdrop=copy.layers.addSolid([0,0,0],'__Transferify mask background__',comp.width,comp.height,comp.pixelAspect,copy.duration);
      var backdropSource=backdrop.source;backdrop.moveToEnd();backdrop.solo=true;

    }
    copy.openInViewer();
    copy.saveFrameToPng(comp.time,output);
    // AE can return before its PNG writer finishes. An IEND chunk confirms a complete file.
    var started=new Date().getTime(),complete=false;
    while(new Date().getTime()-started<30000){
      var written=new File(output.fsName);
      if(written.exists&&written.length>=32){
        written.encoding='BINARY';
        if(written.open('r')){
          try{written.seek(written.length-12,0);complete=written.read(12).substr(4,4)=='IEND';}finally{written.close();}
        }
      }
      if(complete)break;
      $.sleep(50);
    }
    if(!complete)throw Error('After Effects did not finish the current frame for '+layer.name);
    return output.fsName;
  }catch(error){if(output.exists)try{output.remove();}catch(_){}throw error;}
  finally{
    if(copy)try{copy.remove();}catch(_copy){}
    if(whiteSource)try{if(!whiteSource.usedIn.length)whiteSource.remove();}catch(_white){}
    if(backdropSource)try{if(!backdropSource.usedIn.length)backdropSource.remove();}catch(_backdrop){}
    if(previous instanceof CompItem)try{previous.openInViewer();}catch(_viewer){}
  }
};

Transferify._captureAEVideoSourceFrame=function(layer){
  var comp=layer.containingComp,source=layer.source,copy=null,previous=app.project.activeItem;
  var rate=Number(source.frameRate)||comp.frameRate;
  var sourceTime;
  if(layer.timeRemapEnabled)sourceTime=layer.property('ADBE Time Remapping').valueAtTime(comp.time,false);
  else sourceTime=(comp.time-layer.startTime)*100/layer.stretch;
  sourceTime=Math.max(0,Math.min(Number(sourceTime),Math.max(0,source.duration-1/rate)));
  var output=new File(Folder.temp.fsName+'/transferify_video_frame_'+new Date().getTime()+'_'+Math.floor(Math.random()*1000000000)+'.png');
  try{
    copy=app.project.items.addComp('__Transferify Video Frame__',source.width,source.height,source.pixelAspect,Math.max(1/rate,source.duration),rate);
    copy.layers.add(source);copy.openInViewer();copy.saveFrameToPng(sourceTime,output);
    var started=new Date().getTime(),complete=false;
    while(new Date().getTime()-started<30000){
      var written=new File(output.fsName);
      if(written.exists&&written.length>=32){
        written.encoding='BINARY';
        if(written.open('r')){try{written.seek(written.length-12,0);complete=written.read(12).substr(4,4)=='IEND';}finally{written.close();}}
      }
      if(complete)break;
      $.sleep(50);
    }
    if(!complete)throw Error('After Effects did not finish the native video frame for '+layer.name);
    return output.fsName;
  }catch(error){if(output.exists)try{output.remove();}catch(_){}throw error;}
  finally{
    if(copy)try{copy.remove();}catch(_copy){}
    if(previous instanceof CompItem)try{previous.openInViewer();}catch(_viewer){}
  }
};

Transferify._aeData=function(){
  var c=Transferify._aeComp(),ls=c.selectedLayers,out={comp:{name:String(c.name),width:Number(c.width),height:Number(c.height)},items:[],warnings:[]};
  // Read native GCst gradient records from a saved AEP. Never rewrite project bytes.
  var gradientRecords=null;
  function hasGradient(g){for(var i=1;i<=g.numProperties;i++){var p=g.property(i);if(p.matchName=='ADBE Vector Graphic - G-Fill'||p.matchName=='ADBE Vector Graphic - G-Stroke')return true;if(p.matchName=='ADBE Vector Group'&&hasGradient(p.property('ADBE Vectors Group')))return true;}return false;}
  var needsGradient=false;for(var gi=0;gi<ls.length;gi++)if(ls[gi] instanceof ShapeLayer&&hasGradient(ls[gi].property('ADBE Root Vectors Group')))needsGradient=true;
  function recordKey(p){var parts=[];for(var d=p.propertyDepth-1;d>=0;d--){var q=d?p.propertyGroup(d):p,parent=q.parentProperty||q.propertyGroup(1),occ=0;for(var i=1;i<=q.propertyIndex;i++)if(parent.property(i).matchName==q.matchName)occ++;parts.push(q.matchName+'#'+occ);}return parts.join('/');}
  function loadGradients(){
    if(gradientRecords)return;
    if(!app.project.file||app.project.dirty){
      if(!confirm('Transferify: para enviar as cores atuais dos gradientes, é preciso salvar o projeto do After. Salvar agora?'))throw new Error('Envio cancelado: projeto não salvo; nenhuma cor antiga foi enviada.');
      if(!app.project.file){if(!app.project.saveWithDialog())throw new Error('Envio cancelado: projeto não salvo.');}else app.project.save();
    }
    var file=app.project.file;if(!file)throw new Error('Salve o projeto como .aep antes de enviar gradientes.');
    file.encoding='BINARY';if(!file.open('r'))throw new Error('Não foi possível ler o projeto salvo.');var bytes;try{bytes=file.read();}finally{file.close();}
    if(bytes.substr(0,4)!='RIFX')throw new Error('Gradientes: esta versão requer projeto no formato .aep binário.');
    gradientRecords={};
    function u32(i){return(bytes.charCodeAt(i)&255)*16777216+(bytes.charCodeAt(i+1)&255)*65536+(bytes.charCodeAt(i+2)&255)*256+(bytes.charCodeAt(i+3)&255);}
    function children(a,z){var list=[];while(a+8<=z){var n=u32(a+4),end=a+8+n;if(end>z||end<a)throw new Error('Estrutura AEP não reconhecida.');list.push({tag:bytes.substr(a,4),a:a+8,z:end,n:n});a=end+n%2;}return list;}
    function header(list,tag,offset){for(var i=0;i<list.length;i++)if(list[i].tag==tag)return u32(list[i].a+offset);return null;}
    function xmlValues(a,z){var list=children(a,z),out=[];for(var i=0;i<list.length;i++){var q=list[i];if(q.tag=='Utf8')out.push(bytes.substring(q.a,q.z));else if(q.tag=='LIST'&&bytes.substr(q.a,4)=='GCky')out=out.concat(xmlValues(q.a+4,q.z));}return out;}
    function walk(a,z,compID,layerID,path){var list=children(a,z),counts={},last='';
      for(var i=0;i<list.length;i++){var q=list[i];
        if(q.tag=='tdmn'){var name=bytes.substring(q.a,q.z).split(String.fromCharCode(0))[0];counts[name]=(counts[name]||0)+1;last=name+'#'+counts[name];}
        else if(q.tag=='LIST'){var typ=bytes.substr(q.a,4),from=q.a+4;
          if(typ=='Item'){var sub=children(from,q.z),id=header(sub,'idta',16);walk(from,q.z,id,null,[]);}
          else if(typ=='Layr'){if(compID==c.id){var sub=children(from,q.z),id=header(sub,'ldta',0);walk(from,q.z,compID,id,[]);}}
          else if(typ=='GCst'){if(compID==c.id&&layerID!==null)gradientRecords[layerID+'|'+path.concat(last?[last]:[]).join('/')]=xmlValues(from,q.z);}
          else if(typ=='tdgp')walk(from,q.z,compID,layerID,path.concat(last?[last]:[]));
          else if(typ=='Fold'||typ=='Sfdr')walk(from,q.z,compID,layerID,path);
        }
      }
    }
    walk(12,Math.min(bytes.length,u32(4)+8),null,null,[]);
  }
  function readStops(layer,p){loadGradients();var colorProperty=p.property('ADBE Vector Grad Colors'),xml=gradientRecords[layer.id+'|'+recordKey(colorProperty)];
    if(colorProperty.numKeys>0)throw new Error(layer.name+': use cores de gradiente estáticas nesta versão; animação de Colors não é suportada.');
    if(!xml||!xml.length){if(colorProperty.isModified)throw new Error(layer.name+': os stops do gradiente não foram encontrados no projeto salvo.');return{colors:[[0,0.5,1,1,1],[1,0.5,0,0,0]],alpha:[[0,0.5,1],[1,0.5,1]]};}
    if(xml.length!=1)throw new Error(layer.name+': múltiplos estados de cor não suportados.');
    function arrays(label){var src=xml[0],token='<key>'+label+'</key>',result=[],start=0;
      while((start=src.indexOf(token,start))>=0){var a=src.indexOf('<array>',start),end=src.indexOf('</array>',a),text=src.substring(a,end),vals=[],re=/<float>([^<]+)<\/float>/g,match;while((match=re.exec(text))!==null)vals.push(Number(match[1]));if(vals.length)result.push(vals);start=end+8;}
      result.sort(function(a,b){return a[0]-b[0];});return result;}
    var colors=arrays('Stops Color'),alpha=arrays('Stops Alpha');if(colors.length<2)throw new Error(layer.name+': stops de cor inválidos.');return{colors:colors,alpha:alpha};
  }
  function num(v,d){var x=Number(v);return isNaN(x)?(d||0):x;}
  function value(p,d){try{return p.valueAtTime(c.time,false);}catch(e){return d;}}
  function pv(g,n,d){return value(g.property(n),d);}
  function p3(v){return[num(v[0]),num(v[1]),num(v[2])];}
  function mul(a,b){return[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
  function rotate(deg){var r=deg*Math.PI/180;return[Math.cos(r),Math.sin(r),-Math.sin(r),Math.cos(r),0,0];}
  function trans(x,y){return[1,0,0,1,x,y];}
  function gp(g){var t=g.property('ADBE Vector Transform Group'),a=pv(t,'ADBE Vector Anchor',[0,0]),p=pv(t,'ADBE Vector Position',[0,0]),s=pv(t,'ADBE Vector Scale',[100,100]),r=num(pv(t,'ADBE Vector Rotation',0)),sk=num(pv(t,'ADBE Vector Skew',0)),ax=num(pv(t,'ADBE Vector Skew Axis',0));
    var m=mul(trans(p[0],p[1]),rotate(r));m=mul(m,rotate(ax));m=mul(m,[1,0,-Math.tan(sk*Math.PI/180),1,0,0]);m=mul(m,rotate(-ax));m=mul(m,[s[0]/100,0,0,s[1]/100,0,0]);return mul(m,trans(-a[0],-a[1]));}
  function xy(m,p){return[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];}
  function compPoint(l,p){var q=l.sourcePointToComp(p);return[num(q[0]),num(q[1])];}
  function style(g,inherited,layer,m){var s=inherited||{filled:false,stroked:false,fill:[0,0,0],stroke:[0,0,0],strokeWidth:1,fillOpacity:100,strokeOpacity:100,rule:1};var z={},k;for(k in s)z[k]=s[k];
    for(var i=1;i<=g.numProperties;i++){var p=g.property(i);if(p.enabled===false)continue;
      if(p.matchName=='ADBE Vector Graphic - Fill'){z.filled=true;z.fill=p3(pv(p,'ADBE Vector Fill Color',[0,0,0]));z.fillOpacity=num(pv(p,'ADBE Vector Fill Opacity',100));z.rule=num(pv(p,'ADBE Vector Fill Rule',1));}
      else if(p.matchName=='ADBE Vector Graphic - Stroke'){z.stroked=true;z.stroke=p3(pv(p,'ADBE Vector Stroke Color',[0,0,0]));z.strokeWidth=num(pv(p,'ADBE Vector Stroke Width',1),1);z.strokeOpacity=num(pv(p,'ADBE Vector Stroke Opacity',100));
        z.cap=num(pv(p,'ADBE Vector Stroke Line Cap',1));z.join=num(pv(p,'ADBE Vector Stroke Line Join',1));z.miter=num(pv(p,'ADBE Vector Stroke Miter Limit',4));
        var dashes=p.property('ADBE Vector Stroke Dashes');z.dashes=[];z.dashOffset=0;
        if(dashes)for(var di=1;di<=dashes.numProperties;di++){var dp=dashes.property(di),dn=dp.matchName;if(dn=='ADBE Vector Stroke Offset')z.dashOffset=num(value(dp,0));else if(/ADBE Vector Stroke (Dash|Gap)/.test(dn))z.dashes.push(num(value(dp,0)));}}
      else if(p.matchName=='ADBE Vector Graphic - G-Fill'||p.matchName=='ADBE Vector Graphic - G-Stroke'){
        var raw=readStops(layer,p),sc=pv(p,'ADBE Vector Grad Scale',[100,100]),rot=num(pv(p,'ADBE Vector Grad Rotation',0)),gm=mul(m,mul(rotate(rot),[sc[0]/100,0,0,sc[1]/100,0,0]));
        var o=compPoint(layer,xy(gm,[0,0])),ux=compPoint(layer,xy(gm,[1,0])),uy=compPoint(layer,xy(gm,[0,1]));
        var gradient={kind:pv(p,'ADBE Vector Grad Type',1)==2?'radial':'linear',start:pv(p,'ADBE Vector Grad Start Pt',[0,0]),end:pv(p,'ADBE Vector Grad End Pt',[100,0]),highlightLength:num(pv(p,'ADBE Vector Grad HiLite Length',0)),highlightAngle:num(pv(p,'ADBE Vector Grad HiLite Angle',0)),matrix:[ux[0]-o[0],ux[1]-o[1],uy[0]-o[0],uy[1]-o[1],o[0],o[1]],colors:raw.colors,alpha:raw.alpha};
        if(p.matchName=='ADBE Vector Graphic - G-Fill'){z.gradientFill=gradient;z.filled=true;z.fillOpacity=num(pv(p,'ADBE Vector Fill Opacity',100));z.rule=num(pv(p,'ADBE Vector Fill Rule',1));}
        else{z.gradientStroke=gradient;z.stroked=true;z.strokeWidth=num(pv(p,'ADBE Vector Stroke Width',1),1);z.strokeOpacity=num(pv(p,'ADBE Vector Stroke Opacity',100));}
      }
    }return z;}
  function bezier(p){return{closed:!!p.closed,vertices:p.vertices,inTangents:p.inTangents,outTangents:p.outTangents};}
  function primitive(p){var mn=p.matchName,v=[],inn=[],outt=[],k=0.5522847498307936;
    function add(x,y,ix,iy,ox,oy){v.push([x,y]);inn.push([ix||0,iy||0]);outt.push([ox||0,oy||0]);}
    if(mn=='ADBE Vector Shape - Rect'){
      var sz=pv(p,'ADBE Vector Rect Size',[100,100]),pos=pv(p,'ADBE Vector Rect Position',[0,0]),w=Math.abs(sz[0])/2,h=Math.abs(sz[1])/2,r=Math.min(w,h,Math.max(0,num(pv(p,'ADBE Vector Rect Roundness',0))));
      if(!r){add(-w,-h);add(w,-h);add(w,h);add(-w,h);}else{add(-w+r,-h,-k*r,0,0,0);add(w-r,-h,0,0,k*r,0);add(w,-h+r,0,-k*r,0,0);add(w,h-r,0,0,0,k*r);add(w-r,h,k*r,0,0,0);add(-w+r,h,0,0,-k*r,0);add(-w,h-r,0,k*r,0,0);add(-w,-h+r,0,0,0,-k*r);}
      for(var j=0;j<v.length;j++){v[j][0]+=pos[0];v[j][1]+=pos[1];}
    }else if(mn=='ADBE Vector Shape - Ellipse'){
      var sz=pv(p,'ADBE Vector Ellipse Size',[100,100]),pos=pv(p,'ADBE Vector Ellipse Position',[0,0]),rx=sz[0]/2,ry=sz[1]/2;
      add(pos[0],pos[1]-ry,-k*rx,0,k*rx,0);add(pos[0]+rx,pos[1],0,-k*ry,0,k*ry);add(pos[0],pos[1]+ry,k*rx,0,-k*rx,0);add(pos[0]-rx,pos[1],0,k*ry,0,-k*ry);
    }else if(mn=='ADBE Vector Shape - Star'){
      var pos=pv(p,'ADBE Vector Star Position',[0,0]),n=Math.max(2,Math.round(pv(p,'ADBE Vector Star Points',5))),star=pv(p,'ADBE Vector Star Type',1)==1,count=star?n*2:n,ro=num(pv(p,'ADBE Vector Star Outer Radius',50)),ri=num(pv(p,'ADBE Vector Star Inner Radius',25)),ang=(num(pv(p,'ADBE Vector Star Rotation',0))-90)*Math.PI/180;
      if(num(pv(p,'ADBE Vector Star Outer Roundess',0))||num(pv(p,'ADBE Vector Star Inner Roundess',0)))out.warnings.push('Rounded polystar converted with straight corners');
      for(var j=0;j<count;j++){var a=ang+j*2*Math.PI/count,rad=star&&j%2?ri:ro;add(pos[0]+Math.cos(a)*rad,pos[1]+Math.sin(a)*rad);}
    }else return null;
    if(pv(p,'ADBE Vector Shape Direction',1)==3){v.reverse();var tmp=inn;inn=outt.reverse();outt=tmp.reverse();}
    return{closed:true,vertices:v,inTangents:inn,outTangents:outt};}
  function scan(layer,g,list,m,inherited,opacity){
    var st=style(g,inherited,layer,m),paths=[];
    for(var i=1;i<=g.numProperties;i++){var p=g.property(i);if(p.enabled===false)continue;
      if(p.matchName=='ADBE Vector Group'){var t=p.property('ADBE Vector Transform Group');scan(layer,p.property('ADBE Vectors Group'),list,mul(m,gp(p)),st,opacity*num(pv(t,'ADBE Vector Group Opacity',100))/100);}
      else{var sh=null;if(p.matchName=='ADBE Vector Shape - Group')sh=bezier(pv(p,'ADBE Vector Shape',null));else sh=primitive(p);
        if(sh){var pts=[];for(var k=0;k<sh.vertices.length;k++){var v=sh.vertices[k],it=sh.inTangents[k],ot=sh.outTangents[k],cp=compPoint(layer,xy(m,v)),ip=compPoint(layer,xy(m,[v[0]+it[0],v[1]+it[1]])),op=compPoint(layer,xy(m,[v[0]+ot[0],v[1]+ot[1]]));pts.push({a:cp,inT:[ip[0]-cp[0],ip[1]-cp[1]],outT:[op[0]-cp[0],op[1]-cp[1]]});}paths.push({closed:sh.closed,points:pts});}
        else if(p.matchName.indexOf('ADBE Vector Filter')==0)out.warnings.push(layer.name+': '+p.name+' operator is not baked into the Illustrator paths');
      }
    }
    if(paths.length){var unit0=compPoint(layer,xy(m,[0,0])),unitX=compPoint(layer,xy(m,[1,0])),unitY=compPoint(layer,xy(m,[0,1])),det=(unitX[0]-unit0[0])*(unitY[1]-unit0[1])-(unitX[1]-unit0[1])*(unitY[0]-unit0[0]);var ss={};for(var key in st)ss[key]=st[key];var factor=Math.sqrt(Math.abs(det));ss.strokeWidth*=factor;
      if(ss.dashes){ss.dashes=ss.dashes.slice(0);for(var di=0;di<ss.dashes.length;di++)ss.dashes[di]*=factor;ss.dashOffset*=factor;}list.push({name:String(g.name||'Group'),paths:paths,style:ss,opacity:opacity});}
  }
  function textStyle(q){
    var filled=!!q.applyFill,stroked=!!q.applyStroke;
    return {font:String(q.font||''),size:num(q.fontSize,12),tracking:num(q.tracking,0),
      filled:filled,fill:filled?p3(q.fillColor):[0,0,0],
      stroked:stroked,stroke:stroked?p3(q.strokeColor):[0,0,0],strokeWidth:stroked?num(q.strokeWidth,1):0,
      hscale:100*num(q.horizontalScale,1),vscale:100*num(q.verticalScale,1)};
  }
  function runs(td){
    var text=String(td.text),result=[];
    if(!text.length||typeof td.characterRange!='function')return result;
    function character(i){try{return textStyle(td.characterRange(i,i+1));}catch(e){return textStyle(td);}}
    function styleKey(s){return [s.font,s.size,s.tracking,s.filled,s.fill.join(","),s.stroked,s.stroke.join(","),s.strokeWidth,s.hscale,s.vscale].join("|");}
    var start=0,last=character(0),key=styleKey(last);
    for(var i=1;i<=text.length;i++){
      var current=i<text.length?character(i):null;
      var currentKey=current?styleKey(current):null;
      if(currentKey!==key){last.start=start;last.end=i;result.push(last);start=i;last=current;key=currentKey;}
    }
    return result;
  }
  var captures=[];
  function capturedPath(layer,shape){
    var points=[];
    for(var i=0;i<shape.vertices.length;i++){
      var v=shape.vertices[i],it=shape.inTangents[i],ot=shape.outTangents[i],a=compPoint(layer,v),left=compPoint(layer,[v[0]+it[0],v[1]+it[1]]),right=compPoint(layer,[v[0]+ot[0],v[1]+ot[1]]);
      points.push({a:a,inT:[left[0]-a[0],left[1]-a[1]],outT:[right[0]-a[0],right[1]-a[1]]});
    }
    return {closed:shape.closed,points:points};
  }
  var layers=[];for(var li=0;li<ls.length;li++)layers.push(ls[li]);layers.sort(function(a,b){return a.index-b.index;});
  for(var j=0;j<layers.length;j++){
    var l=layers[j];if(l.threeDLayer){out.warnings.push(l.name+': 3D layer is not supported; use a 2D layer');continue;}
    var opacity=num(pv(l.property('ADBE Transform Group'),'ADBE Opacity',100));
    if(l instanceof ShapeLayer){var gs=[];scan(l,l.property('ADBE Root Vectors Group'),gs,[1,0,0,1,0,0],null,1);if(gs.length)out.items.push({type:'shape',name:String(l.name),groups:gs,opacity:opacity});else out.warnings.push(l.name+': no supported paths found');}
    else if(l instanceof TextLayer){var td=pv(l.property('ADBE Text Properties'),'ADBE Text Document',null),p0=compPoint(l,[0,0]),p1=compPoint(l,[1,0]),p2=compPoint(l,[0,1]);out.items.push({type:'text',name:String(l.name),text:String(td.text),style:textStyle(td),pos:p0,basis:[p0,p1,p2],runs:runs(td),opacity:opacity});
      var textRect=l.sourceRectAtTime(c.time,false),textCorners=[[textRect.left,textRect.top],[textRect.left+textRect.width,textRect.top],[textRect.left,textRect.top+textRect.height],[textRect.left+textRect.width,textRect.top+textRect.height]];
      var textBounds=[Infinity,Infinity,-Infinity,-Infinity];
      for(var tc=0;tc<textCorners.length;tc++){var cp=compPoint(l,textCorners[tc]);textBounds[0]=Math.min(textBounds[0],cp[0]);textBounds[1]=Math.min(textBounds[1],cp[1]);textBounds[2]=Math.max(textBounds[2],cp[0]);textBounds[3]=Math.max(textBounds[3],cp[1]);}
      out.items[out.items.length-1].visualBounds=textBounds;
    }
    else if(l.source instanceof FootageItem&&l.source.mainSource instanceof SolidSource){
      var w=l.source.width,h=l.source.height,quad={closed:true,points:[]},corners=[[0,0],[w,0],[w,h],[0,h]];
      for(var ci=0;ci<4;ci++)quad.points.push({a:compPoint(l,corners[ci]),inT:[0,0],outT:[0,0]});
      var solid={type:'solid',name:String(l.name),color:p3(l.source.mainSource.color),path:quad,opacity:opacity,maskPath:null};
      var masks=l.property('ADBE Mask Parade'),activeMasks=[];
      for(var mi=1;mi<=masks.numProperties;mi++)if(masks.property(mi).maskMode!=MaskMode.NONE)activeMasks.push(masks.property(mi));
      if(activeMasks.length==1){
        var mask=activeMasks[0],maskShape=pv(mask,'ADBE Mask Shape',null);
        if(mask.maskMode==MaskMode.ADD&&!mask.inverted&&maskShape&&maskShape.closed&&
           !num(pv(mask,'ADBE Mask Offset',0))&&num(pv(mask,'ADBE Mask Opacity',100))==100){
          solid.maskPath=capturedPath(l,maskShape);
        }
      }
      if(activeMasks.length&&!solid.maskPath){
        solid.opacity=100;
        captures.push({layer:l,item:solid,white:true});
      }
      out.items.push(solid);
    }
    else if(l.source instanceof FootageItem&&l.source.file){
      var file=l.source.file;if(!file.exists){out.warnings.push(l.name+': source image is missing');continue;}
      if(!l.source.mainSource.isStill){
        if(c.time<l.inPoint||c.time>=l.outPoint){out.warnings.push(l.name+': current frame is outside the layer interval');continue;}
        var origin=compPoint(l,[0,0]),nativeWidth=l.source.width,nativeHeight=l.source.height;
        var frame={type:'image',name:String(l.name),file:null,corners:[origin,[origin[0]+nativeWidth,origin[1]],[origin[0],origin[1]+nativeHeight]],opacity:100,embedFrame:true};
        captures.push({layer:l,item:frame,white:false});out.items.push(frame);continue;
      }
      var w=l.source.width,h=l.source.height;out.items.push({type:'image',name:String(l.name),file:file.fsName,corners:[compPoint(l,[0,0]),compPoint(l,[w,0]),compPoint(l,[0,h])],opacity:opacity});
      if(l.property('ADBE Mask Parade').numProperties||l.property('ADBE Effect Parade').numProperties)out.warnings.push(l.name+': original image linked; AE masks/effects are not baked');
    }else out.warnings.push(l.name+': unsupported layer type');
  }
  for(var fi=0;fi<captures.length;fi++){
    var capture=captures[fi],path=capture.white?Transferify._captureAECurrentFrame(capture.layer,true):Transferify._captureAEVideoSourceFrame(capture.layer);
    if(capture.white)capture.item.maskAlphaFile=path;else capture.item.file=path;
  }
  return out;
};

/* ---------- SELF-CONTAINED AI RECEIVER ---------- */
Transferify._receiveAE=function(data){
  var oldInteraction=app.userInteractionLevel;
  try{
    app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS;
    var doc;if(!app.documents.length){doc=app.documents.add(DocumentColorSpace.RGB,data.comp.width,data.comp.height);doc.artboards[0].name=data.comp.name;}else doc=app.activeDocument;
    doc.selection=null;
    var ab=doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect,created=[],warnings=data.warnings||[],dest=doc.layers.add();dest.name='Transferify - '+data.comp.name;dest.visible=true;dest.locked=false;doc.activeLayer=dest;var gradientTasks=[];
    function pt(p){return[Number(ab[0])+Number(p[0]),Number(ab[1])-Number(p[1])];}
    function col(a){var c=new RGBColor();c.red=Math.round(Number(a[0]||0)*255);c.green=Math.round(Number(a[1]||0)*255);c.blue=Math.round(Number(a[2]||0)*255);return c;}
    function makePath(container,q,st){
      var pi=container.pathItems.add(),pts=[];for(var k=0;k<q.points.length;k++)pts.push(pt(q.points[k].a));
      pi.setEntirePath(pts);pi.closed=!!q.closed;
      for(var k2=0;k2<q.points.length;k2++){var pp=pi.pathPoints[k2],a=pts[k2],it=q.points[k2].inT,ot=q.points[k2].outT;pp.leftDirection=[a[0]+Number(it[0]),a[1]-Number(it[1])];pp.rightDirection=[a[0]+Number(ot[0]),a[1]-Number(ot[1])];}
      pi.filled=!!st.filled;if(st.filled)pi.fillColor=col(st.fill);
      pi.stroked=!!st.stroked;if(st.stroked){pi.strokeColor=col(st.stroke);pi.strokeWidth=Number(st.strokeWidth)||1;
        if(st.cap)pi.strokeCap=[StrokeCap.BUTTENDCAP,StrokeCap.ROUNDENDCAP,StrokeCap.PROJECTINGENDCAP][st.cap-1];
        if(st.join)pi.strokeJoin=[StrokeJoin.MITERENDJOIN,StrokeJoin.ROUNDENDJOIN,StrokeJoin.BEVELENDJOIN][st.join-1];
        if(st.miter)pi.strokeMiterLimit=st.miter;
        if(st.dashes&&st.dashes.length){pi.strokeDashes=st.dashes;pi.strokeDashOffset=st.dashOffset;}}
      try{pi.evenodd=st.rule==2;}catch(_rule){}
      var fo=typeof st.fillOpacity=='number'?st.fillOpacity:100,so=typeof st.strokeOpacity=='number'?st.strokeOpacity:100;
      pi.opacity=st.filled?fo:so;if(st.filled&&st.stroked&&fo!=so)warnings.push('Fill/Stroke opacity differ: '+pi.name+' uses fill opacity');return pi;
    }
    function gradientGroup(root,grp){
      var st=grp.style,defs=[],file=null,tempDoc=null,holder=null,stage="serialize SVG";
      function clean(n){var v=Number(n);if(!isFinite(v))throw new Error('Invalid gradient coordinate');return String(v);}
      function rgb(v){return 'rgb('+Math.round(Math.max(0,Math.min(1,v[0]))*255)+','+Math.round(Math.max(0,Math.min(1,v[1]))*255)+','+Math.round(Math.max(0,Math.min(1,v[2]))*255)+')';}
      function gradient(g,id){
        var positions=[0,1],colors=g.colors,alpha=g.alpha;
        function addRows(rows){for(var i=0;i<rows.length;i++){positions.push(rows[i][0]);if(i+1<rows.length&&Math.abs(rows[i][1]-0.5)>0.000001)positions.push(rows[i][0]+(rows[i+1][0]-rows[i][0])*rows[i][1]);}}
        addRows(colors);addRows(alpha);positions.sort(function(a,b){return a-b;});
        function sample(rows,t,component,side){if(!rows.length)return 1;var exact=-1;for(var ei=0;ei<rows.length;ei++)if(Math.abs(rows[ei][0]-t)<0.0000001){if(exact<0)exact=ei;if(side=='right')exact=ei;}if(exact>=0)return rows[exact][component];
          if(t<=rows[0][0])return rows[0][component];for(var i=0;i+1<rows.length;i++)if(t<rows[i+1][0]){var u=(t-rows[i][0])/(rows[i+1][0]-rows[i][0]),mid=Math.max(0.000001,Math.min(0.999999,rows[i][1]));u=u<=mid?0.5*u/mid:0.5+0.5*(u-mid)/(1-mid);return rows[i][component]+u*(rows[i+1][component]-rows[i][component]);}return rows[rows.length-1][component];}
        function duplicateAt(rows,t){var count=0;for(var i=0;i<rows.length;i++)if(Math.abs(rows[i][0]-t)<0.0000001)count++;return count>1;}
        var stops='',previous=-1;for(var i=0;i<positions.length;i++){var t=positions[i];if(t<0||t>1||Math.abs(t-previous)<0.0000001)continue;previous=t;var hard=duplicateAt(colors,t)||duplicateAt(alpha,t),count=hard?2:1;for(var h=0;h<count;h++){var side=h==0&&hard?'left':'right';stops+='<stop offset="'+clean(t)+'" stop-color="'+rgb([sample(colors,t,2,side),sample(colors,t,3,side),sample(colors,t,4,side)])+'" stop-opacity="'+clean(Math.max(0,Math.min(1,sample(alpha,t,2,side))))+'"/>';}}
        var a=g.start,b=g.end,m=g.matrix,transform='matrix('+m.join(' ')+')';
        if(g.kind=='radial'){var dx=b[0]-a[0],dy=b[1]-a[1],r=Math.sqrt(dx*dx+dy*dy),angle=Math.atan2(dy,dx)+g.highlightAngle*Math.PI/180,h=Math.max(-0.99999,Math.min(0.99999,g.highlightLength/100));if(r<0.000001)r=0.000001;defs.push('<radialGradient id="'+id+'" gradientUnits="userSpaceOnUse" cx="'+clean(a[0])+'" cy="'+clean(a[1])+'" r="'+clean(r)+'" fx="'+clean(a[0]+Math.cos(angle)*r*h)+'" fy="'+clean(a[1]+Math.sin(angle)*r*h)+'" gradientTransform="'+transform+'">'+stops+'</radialGradient>');}
        else defs.push('<linearGradient id="'+id+'" gradientUnits="userSpaceOnUse" x1="'+clean(a[0])+'" y1="'+clean(a[1])+'" x2="'+clean(b[0])+'" y2="'+clean(b[1])+'" gradientTransform="'+transform+'">'+stops+'</linearGradient>');return 'url(#'+id+')';
      }
      var fill=st.filled?(st.gradientFill?gradient(st.gradientFill,'transferifyFill'):rgb(st.fill)):'none',stroke=st.stroked?(st.gradientStroke?gradient(st.gradientStroke,'transferifyStroke'):rgb(st.stroke)):'none',d='';
      for(var pi=0;pi<grp.paths.length;pi++){var q=grp.paths[pi],pts=q.points;if(!pts.length)continue;d+='M'+pts[0].a.join(' ');var segments=q.closed?pts.length:pts.length-1;for(var vi=0;vi<segments;vi++){var current=pts[vi],next=pts[(vi+1)%pts.length];d+='C'+clean(current.a[0]+current.outT[0])+' '+clean(current.a[1]+current.outT[1])+' '+clean(next.a[0]+next.inT[0])+' '+clean(next.a[1]+next.inT[1])+' '+next.a.join(' ');}if(q.closed)d+='Z';}
      var svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+data.comp.width+'" height="'+data.comp.height+'" viewBox="0 0 '+data.comp.width+' '+data.comp.height+'"><defs>'+defs.join('')+'</defs><path d="'+d+'" fill="'+fill+'" fill-rule="'+(st.rule==2?'evenodd':'nonzero')+'" fill-opacity="'+(st.fillOpacity/100)+'" stroke="'+stroke+'" stroke-width="'+st.strokeWidth+'" stroke-opacity="'+(st.strokeOpacity/100)+'"/></svg>';
      var id='TFGradient'+gradientTasks.length,fragment=svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');fragment=fragment.replace(/id="([^"]+)"/g,'id="'+id+'_$1"').replace(/url\(#([^)]+)\)/g,'url(#'+id+'_$1)');var holder=root.groupItems.add();holder.name=grp.name||'Gradient';holder.opacity=typeof grp.opacity=='number'?grp.opacity*100:100;gradientTasks.push({id:id,svg:'<g id="'+id+'">'+fragment+'</g>',holder:holder});
    }
    function flushGradientBatch(){if(!gradientTasks.length)return;var file=null,tempDoc=null;try{var fragments=[];for(var i=0;i<gradientTasks.length;i++)fragments.push(gradientTasks[i].svg);var svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+data.comp.width+'" height="'+data.comp.height+'" viewBox="0 0 '+data.comp.width+' '+data.comp.height+'">'+fragments.join('')+'</svg>';file=new File(Folder.temp.fsName+'/transferify_ae_gradient_batch_'+new Date().getTime()+'.svg');file.encoding='UTF-8';if(!file.open('w'))throw Error('Cannot create gradient batch');try{file.write(svg);}finally{file.close();}tempDoc=app.open(file);var sourceArtboard=tempDoc.artboards[tempDoc.artboards.getActiveArtboardIndex()].artboardRect;doc.activate();for(var i=0;i<gradientTasks.length;i++){var task=gradientTasks[i],original=null;for(var j=0;j<tempDoc.groupItems.length;j++)if(tempDoc.groupItems[j].name==task.id){original=tempDoc.groupItems[j];break;}if(!original)throw Error('Gradient batch group missing: '+task.id);var bounds=original.geometricBounds,copy=original.duplicate(dest,ElementPlacement.PLACEATEND);copy.move(task.holder,ElementPlacement.PLACEATEND);var cb=copy.geometricBounds;copy.translate(bounds[0]+ab[0]-sourceArtboard[0]-cb[0],bounds[1]+ab[1]-sourceArtboard[1]-cb[1],true,true,true,true);}}finally{if(tempDoc)try{tempDoc.close(SaveOptions.DONOTSAVECHANGES);}catch(_){}try{doc.activate();}catch(_){}if(file)try{file.remove();}catch(_){}}}

    function affine(item,points){
      var q0=pt(points[0]),q1=pt(points[1]),q2=pt(points[2]),w=item.width,h=item.height,left=item.left,top=item.top;
      if(!w||!h)throw new Error('Image has empty dimensions');
      var m=app.getIdentityMatrix();m.mValueA=(q1[0]-q0[0])/w;m.mValueB=(q1[1]-q0[1])/w;m.mValueC=-(q2[0]-q0[0])/h;m.mValueD=-(q2[1]-q0[1])/h;
      m.mValueTX=q0[0]-m.mValueA*left-m.mValueC*top;m.mValueTY=q0[1]-m.mValueB*left-m.mValueD*top;
      item.transform(m,true,true,true,true,100,Transformation.DOCUMENTORIGIN);
    }
    function pngDataURL(path){
      var file=new File(path);file.encoding='BINARY';
      if(!file.open('r'))throw Error('Cannot read mask frame: '+file.error);
      var bytes;try{bytes=file.read();}finally{file.close();}
      var alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',parts=[];
      for(var i=0;i<bytes.length;i+=3){
        var a=bytes.charCodeAt(i)&255,b=i+1<bytes.length?bytes.charCodeAt(i+1)&255:0,c=i+2<bytes.length?bytes.charCodeAt(i+2)&255:0;
        parts.push(alphabet.charAt(a>>2)+alphabet.charAt(((a&3)<<4)|(b>>4))+(i+1<bytes.length?alphabet.charAt(((b&15)<<2)|(c>>6)):'=')+(i+2<bytes.length?alphabet.charAt(c&63):'='));
      }
      return 'data:image/png;base64,'+parts.join('');
    }
    function maskedSolid(x){
      var root=dest.groupItems.add();root.name=x.name;root.opacity=x.opacity;
      if(!x.maskAlphaFile){
        makePath(root,x.path,{filled:true,fill:x.color,stroked:false});
        if(x.maskPath){
          var clip=makePath(root,x.maskPath,{filled:false,stroked:false});
          clip.clipping=true;clip.move(root,ElementPlacement.PLACEATBEGINNING);root.clipped=true;
        }
        return root;
      }
      var file=null,temporary=null,copy=null;
      try{
        var points=x.path.points,d='';
        for(var i=0;i<points.length;i++)d+=(i?' L ':'M ')+Number(points[i].a[0])+' '+Number(points[i].a[1]);
        d+=' Z';
        var fill='rgb('+Math.round(x.color[0]*255)+','+Math.round(x.color[1]*255)+','+Math.round(x.color[2]*255)+')';
        var svg='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="'+data.comp.width+'" height="'+data.comp.height+'" viewBox="0 0 '+data.comp.width+' '+data.comp.height+'"><defs><mask id="TransferifySolidMask" maskUnits="userSpaceOnUse" x="0" y="0" width="'+data.comp.width+'" height="'+data.comp.height+'"><image width="'+data.comp.width+'" height="'+data.comp.height+'" xlink:href="'+pngDataURL(x.maskAlphaFile)+'"/></mask></defs><path id="TransferifySolid" d="'+d+'" fill="'+fill+'" mask="url(#TransferifySolidMask)"/></svg>';
        file=new File(Folder.temp.fsName+'/transferify_solid_mask_'+new Date().getTime()+'_'+Math.floor(Math.random()*1000000000)+'.svg');file.encoding='UTF-8';
        if(!file.open('w'))throw Error('Cannot create masked solid SVG');
        try{if(!file.write(svg))throw Error('Cannot write masked solid SVG');}finally{file.close();}
        temporary=app.open(file);
        var sourceRect=temporary.artboards[0].artboardRect,original=null;
        for(var i=0;i<temporary.layers[0].pageItems.length;i++){
          var item=temporary.layers[0].pageItems[i];
          if(item.parent==temporary.layers[0]){if(original)throw Error('Masked solid returned ambiguous SVG artwork');original=item;}
        }
        if(!original)throw Error('Masked solid returned no vector artwork');
        doc.activate();copy=original.duplicate(dest,ElementPlacement.PLACEATEND);copy.move(root,ElementPlacement.PLACEATEND);
        copy.translate(ab[0]-sourceRect[0],ab[1]-sourceRect[1],true,true,true,true);
        copy.name=x.name;
        return root;
      }catch(error){try{root.remove();}catch(_){}throw error;}
      finally{
        if(temporary)try{temporary.close(SaveOptions.DONOTSAVECHANGES);}catch(_close){}
        try{doc.activate();}catch(_activate){}
        if(file)try{file.remove();}catch(_svg){}
        if(copy)try{new File(x.maskAlphaFile).remove();}catch(_png){}
      }
    }

    for(var i=data.items.length-1;i>=0;i--){var x=data.items[i];try{
      if(x.type=='solid'){
        created.push(maskedSolid(x));
      }else if(x.type=='image'&&x.embedFrame){
        var frameFile=new File(x.file);if(!frameFile.exists)throw Error('Current video frame unavailable');
        var frameGroup=dest.groupItems.add();frameGroup.name=x.name;
        try{
          var placedFrame=frameGroup.placedItems.add();placedFrame.file=frameFile;affine(placedFrame,x.corners);placedFrame.embed();
          if(frameGroup.rasterItems.length!=1)throw Error('Video frame could not be embedded');
          frameGroup.rasterItems[0].name=x.name;frameGroup.opacity=x.opacity;created.push(frameGroup);
          frameFile.remove();
        }catch(frameError){frameGroup.remove();throw frameError;}
      }else if(x.type=='image'){
        var file=new File(x.file);if(!file.exists)throw new Error('Source image unavailable: '+x.file);
        var placed=dest.placedItems.add();placed.file=file;placed.name=x.name;affine(placed,x.corners);placed.opacity=typeof x.opacity=='number'?x.opacity:100;created.push(placed);
      }else if(x.type=='text'){
        var tf=dest.textFrames.pointText(pt(x.pos));tf.contents=x.text;tf.name=x.name;tf.opacity=typeof x.opacity=='number'?x.opacity:100;
        function textAppearance(ca,style){
          try{if(style.font)ca.textFont=app.textFonts.getByName(style.font);}catch(_font){}
          ca.size=style.size;
          ca.fillColor=style.filled===false?new NoColor():col(style.fill);
          ca.strokeColor=style.stroked?col(style.stroke):new NoColor();
          if(style.stroked)ca.strokeWeight=style.strokeWidth;
          if(typeof style.tracking=='number')ca.tracking=style.tracking;
          if(style.hscale>0)ca.horizontalScale=style.hscale;
          if(style.vscale>0)ca.verticalScale=style.vscale;
        }
        var textStyleError=null;
        try{textAppearance(tf.textRange.characterAttributes,x.style||x);}catch(e){textStyleError='base appearance: '+e.message;}
        if(x.runs&&x.runs.length>1){
          var characters=tf.characters;
          for(var rr=0;rr<x.runs.length;rr++){
            var run=x.runs[rr];
            for(var ci=run.start;ci<run.end&&ci<characters.length;ci++){
              if(/[\r\n\u0003]/.test(tf.contents.charAt(ci)))continue;
              try{textAppearance(characters[ci].characterAttributes,run);}catch(e){textStyleError='character '+ci+': '+e.message;}
            }
          }
        }
        if(textStyleError)warnings.push(x.name+': '+textStyleError);
        if(x.basis){var o=pt(x.basis[0]),px=pt(x.basis[1]),py=pt(x.basis[2]),m=app.getIdentityMatrix();m.mValueA=px[0]-o[0];m.mValueB=px[1]-o[1];m.mValueC=-(py[0]-o[0]);m.mValueD=-(py[1]-o[1]);m.mValueTX=o[0]-m.mValueA*o[0]-m.mValueC*o[1];m.mValueTY=o[1]-m.mValueB*o[0]-m.mValueD*o[1];tf.transform(m,true,true,true,true,100,Transformation.DOCUMENTORIGIN);}
        if(x.visualBounds){
          var textCopy=null,textOutline=null;
          try{
            textCopy=tf.duplicate();textOutline=textCopy.createOutline();textCopy=null;
            var glyphBox=textOutline.visibleBounds,target=pt([x.visualBounds[0],x.visualBounds[1]]);
            tf.translate(target[0]-glyphBox[0],target[1]-glyphBox[1]);
          }finally{
            if(textOutline)textOutline.remove();
            if(textCopy)textCopy.remove();
          }
        }
        created.push(tf);
      }else if(x.type=='shape'){
        var root=dest.groupItems.add();root.name=x.name||'Shape';root.opacity=typeof x.opacity=='number'?x.opacity:100;
        for(var g=x.groups.length-1;g>=0;g--){var grp=x.groups[g];if(grp.style.gradientFill||grp.style.gradientStroke){gradientGroup(root,grp);continue;}var holder=root.groupItems.add();holder.name=grp.name||'Group';holder.opacity=typeof grp.opacity=='number'?grp.opacity*100:100;
          if(grp.paths.length>1){var cp=holder.compoundPathItems.add();cp.name=grp.name||'Compound Path';for(var p=0;p<grp.paths.length;p++)makePath(cp,grp.paths[p],grp.style);}
          else for(var p2=0;p2<grp.paths.length;p2++)makePath(holder,grp.paths[p2],grp.style);
        }created.push(root);
      }
    }catch(itemError){warnings.push(x.name+': '+itemError.toString());}}
    flushGradientBatch();dest.visible=true;doc.selection=null;for(var si=0;si<created.length;si++)created[si].selected=true;
    if(!created.length){try{dest.remove();}catch(_empty){}throw new Error('No objects transferred. '+warnings.join('; '));}
    if(warnings.length)alert('Transferify AE → AI: '+created.length+' layer(s) sent.\n'+warnings.join('\n'));
    return 'OK '+created.length;
  }catch(e){alert('Transferify AE → AI: '+e.toString()+' | Line: '+e.line);return 'ERROR';}finally{try{if(dest)dest.visible=true;}catch(_visible){}app.userInteractionLevel=oldInteraction;}
};

Transferify.sendToAI=function(){
  if(Transferify._host()!="ae")return "SEND TO AI • After Effects only";
  try{
    var c=Transferify._aeComp();
    if(!(c instanceof CompItem))return "Open a Comp";
    if(!c.selectedLayers.length)return "Select vector, image or text layer(s)";
    var data=Transferify._aeData();
    if(!data.items.length)return "Nothing sent: "+data.warnings.join("; ");
    var packet=new File(Folder.temp.fsName+"/transferify-ae-ai-"+new Date().getTime()+"-"+Math.floor(Math.random()*1000000000)+".txt");
    packet.encoding="ASCII";
    if(!packet.open("w"))throw Error("Cannot create transfer packet: "+packet.error);
    try{
      if(!packet.write(Transferify._encodePayload(data)))throw Error("Cannot write transfer packet: "+packet.error);
    }finally{packet.close();}
    var body="(function(){var packet=new File("+Transferify._quote(packet.fsName)+");"+
      "try{packet.encoding='ASCII';if(!packet.open('r'))throw Error('Cannot read transfer packet: '+packet.error);"+
      "var payload;try{payload=packet.read();}finally{packet.close();}"+
      "$.evalFile(new File("+Transferify._quote(Transferify._hostScriptPath)+"));"+
      "return Transferify._receiveAE(Transferify._decodePayload(payload));"+
      "}finally{try{packet.remove();}catch(_cleanup){}}})();";
    if(!Transferify._send("illustrator",body)){
      packet.remove();
      return "ERROR • AI not reachable";
    }
    return "SEND TO AI • 0.8.4 • awaiting Illustrator";
  }catch(e){return "ERROR "+e.number+": "+e.message+" line "+e.line;}
};

/* ---------- PUSH: one BridgeTalk request + onResult, no nested transport ---------- */
Transferify.pushFromAE=function(){
  if(Transferify._host()!="ai")return "PUSH FROM AE • Illustrator only";
  try{
    var body="$.evalFile(new File("+Transferify._quote(Transferify._hostScriptPath)+"));Transferify.sendToAI();";
    return Transferify._send("aftereffects",body)?"PUSH FROM AE • requested":"ERROR • After Effects not reachable";
  }catch(e){return "ERROR "+e.number+": "+e.message+" line "+e.line;}
};

Transferify.pushFromAI=function(folderPath,scanShadows){
  if(Transferify._host()!="ae")return "PUSH FROM AI • After Effects only";
  try{
    var body="$.evalFile(new File("+Transferify._quote(Transferify._hostScriptPath)+"));"+
      "Transferify.sendToAE("+Transferify._quote(folderPath)+","+(scanShadows===true||scanShadows=="true") +");";
    return Transferify._send("illustrator",body)?"PUSH FROM AI • requested":"ERROR • Illustrator not reachable";
  }catch(e){return "ERROR "+e.number+": "+e.message+" line "+e.line;}
};

/* ---------- GUIDES ---------- */
Transferify.importGuidesFromAI=function(){
  if(Transferify._host()!="ae")return "IMPORT GUIDES • After Effects only";
  try{
    var c=Transferify._aeComp();
    if(!(c instanceof CompItem))return "Open a Comp";
    var targetCompName=String(c.name);
    var bt=new BridgeTalk();bt.target=Transferify._bridgeTarget("illustrator");
    bt.body="(function(){try{if(!app.documents.length)return 'NO_DOC';var d=app.activeDocument,ab=d.artboards[d.artboards.getActiveArtboardIndex()],r=ab.artboardRect,a=[],tol=.5;for(var i=0;i<d.pathItems.length;i++){var p=d.pathItems[i];if(!p.guides)continue;var xs=[],ys=[];for(var k=0;k<p.pathPoints.length;k++){xs.push(Number(p.pathPoints[k].anchor[0]));ys.push(Number(p.pathPoints[k].anchor[1]));}if(xs.length<2)continue;var xmin=Math.min.apply(null,xs),xmax=Math.max.apply(null,xs),ymin=Math.min.apply(null,ys),ymax=Math.max.apply(null,ys);if(Math.abs(xmax-xmin)<=tol)a.push([1,(xmin+xmax)/2-r[0]]);else if(Math.abs(ymax-ymin)<=tol)a.push([0,r[1]-(ymin+ymax)/2]);}return a.toSource();}catch(e){return 'ERROR:'+e.toString();}})();";
    bt.onResult=function(res){
      try{
        if(res.body=="NO_DOC"){alert("Transferify: open an Illustrator document");return;}
        if(String(res.body).indexOf("ERROR:")==0){alert(res.body);return;}
        var a=eval("("+res.body+")");
        app.beginUndoGroup("Transferify Import Guides");
        Transferify._addAEGuides(c,a);
        app.endUndoGroup();
      }catch(e){try{app.endUndoGroup();}catch(end){}alert("Transferify guides AI → AE: "+e.toString());}
    };
    return bt.send()?"IMPORT GUIDES • requested":"ERROR • Illustrator not reachable";
  }catch(e){return "ERROR "+e.number+": "+e.message+" line "+e.line;}
};


/* ---------- PROVEN AE TOOLS FROM v0.1.4 ---------- */
Transferify._copyLayerTransformToShape = function (src,dst) {
    var s=src.property("ADBE Transform Group"), d=dst.property("ADBE Transform Group");
    function cp(name){try{var a=s.property(name),b=d.property(name);if(a&&b)b.setValue(a.value);}catch(e){}}
    cp("ADBE Anchor Point");cp("ADBE Position");cp("ADBE Scale");cp("ADBE Rotate Z");cp("ADBE Opacity");
};

Transferify._stageDecomp=function(comp,pre){
  var created=[],ctrl=null;
  try{var preID=pre.id,source=pre.source;
    var factor=pre.stretch/100,base=pre.startTime,sourceStart=source.displayStartTime||0,map={},parents={},mattes={},originals=[];
    ctrl=comp.layers.addNull();var ctrlID=ctrl.id;ctrl.name=pre.name;ctrl.guideLayer=true;ctrl.shy=true;ctrl.threeDLayer=pre.threeDLayer;ctrl.comment='Transferify Un-Precomp controller';if(pre.parent)ctrl.setParentWithJump(pre.parent);
    function copyProperty(a,d){if(!a||!d)return;if(a.isSeparationLeader&&a.dimensionsSeparated){d.dimensionsSeparated=true;for(var j=0;j<(pre.threeDLayer?3:2);j++)copyProperty(a.getSeparationFollower(j),d.getSeparationFollower(j));return;}if(a.numKeys){for(var k=1;k<=a.numKeys;k++){d.setValueAtTime(a.keyTime(k),a.keyValue(k));try{d.setInterpolationTypeAtKey(k,a.keyInInterpolationType(k),a.keyOutInterpolationType(k));d.setTemporalEaseAtKey(k,a.keyInTemporalEase(k),a.keyOutTemporalEase(k));if(a.isSpatial)d.setSpatialTangentsAtKey(k,a.keyInSpatialTangent(k),a.keyOutSpatialTangent(k));}catch(_key){}}}else d.setValue(a.value);if(a.canSetExpression&&a.expressionEnabled)d.expression=a.expression;}
    var a=pre.property('ADBE Transform Group'),d=ctrl.property('ADBE Transform Group'),names=['ADBE Anchor Point','ADBE Position','ADBE Scale','ADBE Rotate Z','ADBE Opacity'];if(pre.threeDLayer)names=names.concat(['ADBE Orientation','ADBE Rotate X','ADBE Rotate Y']);for(var i=0;i<names.length;i++)copyProperty(a.property(names[i]),d.property(names[i]));
    var artLayers=[];for(var ai=1;ai<=source.numLayers;ai++)artLayers.push(source.layer(ai));var artBounds=Transferify._artBounds(artLayers,sourceStart+(comp.time-base)/factor);
    if(!artBounds)throw Error('Unable to measure artwork bounds; DECOMP cancelled to avoid an incorrectly positioned null');
    if(artBounds&&!ctrl.threeDLayer){var ct=ctrl.property('ADBE Transform Group'),anchorProperty=ct.property('ADBE Anchor Point'),oldAnchor=anchorProperty.value,newAnchor=artBounds.center,dx=newAnchor[0]-oldAnchor[0],dy=newAnchor[1]-oldAnchor[1],positionProperty=ct.property('ADBE Position');anchorProperty.setValue(newAnchor);
      var compensation='var d=['+dx+','+dy+'];var a=rotation*Math.PI/180;var x=d[0]*scale[0]/100;var y=d[1]*scale[1]/100;[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];';
      if(positionProperty.dimensionsSeparated){for(var di=0;di<2;di++){var follower=positionProperty.getSeparationFollower(di),originalExpression=follower.expressionEnabled?follower.expression:null;follower.expression='var base='+(originalExpression?'eval('+Transferify._quote(originalExpression)+')':'value')+';var offset=eval('+Transferify._quote(compensation)+');base+offset['+di+'];';}}
      else{var originalExpression=positionProperty.expressionEnabled?positionProperty.expression:null;positionProperty.expression='var base='+(originalExpression?'eval('+Transferify._quote(originalExpression)+')':'value')+';var offset=eval('+Transferify._quote(compensation)+');base+offset;';}
    }
    for(var i=source.numLayers;i>=1;i--){var sl=source.layer(i);if(sl.hasTrackMatte)mattes[i]={index:sl.trackMatteLayer.index,type:sl.trackMatteType};var sourceParent=sl.parent,parentIndex=sourceParent?sourceParent.index:0,sourceLocked=sl.locked,sourceName=sl.name,beforeCopy={};for(var q=1;q<=comp.numLayers;q++)beforeCopy[comp.layer(q).id]=true;sl.locked=false;try{sl.setParentWithJump(null);sl.copyToComp(comp);}finally{sl.setParentWithJump(sourceParent);sl.locked=sourceLocked;}var layer=null;for(var q=1;q<=comp.numLayers;q++)if(!beforeCopy[comp.layer(q).id]){layer=comp.layer(q);break;}if(!layer)throw Error('After did not create the copied layer');created.push(layer.id);originals.push(sl);layer.name=sourceName;layer.locked=false;layer.setParentWithJump(null);layer.stretch=sl.stretch*factor;layer.startTime=base+(sl.startTime-sourceStart)*factor;var t1=base+(sl.inPoint-sourceStart)*factor,t2=base+(sl.outPoint-sourceStart)*factor;layer.inPoint=Math.max(pre.inPoint,Math.min(t1,t2));layer.outPoint=Math.min(pre.outPoint,Math.max(t1,t2));map[sl.index]=layer.id;parents[sl.index]=parentIndex;}
    function findLayer(id){for(var j=1;j<=comp.numLayers;j++)if(comp.layer(j).id==id)return comp.layer(j);throw Error('Copied layer missing');}
    ctrl=findLayer(ctrlID);pre=findLayer(preID);for(var j=0;j<created.length;j++)created[j]=findLayer(created[j]);for(var j=1;j<=source.numLayers;j++)map[j]=findLayer(map[j]);
    for(var i=1;i<=source.numLayers;i++){if(map[i]===ctrl||(parents[i]&&map[i]===map[parents[i]]))throw Error('Copy mapping invalid: source '+i+' / parent '+parents[i]+' / layer '+map[i].name+' / controller '+ctrl.name);map[i].setParentWithJump(parents[i]?map[parents[i]]:ctrl);}
    // A null's visible square is defined in its own source coordinates.
    // Keep its anchor at that square's center, and offset child coordinates
    // to retain the exact same artwork transform after recentering.
    if(artBounds&&!ctrl.threeDLayer){
      var centerAnchor=[ctrl.width/2,ctrl.height/2],childOffset=[centerAnchor[0]-artBounds.center[0],centerAnchor[1]-artBounds.center[1]];
      function offsetPosition(prop,offset){
        if(prop.dimensionsSeparated){for(var axis=0;axis<2;axis++)offsetPosition(prop.getSeparationFollower(axis),offset[axis]);return;}
        function shifted(value){if(typeof offset=='number')return value+offset;var out=[];for(var axis=0;axis<value.length;axis++)out.push(value[axis]+(offset[axis]||0));return out;}
        if(prop.expressionEnabled){var expression=prop.expression;prop.expression='var original=eval('+Transferify._quote(expression)+');original+'+Transferify._plainJSON(offset)+';';}
        else if(prop.numKeys){for(var key=1;key<=prop.numKeys;key++)prop.setValueAtKey(key,shifted(prop.keyValue(key)));}
        else prop.setValue(shifted(prop.value));
      }
      for(var index=1;index<=source.numLayers;index++)if(!parents[index])offsetPosition(map[index].property('ADBE Transform Group').property('ADBE Position'),childOffset);
      ctrl.property('ADBE Transform Group').property('ADBE Anchor Point').setValue(centerAnchor);
    }
    var keepMatte={};
    for(var key in mattes)if(mattes.hasOwnProperty(key)){
      var m=mattes[key];map[key].setTrackMatte(map[m.index],m.type);map[m.index].enabled=false;
      keepMatte[map[m.index].id]=true;
    }
    // Discard legacy Figma group outlines while retaining their children's transforms.
    for(var i=created.length-1;i>=0;i--){
      var helper=created[i],contents=helper.property('ADBE Root Vectors Group');
      if(!helper.guideLayer||helper.enabled||keepMatte[helper.id]||String(helper.comment).indexOf('Transferify Figma ')!==0||!contents||contents.numProperties!=1||contents.property(1).name!='Group bounds')continue;
      for(var j=0;j<created.length;j++)if(created[j].parent&&created[j].parent.id==helper.id)created[j].parent=helper.parent;
      helper.remove();created.splice(i,1);originals.splice(i,1);
    }
    ctrl.moveBefore(pre);for(var i=created.length-1;i>=0;i--)created[i].moveBefore(pre);
    for(var i=0;i<created.length;i++)created[i].locked=originals[i].locked;
    var ids=[];for(var i=0;i<created.length;i++)ids.push(created[i].id);
    return {preID:preID,source:source,ctrlID:ctrlID,layerIDs:ids};
  }catch(e){
    for(var i=created.length-1;i>=0;i--)try{var failed=typeof created[i]=='number'?findLayer(created[i]):created[i];failed.locked=false;failed.remove();}catch(_){}
    if(ctrl)try{ctrl.remove();}catch(_){}
    throw e;
  }
};

Transferify.decomp=function(){
 var comp=Transferify._aeComp(),staged=[],began=false,committing=false,targets=[],sources={},total=0;
 if(!comp)return 'Open a composition';var selection=comp.selectedLayers;if(!selection.length)return 'Select one or more precomp layers';
 function find(id){for(var i=1;i<=comp.numLayers;i++)if(comp.layer(i).id==id)return comp.layer(i);throw Error('DECOMP layer no longer exists: '+id);}
 try{
  // Validate the entire batch before creating or removing anything.
  for(var i=0;i<selection.length;i++){var pre=selection[i];if(!(pre.source instanceof CompItem))return 'DECOMP: select only precomp layers; nothing changed';if(pre.timeRemapEnabled)return 'DECOMP: disable Time Remapping on '+pre.name+'; nothing changed';if(!pre.source.numLayers)return 'DECOMP: empty precomp '+pre.name+'; nothing changed';if(!isFinite(pre.stretch)||!pre.stretch)return 'DECOMP: invalid stretch; nothing changed';if(pre.hasTrackMatte||pre.isTrackMatte)return 'DECOMP: external track matte on '+pre.name+' requires manual conversion; nothing changed';
   for(var j=1;j<=pre.source.numLayers;j++){var child=pre.source.layer(j);if((typeof LightLayer!='undefined'&&child instanceof LightLayer)||(typeof CameraLayer!='undefined'&&child instanceof CameraLayer))return 'DECOMP: lights/cameras require manual conversion; nothing changed';if(child.hasTrackMatte&&(!child.trackMatteLayer||child.trackMatteLayer.containingComp!==pre.source))return 'DECOMP: invalid internal track matte; nothing changed';}
   targets.push({id:pre.id,index:pre.index});
  }
  targets.sort(function(a,b){return b.index-a.index;});app.beginUndoGroup('Transferify DECOMP');began=true;
  for(var i=0;i<targets.length;i++){var stage=Transferify._stageDecomp(comp,find(targets[i].id));staged.push(stage);total+=stage.layerIDs.length;}
  // Only commit after all copies exist. Keep outside children parented to the equivalent controller.
  committing=true;for(var i=0;i<staged.length;i++){var pre=find(staged[i].preID),control=find(staged[i].ctrlID);for(var j=1;j<=comp.numLayers;j++){var child=comp.layer(j);if(child!==control&&child.parent&&child.parent.id===pre.id){var locked=child.locked;child.locked=false;try{child.parent=control;}finally{child.locked=locked;}}}pre.remove();sources[staged[i].source.id]=staged[i].source;}
  for(var id in sources)if(sources.hasOwnProperty(id)&&!sources[id].usedIn.length)sources[id].remove();
  for(var i=1;i<=comp.numLayers;i++)try{comp.layer(i).selected=false;}catch(_selection){}for(var i=0;i<staged.length;i++)for(var j=0;j<staged[i].layerIDs.length;j++)try{find(staged[i].layerIDs[j]).selected=true;}catch(_selection){}
  return 'DECOMP • '+targets.length+' precomps • '+total+' layers';
 }catch(e){if(!committing){for(var i=staged.length-1;i>=0;i--){var ids=staged[i].layerIDs.concat([staged[i].ctrlID]);for(var j=0;j<ids.length;j++)try{var l=find(ids[j]);l.locked=false;l.remove();}catch(_cleanup){}}}return 'ERROR: '+String(e)+(committing?' • use Undo to restore the batch':' • originals preserved')+' | line '+e.line;
 }finally{if(began)app.endUndoGroup();}
};

/* ========================= RECOMP ========================= */
/* Creates a tightly cropped precomp from the selected layers.
   Spatial bounds = union of the selected layers' visual bounds in comp space.
   Temporal bounds = min inPoint .. max outPoint.
   Internal layer timing and relative placement are preserved. */
Transferify.recomp = function(){
  if(Transferify._host()!="ae")return "RECOMP • After Effects only";
  var undo=false;
  try{
    var comp=Transferify._aeComp();
    if(!(comp instanceof CompItem))return "Open a Comp";
    var sel=comp.selectedLayers;
    if(!sel||!sel.length)return "Select one or more layers";

    var minT=1e20,maxT=-1e20;
    var minX=1e20,minY=1e20,maxX=-1e20,maxY=-1e20;

    function addPt(layer,p){
      try{
        var q=layer.sourcePointToComp(p);
        if(q&&q.length>=2){
          minX=Math.min(minX,Number(q[0]));maxX=Math.max(maxX,Number(q[0]));
          minY=Math.min(minY,Number(q[1]));maxY=Math.max(maxY,Number(q[1]));
        }
      }catch(_p){}
    }

    /* Use sourceRectAtTime for Text/Shape and footage dimensions for AV layers.
       Sampling start/middle/end makes animated bounds safer without exploding cost. */
    for(var i=0;i<sel.length;i++){
      var l=sel[i];
      minT=Math.min(minT,Number(l.inPoint));
      maxT=Math.max(maxT,Number(l.outPoint));

      var times=[Math.max(l.inPoint,comp.displayStartTime),
                 Math.max(l.inPoint,Math.min(l.outPoint-1/comp.frameRate,(l.inPoint+l.outPoint)/2)),
                 Math.max(l.inPoint,Math.min(l.outPoint-1/comp.frameRate,comp.time))];
      for(var ti=0;ti<times.length;ti++){
        var t=times[ti],r=null;
        try{r=l.sourceRectAtTime(t,false);}catch(_sr){}
        if(r&&isFinite(r.left)&&isFinite(r.top)&&isFinite(r.width)&&isFinite(r.height)){
          addPt(l,[r.left,r.top]);
          addPt(l,[r.left+r.width,r.top]);
          addPt(l,[r.left,r.top+r.height]);
          addPt(l,[r.left+r.width,r.top+r.height]);
        }else{
          try{
            if(l.source&&l.source.width&&l.source.height){
              addPt(l,[0,0]);addPt(l,[l.source.width,0]);
              addPt(l,[0,l.source.height]);addPt(l,[l.source.width,l.source.height]);
            }
          }catch(_av){}
        }
      }
    }

    if(minX>maxX||minY>maxY)return "RECOMP • Could not determine visual bounds";
    var fps=comp.frameRate||30,frame=1/fps;
    var dur=Math.max(frame,maxT-minT);
    var w=Math.max(1,Math.ceil(maxX-minX));
    var ht=Math.max(1,Math.ceil(maxY-minY));

    app.beginUndoGroup("Transferify Recomp");undo=true;

    /* Native precompose preserves the selected layers and their relative timing. */
    var idx=[];
    for(var k=0;k<sel.length;k++)idx.push(sel[k].index);
    idx.sort(function(a,b){return a-b;});
    var nm=(sel.length==1?sel[0].name:"RECOMP")+" • RECOMP";
    var pc=comp.layers.precompose(idx,nm,true);
    var preLayer=null;
    for(var li=1;li<=comp.numLayers;li++){
      if(comp.layer(li).source===pc){preLayer=comp.layer(li);break;}
    }
    if(!preLayer)throw new Error("Could not find new precomp layer");

    /* Crop the source comp to the visual union. Existing child coordinates are in
       parent-comp space after native precompose, so shift every top-level child by
       -min bounds. Parenting is respected by shifting only unparented roots. */
    pc.width=w;pc.height=ht;pc.duration=dur;
    pc.displayStartTime=0;

    for(var ci=1;ci<=pc.numLayers;ci++){
      var cl=pc.layer(ci);
      try{
        cl.startTime=Number(cl.startTime)-minT;
        cl.inPoint=Math.max(0,Number(cl.inPoint)-minT);
        cl.outPoint=Math.min(dur,Number(cl.outPoint)-minT);
      }catch(_time){}
    }
    for(var ri=1;ri<=pc.numLayers;ri++){
      var rl=pc.layer(ri);
      try{
        if(rl.parent==null){
          var pp=rl.property("ADBE Transform Group").property("ADBE Position");
          var pv=pp.value;
          pp.setValue([pv[0]-minX,pv[1]-minY].concat(pv.length>2?[pv[2]]:[]));
        }
      }catch(_shift){}
    }

    /* Put the resulting precomp exactly over the original visual bounds and time span. */
    try{
      var tr=preLayer.property("ADBE Transform Group");
      tr.property("ADBE Anchor Point").setValue([0,0]);
      tr.property("ADBE Position").setValue([minX,minY]);
      tr.property("ADBE Scale").setValue([100,100]);
      tr.property("ADBE Rotate Z").setValue(0);
    }catch(_tr){}
    preLayer.startTime=minT;
    preLayer.inPoint=minT;
    preLayer.outPoint=maxT;

    app.endUndoGroup();undo=false;
    return "RECOMP • "+w+"×"+ht+" • "+dur.toFixed(3)+"s";
  }catch(e){
    if(undo)try{app.endUndoGroup();}catch(_end){}
    return "ERROR "+e.number+": "+e.message+" line "+e.line;
  }
};

/* ========================= SPLIT ========================= */

Transferify.splitLayers = function () {
  if(Transferify._host()!="ae")return "After Effects only";
  var undo=false;
  try{
    var c=Transferify._aeComp();if(!c)return "Open a Comp";
    var selected=c.selectedLayers,ls=[];for(var si=0;si<selected.length;si++)ls.push(selected[si]);
    if(!ls.length)return "Select Shape Layer(s)";
    app.beginUndoGroup("Transferify Split");undo=true;var made=0,skipped=0;
    function branches(contents,prefix){
      var children=[],hasShape=false;
      for(var i=1;i<=contents.numProperties;i++){
        var prop=contents.property(i);
        if(prop.matchName=="ADBE Vector Group")children.push(i);
        else if(String(prop.matchName).indexOf("ADBE Vector Shape")===0)hasShape=true;
      }
      if(!hasShape&&children.length==1)return branches(contents.property(children[0]).property("ADBE Vectors Group"),prefix.concat([children[0]]));
      if(!hasShape&&children.length>1){var out=[];for(var k=0;k<children.length;k++)out.push(prefix.concat([children[k]]));return out;}
      return prefix.length?[prefix]:[];
    }
    for(var li=ls.length-1;li>=0;li--){
      var layer=ls[li];if(!(layer instanceof ShapeLayer))continue;
      var paths=branches(layer.property("ADBE Root Vectors Group"),[]);
      if(paths.length<2){skipped++;continue;}
      var created=[];
      try{
        for(var pi=0;pi<paths.length;pi++){
          var copy=layer.duplicate();created.push(copy);var contents=copy.property("ADBE Root Vectors Group"),path=paths[pi],leafName=layer.name;
          for(var depth=0;depth<path.length;depth++){
            var keep=path[depth];
            for(var r=contents.numProperties;r>=1;r--)if(r!=keep&&contents.property(r).matchName=="ADBE Vector Group")contents.property(r).remove();
            // The kept group can shift index after sibling removal; find it afresh.
            var group=null;for(var q=1;q<=contents.numProperties;q++)if(contents.property(q).matchName=="ADBE Vector Group"){group=contents.property(q);break;}
            if(!group)throw new Error("Split group missing");leafName=group.name;contents=group.property("ADBE Vectors Group");
          }
          copy.name=leafName;Transferify._centerShapeAnchor(copy,c);
        }
      }catch(e){for(var ci=created.length-1;ci>=0;ci--)try{created[ci].remove();}catch(_cleanup){}throw e;}
      layer.remove();made+=created.length;
    }
    app.endUndoGroup();undo=false;return "SPLIT • "+made+(skipped?" • "+skipped+" preserved":"");
  }catch(e){if(undo)try{app.endUndoGroup();}catch(_end){}return "ERROR: "+e.toString();}
};

/* ========================= JOIN ========================= */

Transferify._cloneVectorProperty = function (src,dstContents) {
    try {
        if(src.matchName=="ADBE Vector Group"){
            var g=dstContents.addProperty("ADBE Vector Group");g.name=src.name;
            var sc=src.property("ADBE Vectors Group"), dc=g.property("ADBE Vectors Group");
            for(var i=1;i<=sc.numProperties;i++)Transferify._cloneVectorProperty(sc.property(i),dc);
            var st=src.property("ADBE Vector Transform Group"), dt=g.property("ADBE Vector Transform Group");
            for(var ti=1;ti<=st.numProperties;ti++){var sp=st.property(ti),dp=dt.property(sp.matchName);if(dp){try{dp.setValue(sp.value);}catch(_v){}}}
            return g;
        }
        var d=dstContents.addProperty(src.matchName);d.name=src.name;
        if(src.propertyType==PropertyType.PROPERTY){try{d.setValue(src.value);}catch(_x){}}
        else {for(var j=1;j<=src.numProperties;j++){var ch=src.property(j);if(ch.propertyType==PropertyType.PROPERTY){var dd=d.property(ch.matchName);if(dd){try{dd.setValue(ch.value);}catch(_y){}}}}}
        return d;
    } catch(e){return null;}
};

Transferify.joinLayers = function () {
    if(Transferify._host()!="ae")return "JOIN LAYERS • After Effects only";
    var undo=false,joined=null,committed=false;
    try{
        var c=Transferify._aeComp();if(!(c instanceof CompItem))return "Open a Comp";
        var ls=c.selectedLayers;ls.sort(function(a,b){return a.index-b.index;});if(ls.length<2)return "Select at least 2 Shape Layers";
        var ids=[],chains=[],time=c.time;
        function sample(property){return property.valueAtTime(time,false);}
        for(var q=0;q<ls.length;q++){
            if(!(ls[q] instanceof ShapeLayer))return "JOIN works with Shape Layers only";
            var chain=[],node=ls[q];
            while(node){
                if(node.threeDLayer)return 'JOIN: 3D layers or parents are not supported; nothing changed.';
                var tr=node.property('ADBE Transform Group');
                chain.unshift({name:node.name,anchor:sample(tr.property('ADBE Anchor Point')),position:sample(tr.property('ADBE Position')),scale:sample(tr.property('ADBE Scale')),rotation:sample(tr.property('ADBE Rotate Z')),opacity:node==ls[q]?sample(tr.property('ADBE Opacity')):100});
                node=node.parent;
            }
            chains.push(chain);ids.push(ls[q].id);
        }
        function find(id){for(var i=1;i<=c.numLayers;i++)if(c.layer(i).id==id)return c.layer(i);throw Error('JOIN source layer missing');}
        app.beginUndoGroup("Transferify Join");undo=true;
        joined=c.layers.addShape();joined.name="JOINED";joined.moveBefore(find(ids[0]));
        var transform=joined.property('ADBE Transform Group');transform.property('ADBE Anchor Point').setValue([0,0]);transform.property('ADBE Position').setValue([0,0]);
        for(var i=0;i<ids.length;i++){
            var src=find(ids[i]),destination=joined.property('ADBE Root Vectors Group');
            // Compose the full parent chain through nested vector transforms.
            // Mixing a comp-space origin with local scale/rotation loses parent transforms.
            for(var depth=0;depth<chains[i].length;depth++){
                var state=chains[i][depth],wrap=destination.addProperty('ADBE Vector Group');wrap.name=state.name;
                var vt=wrap.property('ADBE Vector Transform Group');
                vt.property('ADBE Vector Anchor').setValue([state.anchor[0],state.anchor[1]]);
                vt.property('ADBE Vector Position').setValue([state.position[0],state.position[1]]);
                vt.property('ADBE Vector Scale').setValue([state.scale[0],state.scale[1]]);
                vt.property('ADBE Vector Rotation').setValue(state.rotation);
                vt.property('ADBE Vector Group Opacity').setValue(state.opacity);
                destination=wrap.property('ADBE Vectors Group');
            }
            var contents=src.property('ADBE Root Vectors Group');
            for(var p=1;p<=contents.numProperties;p++)if(!Transferify._cloneVectorProperty(contents.property(p),destination))throw Error('Unable to copy vector content: '+src.name);
        }
        committed=true;
        for(var r=0;r<ids.length;r++)find(ids[r]).remove();
        Transferify._centerShapeAnchor(joined,c);
        return 'JOIN • '+ids.length+' layers • current frame';
    }catch(e){if(joined&&!committed)try{joined.remove();}catch(_remove){}return 'ERROR: '+String(e);}
    finally{if(undo)app.endUndoGroup();}
};

/* ========================= REMOVE ARTBOARD ========================= */

Transferify.removeArtboard = function () {
    if(Transferify._host()!="ae")return "REMOVE ARTBOARD • After Effects only";
    try{
        var c=Transferify._aeComp();if(!(c instanceof CompItem))return "Open a Comp";var ls=c.selectedLayers;if(!ls.length)return "Select Shape Layer(s)";
        app.beginUndoGroup("Transferify Remove Artboard");var removed=0,tol=3;
        function scan(g){
            for(var i=g.numProperties;i>=1;i--){
                var p=g.property(i);
                if(p.matchName=="ADBE Vector Group"){var vg=p.property("ADBE Vectors Group");scan(vg);if(vg.numProperties===0){try{p.remove();}catch(_x){}}}
                else if(p.matchName=="ADBE Vector Shape - Rect"){
                    var sz=p.property("ADBE Vector Rect Size").value;if(Math.abs(Math.abs(sz[0])-c.width)<=tol&&Math.abs(Math.abs(sz[1])-c.height)<=tol){p.remove();removed++;}
                } else if(p.matchName=="ADBE Vector Shape - Group"){
                    var sh=p.property("ADBE Vector Shape").value;if(sh&&sh.vertices&&sh.vertices.length==4){var xs=[],ys=[];for(var q=0;q<4;q++){xs.push(sh.vertices[q][0]);ys.push(sh.vertices[q][1]);}var w=Math.max.apply(null,xs)-Math.min.apply(null,xs),h=Math.max.apply(null,ys)-Math.min.apply(null,ys);if(Math.abs(w-c.width)<=tol&&Math.abs(h-c.height)<=tol){p.remove();removed++;}}
                }
            }
        }
        for(var l=0;l<ls.length;l++)if(ls[l] instanceof ShapeLayer)scan(ls[l].property("ADBE Root Vectors Group"));
        app.endUndoGroup();return "REMOVE ARTBOARD • "+removed;
    }catch(e){try{app.endUndoGroup();}catch(_e){}return "ERROR "+e.number+": "+e.message+" line "+e.line;}
};

Transferify.importGuidesFromAE=function(){
  if(Transferify._host()!="ai")return "Illustrator only";
  try{
    if(!app.documents.length)return "Open an Illustrator document";
    var doc=app.activeDocument,idx=0;for(var di=0;di<app.documents.length;di++)if(app.documents[di]==doc)idx=di;
    var name=String(doc.name),ab=doc.artboards.getActiveArtboardIndex();
    var bt=new BridgeTalk();bt.target=Transferify._bridgeTarget("aftereffects");
    bt.body="(function(){try{var comp=("+Transferify._aeComp.toString()+")();if(!comp)return 'NO_COMP';return ("+Transferify._plainJSON.toString()+")(("+Transferify._readAEGuides.toString()+")(comp));}catch(e){return 'ERROR:'+e.toString();}})();";
    bt.onResult=function(res){
      if(res.body=="NO_COMP"||String(res.body).indexOf("ERROR:")==0){alert("Transferify Guides: "+res.body);return;}
      // Re-enter Illustrator through BridgeTalk: callback can lack an active document context.
      var receive=new BridgeTalk();receive.target=Transferify._bridgeTarget("illustrator");
      receive.body="("+Transferify._receiveGuidesAI.toString()+")("+res.body+","+idx+","+Transferify._quote(name)+","+ab+");";
      receive.onResult=function(r){if(String(r.body).indexOf("ERROR")>=0||r.body=="NO_DOC")alert("Transferify Guides: "+r.body);};
      receive.onError=function(e){alert("Transferify Guides: "+e.body);};receive.send();
    };
    bt.onError=function(e){alert("Transferify Guides: "+e.body);};
    return bt.send()?"IMPORT GUIDES • requested":"ERROR • AE not reachable";
  }catch(e){return "ERROR: "+e.toString();}
};

Transferify.pushGuidesToAE=function(){
  if(Transferify._host()!="ai")return "Illustrator only";
  try{
    if(!app.documents.length)return "Open an Illustrator document";
    var d=app.activeDocument,r=d.artboards[d.artboards.getActiveArtboardIndex()].artboardRect,a=[],tol=.5;
    for(var i=0;i<d.pathItems.length;i++){var p=d.pathItems[i];if(!p.guides)continue;var xs=[],ys=[];for(var k=0;k<p.pathPoints.length;k++){xs.push(Number(p.pathPoints[k].anchor[0]));ys.push(Number(p.pathPoints[k].anchor[1]));}if(xs.length<2)continue;var xmin=Math.min.apply(null,xs),xmax=Math.max.apply(null,xs),ymin=Math.min.apply(null,ys),ymax=Math.max.apply(null,ys);if(Math.abs(xmax-xmin)<=tol)a.push([1,(xmin+xmax)/2-r[0]]);else if(Math.abs(ymax-ymin)<=tol)a.push([0,r[1]-(ymin+ymax)/2]);}
    var bt=new BridgeTalk();bt.target=Transferify._bridgeTarget("aftereffects");
    bt.body="(function(){try{var Transferify={_readAEGuides:"+Transferify._readAEGuides.toString()+"};var c=("+Transferify._aeComp.toString()+")();if(!c)return 'NO_COMP';app.beginUndoGroup('Transferify Guides');var count=("+Transferify._addAEGuides.toString()+")(c,"+Transferify._plainJSON(a)+");app.endUndoGroup();return 'GUIDES:'+count;}catch(e){try{app.endUndoGroup();}catch(_end){}return 'ERROR:'+e.toString();}})();";
    bt.onResult=function(r){if(r.body=="NO_COMP"||String(r.body).indexOf("ERROR:")==0)alert("Transferify Guides: "+r.body);};
    bt.onError=function(e){alert("Transferify Guides: "+e.body);};
    return bt.send()?"PUSH GUIDES • sent":"ERROR • AE not reachable";
  }catch(e){return "ERROR: "+e.toString();}
};
Transferify.pushGuidesToAI=function(){
  if(Transferify._host()!="ae")return "After Effects only";
  try{
    var c=Transferify._aeComp();if(!c)return "Open a Comp";
    var bt=new BridgeTalk();bt.target=Transferify._bridgeTarget("illustrator");
    bt.body="(function(){if(!app.documents.length)return 'NO_DOC';var d=app.activeDocument,index=0;for(var i=0;i<app.documents.length;i++)if(app.documents[i]==d)index=i;return ("+Transferify._receiveGuidesAI.toString()+")("+Transferify._plainJSON(Transferify._readAEGuides(c))+",index,String(d.name),d.artboards.getActiveArtboardIndex());})();";
    bt.onResult=function(r){if(r.body=="NO_DOC"||String(r.body).indexOf("ERROR:")==0)alert("Transferify Guides: "+r.body);};
    bt.onError=function(e){alert("Transferify Guides: "+e.body);};
    return bt.send()?"PUSH GUIDES • sent":"ERROR • AI not reachable";
  }catch(e){return "ERROR: "+e.toString();}
};

Transferify._centerShapeAnchor=function(layer,comp){
  try{
    if(!(layer instanceof ShapeLayer)||layer.threeDLayer)return;
    var tr=layer.property("ADBE Transform Group"),ap=tr.property("ADBE Anchor Point"),pos=tr.property("ADBE Position");
    var oldA=ap.value,oldP=pos.value,r=layer.sourceRectAtTime(comp.time,false),newA=[r.left+r.width/2,r.top+r.height/2];
    var scale=tr.property("ADBE Scale").value,angle=tr.property("ADBE Rotate Z").value*Math.PI/180;
    var dx=(newA[0]-oldA[0])*scale[0]/100,dy=(newA[1]-oldA[1])*scale[1]/100;
    ap.setValue(newA);pos.setValue([oldP[0]+Math.cos(angle)*dx-Math.sin(angle)*dy,oldP[1]+Math.sin(angle)*dx+Math.cos(angle)*dy]);
  }catch(e){}
};


Transferify._applyDropShadowLayerStyle=function(layer,ds){
  if(!layer||!ds||!ds.enabled)return false;
  try{
    var styles=layer.property("ADBE Layer Styles"),shadow=styles?styles.property("dropShadow/enabled"):null;
    if(shadow&&!shadow.canSetEnabled){
      var c=layer.containingComp,saved=[];
      for(var i=1;i<=c.numLayers;i++){var sl=c.layer(i);if(sl.selected)saved.push(sl);sl.selected=false;}
      try{c.openInViewer();layer.selected=true;var command=app.findMenuCommandId("Drop Shadow");if(command>0)app.executeCommand(command);}
      finally{layer.selected=false;for(var j=0;j<saved.length;j++)try{saved[j].selected=true;}catch(_selection){}}
      styles=layer.property("ADBE Layer Styles");shadow=styles?styles.property("dropShadow/enabled"):null;
    }
    if(shadow&&shadow.canSetEnabled){
      shadow.enabled=true;
      function set(name,value){var prop=shadow.property(name);if(prop)prop.setValue(value);}
      set("dropShadow/color",ds.color||[0,0,0]);set("dropShadow/opacity",Math.max(0,Math.min(100,Number(ds.opacity))));
      set("dropShadow/useGlobalAngle",0);set("dropShadow/localLightingAngle",Number(ds.angle));
      set("dropShadow/distance",Number(ds.distance));set("dropShadow/chokeMatte",0);set("dropShadow/blur",Number(ds.size)||0);return true;
    }
    var effects=layer.property("ADBE Effect Parade"),effect=effects.addProperty("ADBE Drop Shadow");
    effect.property("ADBE Drop Shadow-0001").setValue(ds.color||[0,0,0]);
    var op=effect.property("ADBE Drop Shadow-0002");op.setValue(Math.max(0,Math.min(100,Number(ds.opacity)))*(op.maxValue==255?2.55:1));
    effect.property("ADBE Drop Shadow-0003").setValue((270-Number(ds.angle)+360)%360);
    effect.property("ADBE Drop Shadow-0004").setValue(Number(ds.distance));effect.property("ADBE Drop Shadow-0005").setValue((Number(ds.size)||0)*2);return true;
  }catch(_shadow){return false;}
};

// Figma payload bounds: tolerate legacy boxes and constrain original photos by their mattes.
Transferify._figmaGroupBounds=function(nodes,groupId,parents){
 var byId={},left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 for(var i=0;i<nodes.length;i++)byId[nodes[i].id]=nodes[i];
 function bounds(n){var b=n.kind=='image'?n.imageBox:n.kind=='text'?n.glyphBounds:null;if(!b)b={x:0,y:0,width:n.width,height:n.height};var x=Number(b.x||0),y=Number(b.y||0),w=Number(b.width),h=Number(b.height),pad=n.stroke?Number(n.strokeWeight||0)/2:0,m=n.matrix;if(!isFinite(w)||!isFinite(h)||w<0||h<0||!m||!m[0]||!m[1])throw Error('Invalid group bounds: '+n.name);x-=pad;y-=pad;w+=2*pad;h+=2*pad;var corners=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],out={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};for(var c=0;c<corners.length;c++){var px=m[0][0]*corners[c][0]+m[0][1]*corners[c][1]+m[0][2],py=m[1][0]*corners[c][0]+m[1][1]*corners[c][1]+m[1][2];if(!isFinite(px)||!isFinite(py))throw Error('Invalid group transform: '+n.name);out.left=Math.min(out.left,px);out.top=Math.min(out.top,py);out.right=Math.max(out.right,px);out.bottom=Math.max(out.bottom,py);}return out;}
 for(var i=0;i<nodes.length;i++){var n=nodes[i];if(n.kind=='group'||n.reference||n.isMatte)continue;var ancestor=n.parentId,depth=0;while(ancestor&&ancestor!=groupId){if(++depth>nodes.length)throw Error('Cyclic group parents');ancestor=parents[ancestor];}if(ancestor!=groupId)continue;
  var box=bounds(n),maskId=n.matteId,seen={};while(maskId){if(seen[maskId])throw Error('Cyclic group matte');seen[maskId]=true;var mask=byId[maskId];if(!mask)throw Error('Missing group matte: '+maskId);var clip=bounds(mask);box.left=Math.max(box.left,clip.left);box.top=Math.max(box.top,clip.top);box.right=Math.min(box.right,clip.right);box.bottom=Math.min(box.bottom,clip.bottom);maskId=mask.matteId;}
  if(box.right<=box.left||box.bottom<=box.top)continue;left=Math.min(left,box.left);top=Math.min(top,box.top);right=Math.max(right,box.right);bottom=Math.max(bottom,box.bottom);
 }
 if(!isFinite(left))return null;left=Math.floor(left)-10;top=Math.floor(top)-10;right=Math.ceil(right)+10;bottom=Math.ceil(bottom)+10;return {left:left,top:top,width:Math.max(1,right-left),height:Math.max(1,bottom-top)};
};

/* ---------- FIGMA -> AE ONLY ---------- */
/* Resize only the primitive exported as the original Figma frame background. */
Transferify._fitFigmaFrameRectangle=function(data,node,layer){
  var frameId=data.source&&data.source.frameId;
  if(typeof frameId!='string'||!frameId||!node||node.frameBackgroundFor!==frameId)return false;
  if(node.kind!='shape'||node.reference||node.isMatte||node.matteId||
     node.id!==frameId+':background'||node.parentId!==frameId||
     !node.primitive||node.primitive.kind!='rectangle')return false;
  var owner=null,candidates=0;
  for(var i=0;i<data.nodes.length;i++){
    var current=data.nodes[i];
    if(current.id===frameId){
      if(owner)return false;
      owner=current;
    }
    if(current.frameBackgroundFor===frameId)candidates++;
  }
  if(!owner||owner.kind!='group'||owner.containerType!='FRAME'||owner.parentId!=null||candidates!==1)return false;
  if(layer.threeDLayer)return false;
  for(var parent=layer.parent;parent;parent=parent.parent)if(parent.threeDLayer)return false;
  var root=layer.property('ADBE Root Vectors Group');
  if(!root||root.numProperties!==1)return false;
  var group=root.property(1);
  if(group.matchName!='ADBE Vector Group')return false;
  var contents=group.property('ADBE Vectors Group'),rectangle=null;
  for(var i=1;i<=contents.numProperties;i++){
    var property=contents.property(i);
    if(property.matchName=='ADBE Vector Shape - Rect'){
      if(rectangle)return false;
      rectangle=property;
    }else if(property.matchName!='ADBE Vector Graphic - Fill'&&property.matchName!='ADBE Vector Graphic - Stroke'){
      return false;
    }
  }
  if(!rectangle)return false;
  var transform=group.property('ADBE Vector Transform Group');
  var properties=[
    rectangle.property('ADBE Vector Rect Size'),
    rectangle.property('ADBE Vector Rect Position'),
    transform.property('ADBE Vector Anchor'),
    transform.property('ADBE Vector Position'),
    transform.property('ADBE Vector Scale'),
    transform.property('ADBE Vector Rotation'),
    transform.property('ADBE Vector Skew'),
    transform.property('ADBE Vector Skew Axis')
  ];
  for(var i=0;i<properties.length;i++){
    if(!properties[i]||!properties[i].canSetExpression||properties[i].numKeys||properties[i].expressionEnabled)return false;
  }
  // Invert the layer/parent transform inside this background-only shape group.
  // The rectangle then uses composition coordinates without moving the layer or its siblings.
  var basis="var o=thisLayer.fromComp([0,0]);\n"+
    "var x=thisLayer.fromComp([1,0]);var y=thisLayer.fromComp([0,1]);\n"+
    "var ux=x[0]-o[0],uy=x[1]-o[1],vx=y[0]-o[0],vy=y[1]-o[1];\n"+
    "var sx=Math.sqrt(ux*ux+uy*uy);var det=ux*vy-uy*vx;\n";
  var expressions=[
    "[thisComp.width,thisComp.height];",
    "[thisComp.width/2,thisComp.height/2];",
    "[0,0];",
    "var p=thisLayer.fromComp([0,0]);[p[0],p[1]];",
    basis+"sx>1e-8&&Math.abs(det)>1e-8?[100*sx,100*det/sx]:value;",
    basis+"sx>1e-8?Math.atan2(uy,ux)*180/Math.PI:value;",
    basis+"sx>1e-8&&Math.abs(det)>1e-8?-Math.atan((ux*vx+uy*vy)/det)*180/Math.PI:value;",
    "0;"
  ];
  var previous=[];
  for(var i=0;i<properties.length;i++)previous.push(properties[i].expression);
  try{
    for(var i=0;i<properties.length;i++)properties[i].expression=expressions[i];
    for(var i=0;i<properties.length;i++)if(properties[i].expressionError)throw Error(properties[i].expressionError);
  }catch(error){
    for(var i=0;i<properties.length;i++)try{properties[i].expression=previous[i];}catch(_restore){}
    return false;
  }
  return true;
};

Transferify.receiveFigma=function(data,requestedFolder){
  function trackProjectItems(currentComp){
    var known={},done=false,target=null;
    for(var i=1;i<=app.project.numItems;i++){var item=app.project.item(i);known[item.id]=true;if(item instanceof FolderItem&&item.name=='TRANSFER'&&(!target||(target.parentFolder==app.project.rootFolder&&item.parentFolder!=app.project.rootFolder)))target=item;}
    function folder(){if(!target)target=app.project.items.addFolder('TRANSFER');return target;}
    var finish=function(){if(done)return;done=true;var incoming=[],folders=[];for(var i=1;i<=app.project.numItems;i++){var item=app.project.item(i);if(!known[item.id]){if(item instanceof FolderItem)folders.push(item);else{var solid=false;try{solid=item instanceof FootageItem&&item.mainSource instanceof SolidSource;}catch(_solid){}if(!solid)incoming.push(item);}}}var destination=folder();for(var j=0;j<incoming.length;j++)incoming[j].parentFolder=destination;for(var k=folders.length-1;k>=0;k--){var f=folders[k];if(f==destination||f.name=='Solids')continue;if(!f.numItems)f.remove();else f.parentFolder=destination;}};
    finish.folder=folder;
    finish.findImage=function(name){if(!target)return null;for(var i=1;i<=app.project.numItems;i++){var item=app.project.item(i);if(!(item instanceof FootageItem)||item.parentFolder!=target)continue;var comment=String(item.comment||'');if(item.name==name||comment.split(String.fromCharCode(10))[0]=='TRANSFERIFY_IMAGE:'+name)return item;}return null;};
    finish.confirmImage=function(name){
      var dialog=new Window('dialog','Transferify');
      dialog.orientation='column';dialog.alignChildren='fill';dialog.margins=20;dialog.spacing=14;
      var message=dialog.add('statictext',undefined,'A imagem "'+name+'" já existe em TRANSFER. Substituir atualiza todas as camadas que usam essa imagem. Criar cópia mantém a anterior e importa a nova.',{multiline:true});
      message.preferredSize=[430,70];
      var row=dialog.add('group');row.alignment='right';row.spacing=10;
      function choice(label,result){
        var button=row.add('button',undefined,label);
        button.onClick=function(){dialog.close(result);};
        return button;
      }
      var reuse=choice('Usar a mesma',1);
      choice('Substituir',2);
      choice('Criar uma cópia',3);
      dialog.defaultElement=reuse;dialog.cancelElement=reuse;
      var result=dialog.show();
      return result==2?'replace':result==3?'copy':'reuse';
    };
    return finish;
  }
  var finishProjectItems=null;
  var began=false,comp=null,warnings=(data&&data.warnings)||[],created=[],controllers={},affineControllers=[],tag='Transferify Figma '+new Date().getTime()+' / ',scaleControl=null;
  function report(ok,message){return Transferify._plainJSON({ok:ok,message:message,warnings:warnings,layers:created.length,destinationCompId:ok&&comp?comp.id:null,createdCompId:ok&&comp&&opt.mode=='new'?comp.id:null});}
  try{
    if(Transferify._host()!='ae')return report(false,'Abra o painel Transferify no After Effects.');
    if(!data||!data.source||!data.nodes)return report(false,'Pacote Figma inválido.');
    if(parseFloat(app.version)<26)return report(false,'Figma → AE requer After Effects 2026 ou superior.');
    var opt=data.importOptions||{mode:'new',multiplier:1,fps:30,duration:5,parametric:true,precompGroups:false};
    if(typeof data.precompGroups=='boolean')opt.precompGroups=data.precompGroups;var precompCount=0;
    function range(value,min,max,label){if(typeof value!='number'||!isFinite(value)||value<min||value>max)throw new Error(label+' inválido');return value;}
    if(opt.mode!='new'&&opt.mode!='current')throw new Error('Modo de composição inválido');
    var multiplier=range(opt.multiplier,0.1,8,'Multiplier'),fps=range(opt.fps,1,120,'Frame rate'),duration=range(opt.duration,.1,10800,'Duration');
    var cw=Math.ceil(data.source.width*multiplier),ch=Math.ceil(data.source.height*multiplier);if(cw<1||ch<1||cw>30000||ch>30000)throw new Error('Composição excede 30000 pixels');
    if(!app.project)app.newProject();comp=Transferify._aeComp();
    if(opt.mode=='current'&&!(comp instanceof CompItem))return report(false,'Abra uma composição para usar Current.');
    try{if(data.matchFigmaAlpha===true&&!app.project.linearizeWorkingSpace)app.project.linearBlending=false;if(app.project.linearBlending||app.project.linearizeWorkingSpace)warnings.push('Projeto com composição de cores linear: transparências podem diferir do Figma.');}catch(_color){}
    app.beginUndoGroup('Transferify Figma to AE');began=true;finishProjectItems=trackProjectItems(opt.mode=='current'?comp:null);if(!finishProjectItems)return report(false,'Import cancelled. TRANSFER was not changed.');if(finishProjectItems.currentComp)comp=finishProjectItems.currentComp;
    if(opt.mode=='new'){comp=app.project.items.addComp(data.source.name,cw,ch,1,duration,fps);}
    if(opt.mode=='new'&&opt.background)comp.bgColor=opt.background;
    if(comp.width!=cw||comp.height!=ch)warnings.push('Current: tamanho da composição preservado; conteúdo Figma mede '+cw+' × '+ch+'.');
    var insert=null;try{if(comp.selectedLayers.length)insert=comp.selectedLayers[0];}catch(_insert){}
    function point(m,p){return[m[0][0]*p[0]+m[0][1]*p[1]+m[0][2],m[1][0]*p[0]+m[1][1]*p[1]+m[1][2]];}
    function transform(l){return l.property('ADBE Transform Group');}
    function parentTo(l,id){if(id&&controllers[id])l.parent=controllers[id];}
    function center(l){var t=transform(l),r=l.sourceRectAtTime(comp.time,false),a=[r.left+r.width/2,r.top+r.height/2];t.property('ADBE Anchor Point').setValue(a);t.property('ADBE Position').setValue(a);}
    function nullLayer(name){var l=comp.layers.addNull();l.name=name;l.guideLayer=true;l.shy=true;var t=transform(l);t.property('ADBE Anchor Point').setValue([0,0]);t.property('ADBE Position').setValue([0,0]);return l;}
    function applyAffine(l,m,parentId){
      var a=m[0][0],b=m[1][0],c=m[0][1],d=m[1][1],sx=Math.sqrt(a*a+b*b),det=a*d-b*c,t=transform(l),anchor=t.property('ADBE Anchor Point').value;
      if(sx<0.00000001||Math.abs(det)<0.00000001)throw new Error('Transform com escala zero: '+l.name);
      if(Math.abs(a*c+b*d)<0.000001){parentTo(l,parentId);t.property('ADBE Position').setValue(point(m,anchor));t.property('ADBE Scale').setValue([sx*100,det/sx*100]);t.property('ADBE Rotate Z').setValue(Math.atan2(b,a)*180/Math.PI);}
      else{
        // Two native transforms represent an arbitrary invertible 2D affine matrix.
        var u=a*a+b*b,v=a*c+b*d,w=c*c+d*d,phi=.5*Math.atan2(2*v,u-w),co=Math.cos(phi),si=Math.sin(phi),s1=Math.sqrt(Math.max(0,(u+w+Math.sqrt((u-w)*(u-w)+4*v*v))/2)),s2=det/s1,theta=Math.atan2(b*co+d*si,a*co+c*si);
        var control=nullLayer('Transform / '+l.name),ct=transform(control);parentTo(control,parentId);ct.property('ADBE Position').setValue([m[0][2],m[1][2]]);ct.property('ADBE Scale').setValue([s1*100,s2*100]);ct.property('ADBE Rotate Z').setValue(theta*180/Math.PI);l.parent=control;t.property('ADBE Position').setValue([co*anchor[0]+si*anchor[1],-si*anchor[0]+co*anchor[1]]);t.property('ADBE Scale').setValue([100,100]);t.property('ADBE Rotate Z').setValue(-phi*180/Math.PI);control.comment=tag+'affine:'+(String(l.comment||'').indexOf(tag)===0?String(l.comment).substr(tag.length):data.nodes[ni].id);affineControllers.push(control);
      }
    }
    function rawPaths(n){if(n.paths)return n.paths;var w=n.width,h=n.height,r=Math.min(w/2,h/2,n.primitive.radius||0),k=.5522847498307936,pts=[];
      function p(x,y,ix,iy,ox,oy){pts.push({a:[x,y],inT:[ix||0,iy||0],outT:[ox||0,oy||0]});}
      if(n.primitive.kind=='ellipse'){p(w/2,0,-k*w/2,0,k*w/2,0);p(w,h/2,0,-k*h/2,0,k*h/2);p(w/2,h,k*w/2,0,-k*w/2,0);p(0,h/2,0,k*h/2,0,-k*h/2);}
      else if(!r){p(0,0);p(w,0);p(w,h);p(0,h);}else{p(r,0,-k*r,0,0,0);p(w-r,0,0,0,k*r,0);p(w,r,0,-k*r,0,0);p(w,h-r,0,0,0,k*r);p(w-r,h,k*r,0,0,0);p(r,h,0,0,-k*r,0);p(0,h-r,0,k*r,0,0);p(0,r,0,0,0,-k*r);}
      return[{closed:true,points:pts}];
    }
    function shapeValue(raw,m,offset){var s=new Shape(),v=[],inn=[],out=[];for(var i=0;i<raw.points.length;i++){var p=raw.points[i],a=point(m,p.a),ip=point(m,[p.a[0]+p.inT[0],p.a[1]+p.inT[1]]),op=point(m,[p.a[0]+p.outT[0],p.a[1]+p.outT[1]]);v.push([a[0]-offset[0],a[1]-offset[1]]);inn.push([ip[0]-a[0],ip[1]-a[1]]);out.push([op[0]-a[0],op[1]-a[1]]);}s.vertices=v;s.inTangents=inn;s.outTangents=out;s.closed=!!raw.closed;return s;}
    function color(p){return[p.color.r,p.color.g,p.color.b];}
    function addStroke(contents,n){if(!n.stroke)return;var s=contents.addProperty('ADBE Vector Graphic - Stroke');s.property('ADBE Vector Stroke Color').setValue(color(n.stroke));s.property('ADBE Vector Stroke Width').setValue(n.strokeWeight);s.property('ADBE Vector Stroke Opacity').setValue(n.stroke.opacity*100);try{s.property('ADBE Vector Stroke Line Cap').setValue(n.strokeCap=='ROUND'?2:n.strokeCap=='SQUARE'?3:1);s.property('ADBE Vector Stroke Line Join').setValue(n.strokeJoin=='ROUND'?2:n.strokeJoin=='BEVEL'?3:1);}catch(_cap){}
      for(var i=0;i<n.strokeDashes.length;i++){s=contents.property('ADBE Vector Graphic - Stroke');var ds=s.property('ADBE Vector Stroke Dashes'),name=(i%2?'ADBE Vector Stroke Gap ':'ADBE Vector Stroke Dash ')+(Math.floor(i/2)+1);var dp=ds.addProperty(name);dp.setValue(n.strokeDashes[i]);}
    }
    function addPaths(contents,n,m,offset){var paths=rawPaths(n);for(var i=0;i<paths.length;i++){var p=contents.addProperty('ADBE Vector Shape - Group');p.property('ADBE Vector Shape').setValue(shapeValue(paths[i],m,offset));}}
    function gradientGeometry(n){var p=n.fill.gradientTransform,det=p[0][0]*p[1][1]-p[0][1]*p[1][0];if(Math.abs(det)<1e-10)throw new Error('Gradiente com transform singular: '+n.name);
      var inv=[[p[1][1]/det,-p[0][1]/det,(p[0][1]*p[1][2]-p[1][1]*p[0][2])/det],[-p[1][0]/det,p[0][0]/det,(p[1][0]*p[0][2]-p[0][0]*p[1][2])/det]];
      function mapped(q){var v=point(inv,q);return point(n.matrix,[v[0]*n.width,v[1]*n.height]);}
      var o=mapped([0,0]),x=mapped([1,0]),y=mapped([0,1]),a=x[0]-o[0],b=x[1]-o[1],c=y[0]-o[0],d=y[1]-o[1];
      if(n.fill.type=='GRADIENT_LINEAR'){var start=mapped([0,.5]),D=a*d-b*c,nx=d/D,ny=-c/D,nn=nx*nx+ny*ny;return{offset:[0,0],start:start,end:[start[0]+nx/nn,start[1]+ny/nn],scale:[100,100],rotation:0,type:1};}
      var center=mapped([.5,.5]),u=(a*a+c*c)/4,v=(a*b+c*d)/4,w=(b*b+d*d)/4,lambda=(u+w+Math.sqrt((u-w)*(u-w)+4*v*v))/2,major=Math.sqrt(lambda),minor=Math.abs(a*d-b*c)/4/major,theta=.5*Math.atan2(2*v,u-w);
      return{offset:center,start:[0,0],end:[major,0],scale:[100,minor/major*100],rotation:theta*180/Math.PI,type:2};
    }
    function addShapeBlur(l,n){for(var bi=0;bi<(n.layerBlurs||[]).length;bi++){var blur=l.property('ADBE Effect Parade').addProperty('ADBE Gaussian Blur 2');blur.property(1).setValue(n.layerBlurs[bi]);blur.property(2).setValue(1);blur.property(3).setValue(false);}}
    function importFigmaMedia(operation){
      var before=null;
      try{before=app.activeViewer;}catch(_viewer){}
      try{return operation();}
      finally{
        try{
          var after=app.activeViewer;
          if(after&&after.type==ViewerType.VIEWER_FOOTAGE&&(!before||before.type!=ViewerType.VIEWER_FOOTAGE)){
            var close=app.findMenuCommandId('Close');
            if(close>0&&after.setActive())app.executeCommand(close);
          }
        }catch(_closeViewer){}
      }
    }
    function gradientLayer(n){
      var known={},copied=null;for(var i=1;i<=app.project.numItems;i++)known[app.project.item(i).id]=true;
      try{var file=new File(n.gradientFile);if(!file.exists)throw new Error('Template de gradiente não encontrado.');var options=new ImportOptions(file);importFigmaMedia(function(){return app.project.importFile(options);});var source=null;for(var i=1;i<=app.project.numItems;i++){var item=app.project.item(i);if(!known[item.id]&&item instanceof CompItem&&item.name=='Transferify Gradient Template')source=item;}if(!source)throw new Error('Gradient template sem composição nativa.');var layerIDs={};for(var li=1;li<=comp.numLayers;li++)layerIDs[comp.layer(li).id]=true;source.layer(1).copyToComp(comp);var copies=[];for(var li=1;li<=comp.numLayers;li++)if(!layerIDs[comp.layer(li).id])copies.push(comp.layer(li));if(copies.length!=1){for(var ci=copies.length-1;ci>=0;ci--)try{copies[ci].remove();}catch(_copyCleanup){}throw new Error('Não foi possível identificar a camada de gradiente copiada.');}copied=copies[0];copied.name=n.name;
        var group=copied.property('ADBE Root Vectors Group').property(1),contents=group.property('ADBE Vectors Group'),g=gradientGeometry(n);
        for(var i=contents.numProperties;i>=1;i--)if(contents.property(i).matchName=='ADBE Vector Shape - Group'||contents.property(i).matchName=='ADBE Vector Shape - Rect'||contents.property(i).matchName=='ADBE Vector Shape - Ellipse'||contents.property(i).matchName=='ADBE Vector Shape - Star')contents.property(i).remove();
        addPaths(contents,n,n.matrix,g.offset);contents=group.property('ADBE Vectors Group');var fill=contents.property('ADBE Vector Graphic - G-Fill');fill.moveTo(contents.numProperties);fill=contents.property('ADBE Vector Graphic - G-Fill');fill.property('ADBE Vector Grad Type').setValue(g.type);fill.property('ADBE Vector Grad Start Pt').setValue(g.start);fill.property('ADBE Vector Grad End Pt').setValue(g.end);fill.property('ADBE Vector Grad Scale').setValue(g.scale);fill.property('ADBE Vector Grad Rotation').setValue(g.rotation);fill.property('ADBE Vector Fill Opacity').setValue(n.fill.opacity*100);fill.property('ADBE Vector Fill Rule').setValue(n.rule||1);
        group.property('ADBE Vector Transform Group').property('ADBE Vector Position').setValue(g.offset);addStroke(contents,n);center(copied);parentTo(copied,n.parentId);addShapeBlur(copied,n);return copied;
      }catch(e){if(copied)try{copied.remove();}catch(_remove){}throw e;}
      finally{for(var i=app.project.numItems;i>=1;i--){var item=app.project.item(i);if(!known[item.id])try{item.remove();}catch(_cleanup){}}}
    }
    function solidShape(n){var l=comp.layers.addShape();l.name=n.name;var group=l.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group'),contents=group.property('ADBE Vectors Group');group.name='Artwork';
      if(n.primitive&&(opt.parametric!==false||!!n.frameBackgroundFor&&n.frameBackgroundFor===data.source.frameId)){var isRect=n.primitive.kind=='rectangle',p=contents.addProperty(isRect?'ADBE Vector Shape - Rect':'ADBE Vector Shape - Ellipse');p.property(isRect?'ADBE Vector Rect Size':'ADBE Vector Ellipse Size').setValue([n.width,n.height]);p.property(isRect?'ADBE Vector Rect Position':'ADBE Vector Ellipse Position').setValue([n.width/2,n.height/2]);if(isRect)p.property('ADBE Vector Rect Roundness').setValue(n.primitive.radius||0);}
      else addPaths(contents,n,[[1,0,0],[0,1,0]],[0,0]);
      if(n.fill){var f=contents.addProperty('ADBE Vector Graphic - Fill');f.property('ADBE Vector Fill Color').setValue(color(n.fill));f.property('ADBE Vector Fill Opacity').setValue(n.fill.opacity*100);f.property('ADBE Vector Fill Rule').setValue(n.rule||1);}
      addStroke(contents,n);addShapeBlur(l,n);var r=l.sourceRectAtTime(comp.time,false);transform(l).property('ADBE Anchor Point').setValue([r.left+r.width/2,r.top+r.height/2]);applyAffine(l,n.matrix,n.parentId);return l;
    }
    function textLayer(n){
      // Keep UTF-16 offsets for characterRange even when CRLF becomes one AE return.
      var original=n.text,aeText='',offsets=[0];
      for(var ci=0;ci<original.length;ci++){
        var ch=original.charAt(ci);
        if(ch=='\n'&&ci>0&&original.charAt(ci-1)=='\r'){offsets.push(aeText.length);continue;}
        aeText+=/[\n\u2028\u2029]/.test(ch)?'\r':ch;
        offsets.push(aeText.length);
      }
      var isBox=n.autoResize!='WIDTH_AND_HEIGHT',l=isBox?comp.layers.addBoxText([n.width,Math.max(1,n.height)]):comp.layers.addText(aeText);l.name=n.name;var tp=l.property('ADBE Text Properties').property('ADBE Text Document'),td=tp.value;td.resetCharStyle();td.resetParagraphStyle();td.text=aeText;
      td.noBreak=false;td.horizontalScale=1;td.verticalScale=1;td.baselineShift=0;td.autoLeading=true;
      td.startIndent=0;td.endIndent=0;td.firstLineIndent=0;td.spaceBefore=0;td.spaceAfter=0;
      if(isBox){td.boxTextSize=[n.width,Math.max(1,n.height)];td.boxTextPos=[0,0];td.boxVerticalAlignment=BoxVerticalAlignment.TOP;td.boxFirstBaselineAlignmentMinimum=0;td.boxFirstBaselineAlignment=BoxFirstBaselineAlignment.ASCENT;td.boxAutoFitPolicy=BoxAutoFitPolicy.HEIGHT_PRECISE_BOUNDS;}
      try{td.fontCapsOption=FontCapsOption.FONT_NORMAL_CAPS;td.fauxBold=false;td.fauxItalic=false;}catch(_caps){}
      function font(r){try{var f=app.fonts.getFontsByFamilyNameAndStyleName(r.fontFamily,r.fontStyle);if(f.length&&!f[0].isSubstitute)return f[0].postScriptName;}catch(_fonts){}warnings.push(n.name+': fonte não encontrada '+r.fontFamily+' '+r.fontStyle);return null;}
      var fonts=[];for(var i=0;i<n.runs.length;i++)fonts.push(font(n.runs[i]));
      if(n.runs.length){var r=n.runs[0];if(fonts[0])td.font=fonts[0];td.fontSize=r.size;td.applyFill=!!r.fill;if(r.fill)td.fillColor=color(r.fill);td.applyStroke=!!n.stroke&&n.strokeWeight>0;if(td.applyStroke){td.strokeColor=color(n.stroke);td.strokeWidth=n.strokeWeight*(n.strokeAlign=='OUTSIDE'?2:1);td.strokeOverFill=false;}td.tracking=Math.round(Number(r.tracking)||0);if(r.lineHeight&&r.lineHeight.unit!='AUTO'){td.autoLeading=false;td.leading=r.lineHeight.unit=='PIXELS'?r.lineHeight.value:r.size*r.lineHeight.value/100;}}
      var alignment=String(n.alignment||'LEFT').toUpperCase();
      var justification=ParagraphJustification.LEFT_JUSTIFY;
      if(alignment=='CENTER')justification=ParagraphJustification.CENTER_JUSTIFY;
      else if(alignment=='RIGHT')justification=ParagraphJustification.RIGHT_JUSTIFY;
      else if(alignment=='JUSTIFIED')justification=ParagraphJustification.FULL_JUSTIFY_LASTLINE_LEFT;
      td.justification=justification;
      tp.setValue(td);td=tp.value;
      {for(var i=0;i<n.runs.length;i++){var r=n.runs[i];if(offsets[r.end]<=offsets[r.start])continue;var cr=td.characterRange(offsets[r.start],offsets[r.end]);cr.noBreak=false;cr.horizontalScale=1;cr.verticalScale=1;cr.baselineShift=0;if(fonts[i])cr.font=fonts[i];cr.fontSize=r.size;cr.applyFill=!!r.fill;cr.applyStroke=!!n.stroke&&n.strokeWeight>0;if(cr.applyStroke){cr.strokeColor=color(n.stroke);cr.strokeWidth=n.strokeWeight*(n.strokeAlign=='OUTSIDE'?2:1);}if(r.fill)cr.fillColor=color(r.fill);cr.tracking=Math.round(Number(r.tracking)||0);if(r.textCase&&r.textCase!='ORIGINAL')warnings.push(n.name+': text case '+r.textCase+' usa os caracteres originais.');}}
      td.strokeOverFill=false;
      // Apply paragraph alignment after all character-range writes.
      td.justification=justification;
      tp.setValue(td);
      if(aeText.length && !tp.value.text.length)throw Error(n.name+' • After recebeu uma camada de texto vazia.');
      var renderOrder=l.property('ADBE Text Properties').property('ADBE Text More Options').property('ADBE Text Render Order');
      renderOrder.setValue(2); // All Fills Over All Strokes.
      var sr=l.sourceRectAtTime(comp.time,false),anchorRect=sr;
      // Figma measures glyphs without stroke. Measure the same geometry in After Effects.
      if(n.stroke&&n.strokeWeight>0){
        var styled=tp.value,measurement=tp.value;
        measurement.applyStroke=false;
        try{tp.setValue(measurement);anchorRect=l.sourceRectAtTime(comp.time,false);}
        finally{tp.setValue(styled);}
      }
      var m=n.matrix,dx=n.glyphBounds.x-anchorRect.left,dy=n.glyphBounds.y-anchorRect.top,shifted=[[m[0][0],m[0][1],m[0][2]+m[0][0]*dx+m[0][1]*dy],[m[1][0],m[1][1],m[1][2]+m[1][0]*dx+m[1][1]*dy]];
      transform(l).property('ADBE Anchor Point').setValue([sr.left+sr.width/2,sr.top+sr.height/2]);applyAffine(l,shifted,n.parentId);return l;
    }
    function imageLayer(n){var folder=Transferify._imageFolder(requestedFolder);
      var footage=finishProjectItems.findImage(n.name,n.uncroppedPhoto),action=footage?finishProjectItems.confirmImage(n.name):"import";
      if(action!="reuse"){
      var source=new File(n.file),base=String(n.name+'_'+n.id).replace(/[\\\/:*?"<>|]/g,'_'),target=new File(folder.fsName+'/'+base+'.png');
      if(action=="copy"){
        var suffix=1;
        do{target=new File(folder.fsName+'/'+base+'_copy_'+suffix+'.png');suffix++;}while(target.exists);
      }else if(target.exists){
        var suffix=1;
        while(target.exists){target=new File(folder.fsName+'/'+base+'_'+suffix+'.png');suffix++;}
      }
      if(!source.copy(target.fsName))throw new Error('Falha ao copiar a imagem.');
      if(action=="replace")importFigmaMedia(function(){footage.replace(target);});
      else footage=importFigmaMedia(function(){return app.project.importFile(new ImportOptions(target));});
      footage.comment='TRANSFERIFY_IMAGE:'+(action=="copy"?footage.name:n.name)+(n.uncroppedPhoto?'\nTRANSFERIFY_PHOTO_ORIGINAL':'');
      footage.parentFolder=finishProjectItems.folder();
      }
      var l=comp.layers.add(footage);l.name=n.name;var b=n.imageBox,m=n.matrix,sx=b.width/(footage.width||n.pixelWidth),sy=b.height/(footage.height||n.pixelHeight),t=point(m,[b.x,b.y]),imageM=[[m[0][0]*sx,m[0][1]*sy,t[0]],[m[1][0]*sx,m[1][1]*sy,t[1]]];applyAffine(l,imageM,n.parentId);return l;
    }
    var frameBackgroundLayers=[];
    if(multiplier!=1){scaleControl=nullLayer('Figma / '+multiplier+'×');scaleControl.comment=tag+'scale';}
    for(var ni=0;ni<data.nodes.length;ni++){var n=data.nodes[ni],l=null;if(n.kind=='group')continue;
      if(n.kind=='shape')l=n.gradientFile?gradientLayer(n):solidShape(n);
      else if(n.kind=='text')l=textLayer(n);
      else if(n.kind=='image')l=imageLayer(n);
      if(l&&n.frameBackgroundFor)frameBackgroundLayers.push({node:n,layer:l});
      if(l){if(n.blendMode=='OVERLAY')l.blendingMode=BlendingMode.OVERLAY;transform(l).property('ADBE Opacity').setValue(n.kind=='group'?100:n.opacity*100);l.comment=tag+n.id;if(n.reference){l.guideLayer=true;l.enabled=false;l.moveToEnd();}created.push(l);}
    }
    // Resolve separately exported mattes only after every artwork layer exists.
    var matteLayers={};for(var ml=0;ml<created.length;ml++){var comment=String(created[ml].comment||'');if(comment.indexOf(tag)===0)matteLayers[comment.substr(tag.length)]=created[ml];}
    for(var mn=0;mn<data.nodes.length;mn++){var matteNode=data.nodes[mn];if(!matteNode.matteId)continue;var targetLayer=matteLayers[matteNode.id],matteLayer=matteLayers[matteNode.matteId];if(!targetLayer||!matteLayer)throw Error('Missing photo track matte: '+matteNode.name);matteLayer.moveBefore(targetLayer);var mode=matteNode.matteMode=='LUMA'?TrackMatteType.LUMA:TrackMatteType.ALPHA;if(typeof targetLayer.setTrackMatte=='function')targetLayer.setTrackMatte(matteLayer,mode);else targetLayer.trackMatteType=mode;matteLayer.enabled=false;}
    function groupAssetBounds(groupId,parents){return Transferify._figmaGroupBounds(data.nodes,groupId,parents);}
    if(opt.precompGroups){
      var parents={};for(var ni=0;ni<data.nodes.length;ni++)parents[data.nodes[ni].id]=data.nodes[ni].parentId;
      for(var gi=data.nodes.length-1;gi>=0;gi--){var gn=data.nodes[gi];if(gn.kind!='group'||(!gn.parentId&&gn.containerType!='GROUP'))continue;
        var indices=[];for(var li=1;li<=comp.numLayers;li++){var candidate=comp.layer(li),comment=String(candidate.comment||'');if(comment.indexOf(tag)!==0)continue;var id=comment.substr(tag.length);if(id.indexOf('affine:')===0)id=id.substr(7);var p=id;while(p&&p!=gn.id)p=parents[p];if(p==gn.id)indices.push(li);}
        if(!indices.length)continue;var bounds=groupAssetBounds(gn.id,parents),members={};for(var mi=0;mi<indices.length;mi++)members[comp.layer(indices[mi]).id]=true;
        for(var mi=0;mi<indices.length;mi++){var member=comp.layer(indices[mi]);if(member.parent&&!members[member.parent.id])member.parent=null;}
        var sub=comp.layers.precompose(indices,gn.name,true),pl=null;precompCount++;
        if(bounds){if(bounds.width>30000||bounds.height>30000)throw Error('Group precomp exceeds 30000 px: '+gn.name);sub.width=bounds.width;sub.height=bounds.height;for(var ri=1;ri<=sub.numLayers;ri++){var rootLayer=sub.layer(ri);if(!rootLayer.parent){var pp=transform(rootLayer).property('ADBE Position'),pv=pp.value;pp.setValue([pv[0]-bounds.left,pv[1]-bounds.top]);}}}
        for(var li=1;li<=comp.numLayers;li++)if(comp.layer(li).source==sub){pl=comp.layer(li);break;}
        if(pl){if(bounds){transform(pl).property('ADBE Anchor Point').setValue([bounds.width/2,bounds.height/2]);transform(pl).property('ADBE Position').setValue([bounds.left+bounds.width/2,bounds.top+bounds.height/2]);}pl.comment=tag+gn.id;try{if(controllers[gn.parentId])pl.parent=controllers[gn.parentId];}catch(_parent){}controllers[gn.id]=pl;}
      }
      created=[];for(var li=comp.numLayers;li>=1;li--)if(String(comp.layer(li).comment).indexOf(tag)===0&&comp.layer(li)!=scaleControl)created.push(comp.layer(li));
    }
    if(scaleControl){for(var li=1;li<=comp.numLayers;li++){var l=comp.layer(li);if(l!=scaleControl&&String(l.comment).indexOf(tag)===0&&!l.parent)l.parent=scaleControl;}transform(scaleControl).property('ADBE Scale').setValue([multiplier*100,multiplier*100]);}
    for(var fi=0;fi<frameBackgroundLayers.length;fi++)Transferify._fitFigmaFrameRectangle(data,frameBackgroundLayers[fi].node,frameBackgroundLayers[fi].layer);
    if(insert)for(var i=0;i<created.length;i++)try{created[i].moveBefore(insert);}catch(_order){}
    for(var i=1;i<=comp.numLayers;i++)comp.layer(i).selected=false;for(var i=0;i<created.length;i++)if(!created[i].nullLayer&&!created[i].guideLayer)created[i].selected=true;
    if(finishProjectItems)finishProjectItems();
    if(opt.precompGroups&&!precompCount)warnings.push('Precomp groups marcado, mas nenhum grupo interno elegível foi encontrado. O frame principal não é um grupo interno.');
    return report(true,'FIGMA → AE • '+created.length+' layers recebidas.'+(opt.precompGroups?' • '+precompCount+' precomps criadas.':''));
  }catch(e){return report(false,String(e)+' | line '+e.line+' • '+created.length+' layers criadas antes da falha; use Undo para reverter.');}
  finally{if(finishProjectItems)try{finishProjectItems();}catch(_folder){warnings.push('Não foi possível organizar os itens na pasta TRANSFER: '+String(_folder));}if(began)try{app.endUndoGroup();}catch(_undo){}}
};

Transferify.setImportOptions=function(raw){
  try{var o=Transferify._parsePanelSettings(raw);if(o.mode!='new'&&o.mode!='current')throw Error('Import mode');
    function valid(n,min,max){return typeof n=='number'&&isFinite(n)&&n>=min&&n<=max;}
    if(!valid(o.multiplier,.1,8)||!valid(o.fps,1,120)||!valid(o.duration,.1,10800))throw Error('Frame rate, duration or multiplier invalid');
    app.settings.saveSetting('Transferify QA','importOptions',raw);return 'OK';
  }catch(e){return 'ERROR • '+String(e);}
};
Transferify.precompSelected=function(){var began=false;try{var comp=Transferify._aeComp();if(!comp||!comp.selectedLayers.length)return 'Select layers to precompose';var selected=comp.selectedLayers,b=Transferify._artBounds(selected,comp.time);if(!b)return 'No visible artwork bounds in selection';var left=Math.floor(b.left)-10,top=Math.floor(b.top)-10,width=Math.ceil(b.right)+10-left,height=Math.ceil(b.bottom)+10-top;if(width>30000||height>30000)return 'Precomp exceeds 30000 pixels';for(var ei=0;ei<selected.length;ei++){var ep=selected[ei].property('ADBE Transform Group').property('ADBE Position');if(ep.expressionEnabled)return 'PRECOMP: position expressions require manual adjustment';if(ep.dimensionsSeparated&&(ep.getSeparationFollower(0).expressionEnabled||ep.getSeparationFollower(1).expressionEnabled))return 'PRECOMP: position expressions require manual adjustment';}var minT=Infinity,maxT=-Infinity;for(var ti=0;ti<selected.length;ti++){minT=Math.min(minT,Number(selected[ti].inPoint));maxT=Math.max(maxT,Number(selected[ti].outPoint));}var duration=Math.max(1/comp.frameRate,maxT-minT);var indices=[],ids={},name=selected.length==1?selected[0].name:'Transferify Group';for(var i=0;i<selected.length;i++){indices.push(selected[i].index);ids[selected[i].id]=true;}var chosen=prompt('Precomp name',name);if(chosen===null)return 'PRECOMP • cancelled';name=String(chosen).replace(/^\s+|\s+$/g,'');if(!name)return 'PRECOMP • enter a name';app.beginUndoGroup('Transferify Precomp');began=true;for(var i=0;i<selected.length;i++)if(selected[i].parent&&!ids[selected[i].parent.id])selected[i].parent=null;var sub=comp.layers.precompose(indices,name,true),pre=null;for(var i=1;i<=comp.numLayers;i++)if(comp.layer(i).source==sub){pre=comp.layer(i);break;}if(!pre)throw Error('Precomp layer missing');sub.displayStartTime=0;for(var ci=1;ci<=sub.numLayers;ci++){var child=sub.layer(ci),childIn=Number(child.inPoint)-minT,childOut=Number(child.outPoint)-minT;child.startTime=Number(child.startTime)-minT;child.inPoint=childIn;child.outPoint=childOut;}sub.duration=duration;sub.workAreaStart=0;sub.workAreaDuration=duration;pre.startTime=minT;pre.inPoint=minT;pre.outPoint=maxT;pre.name=name;sub.width=width;sub.height=height;sub.bgColor=comp.bgColor;sub.parentFolder=comp.parentFolder;for(var i=1;i<=sub.numLayers;i++){var l=sub.layer(i);if(!l.parent){var t=l.property('ADBE Transform Group').property('ADBE Position');function shiftProperty(prop,delta){if(prop.expressionEnabled)throw Error('PRECOMP: position expressions require manual adjustment');if(prop.numKeys){for(var ki=1;ki<=prop.numKeys;ki++){var kv=prop.keyValue(ki);if(kv instanceof Array){var nv=kv.slice(0);nv[0]-=left;nv[1]-=top;prop.setValueAtKey(ki,nv);}else prop.setValueAtKey(ki,kv-delta);}}else{var v=prop.value;if(v instanceof Array){var nv=v.slice(0);nv[0]-=left;nv[1]-=top;prop.setValue(nv);}else prop.setValue(v-delta);}}if(t.dimensionsSeparated){shiftProperty(t.getSeparationFollower(0),left);shiftProperty(t.getSeparationFollower(1),top);}else shiftProperty(t,0);}}var tr=pre.property('ADBE Transform Group');tr.property('ADBE Anchor Point').setValue([width/2,height/2]);tr.property('ADBE Position').setValue([left+width/2,top+height/2]);pre.selected=true;return 'PRECOMP • '+width+' × '+height+' • 10px margin';}catch(e){return 'ERROR: '+String(e);}finally{if(began)app.endUndoGroup();}};
Transferify.toggleGuideLayers=function(){try{var c=Transferify._aeComp();if(!c)return 'Open a composition';var guides=[],visible=false;for(var i=1;i<=c.numLayers;i++)if(c.layer(i).guideLayer){guides.push(c.layer(i));if(c.layer(i).enabled)visible=true;}app.beginUndoGroup('Transferify Guide Visibility');for(var i=0;i<guides.length;i++)guides[i].enabled=!visible;app.endUndoGroup();return 'GUIDES • '+guides.length;}catch(e){return 'ERROR • '+String(e);}};
Transferify.removeGroupControls=function(){try{var c=Transferify._aeComp();if(!c)return 'Open a composition';var a=[];for(var i=1;i<=c.numLayers;i++){var l=c.layer(i);if(l.nullLayer&&l.guideLayer&&String(l.comment).indexOf('Transferify')==0)a.push(l);}app.beginUndoGroup('Transferify Remove Group Controls');for(var i=0;i<a.length;i++){for(var j=1;j<=c.numLayers;j++)if(c.layer(j).parent==a[i])c.layer(j).parent=null;a[i].remove();}app.endUndoGroup();return 'CONTROLS REMOVED • '+a.length;}catch(e){try{app.endUndoGroup();}catch(_){}return 'ERROR • '+String(e);}};

Transferify.applyCompSettings=function(raw){
  var began=false;
  try{var o=Transferify._parsePanelSettings(raw),root=Transferify._aeComp();if(!root)return 'Open the composition to apply settings.';
    if(!(o.fps>=1&&o.fps<=120&&o.duration>=.1&&o.duration<=10800))throw Error('Invalid frame rate or duration');
    var seen={},count=0,layers=0;app.beginUndoGroup('Transferify Apply Comp Settings');began=true;
    function apply(c){if(seen[c.id])return;seen[c.id]=true;count++;var oldDuration=c.duration,oldFrame=1/c.frameRate,children=[],timing=[];for(var ti=1;ti<=c.numLayers;ti++)timing.push({id:c.layer(ti).id,inPoint:c.layer(ti).inPoint,outPoint:c.layer(ti).outPoint});for(var i=1;i<=c.numLayers;i++)try{if(c.layer(i).source instanceof CompItem)children.push(c.layer(i).source);}catch(_){}
      c.frameRate=o.fps;c.duration=o.duration;if(o.background)c.bgColor=o.background;
      for(var i=0;i<children.length;i++)apply(children[i]);
      for(var i=1;i<=c.numLayers;i++){var l=c.layer(i),locked=l.locked;l.locked=false;try{var oldTiming=timing[i-1],end=oldTiming.outPoint;if(o.duration>oldDuration&&Math.abs(end-oldDuration)<=oldFrame/2)end=o.duration;else if(o.duration<oldDuration)end=Math.min(end,o.duration);if(oldTiming.inPoint>=o.duration){layers++;continue;}l.inPoint=oldTiming.inPoint;l.outPoint=Math.max(oldTiming.inPoint+1/o.fps,end);layers++;}finally{l.locked=locked;}}
      c.workAreaStart=0;c.workAreaDuration=o.duration;if(c.time>o.duration)c.time=Math.max(0,o.duration-1/o.fps);
    }apply(root);return 'APPLIED • '+count+' comps • '+layers+' layers';
  }catch(e){return 'ERROR: '+String(e);}finally{if(began)app.endUndoGroup();}
};

Transferify.chooseBackgroundColor=function(hex){
 var comp=null,tempComp=null,tempLayer=null,savedLayers=[],savedProperties=[],result='CANCEL';
 try{
  comp=app.project.activeItem;
  if(!(comp instanceof CompItem)){tempComp=app.project.items.addComp('__Transferify_ColorPicker__',16,16,1,1,30);comp=tempComp;}
  savedLayers=comp.selectedLayers;savedProperties=comp.selectedProperties;
  comp.openInViewer();
  for(var i=0;i<savedProperties.length;i++)try{savedProperties[i].selected=false;}catch(ignore){}
  for(var j=0;j<savedLayers.length;j++)savedLayers[j].selected=false;
  tempLayer=comp.layers.addShape();tempLayer.name='__Transferify_ColorPicker__';tempLayer.enabled=false;
  var color=tempLayer.property('ADBE Effect Parade').addProperty('ADBE Color Control').property(1);
  var value=parseInt(String(hex||'#000000').substring(1),16);
  color.setValue([((value>>16)&255)/255,((value>>8)&255)/255,(value&255)/255,1]);
  color.selected=true;
  app.executeCommand(2240);
  var rgb=color.value,out='#';
  for(var k=0;k<3;k++){var channel=Math.max(0,Math.min(255,Math.round(rgb[k]*255))).toString(16);out+=(channel.length<2?'0':'')+channel;}
  result=out;
 }catch(e){result='ERROR: '+String(e);}
 finally{
  if(tempLayer)try{tempLayer.remove();}catch(ignore){}
  if(tempComp)try{tempComp.remove();}catch(ignore){}
  else{
   for(var l=0;l<savedLayers.length;l++)try{savedLayers[l].selected=true;}catch(ignore){}
   for(var m=0;m<savedProperties.length;m++)try{savedProperties[m].selected=true;}catch(ignore){}
  }
 }
 return result;
};

Transferify._artBounds=function(layers,time){
 var left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity,probe=null,point=null;
 try{
  for(var i=0;i<layers.length;i++){
   var l=layers[i];if(l.nullLayer||l.guideLayer||!l.enabled)continue;
   try{
    var isText=l.matchName=='ADBE Text Layer';
    var box=l.sourceRectAtTime(time,!isText);if(!box.width&&!box.height)continue;
    var pts=[[box.left,box.top],[box.left+box.width,box.top],[box.left+box.width,box.top+box.height],[box.left,box.top+box.height]],mapped=[];
    for(var j=0;j<pts.length;j++){
     var q;
     try{q=l.sourcePointToComp(pts[j]);if(!isFinite(q[0])||!isFinite(q[1]))throw Error('Invalid bounds');}
     catch(_nativePoint){
      // toComp expressions support shape/text layers and parent transforms.
      if(!probe){probe=l.containingComp.layers.addShape();probe.name='__Transferify_Bounds__';probe.enabled=false;point=probe.property('ADBE Effect Parade').addProperty('ADBE Point Control').property(1);}
      point.expression='var p=thisComp.layer('+l.index+').toComp(['+pts[j][0]+','+pts[j][1]+',0],time);[p[0],p[1]];';
      q=point.valueAtTime(time,false);
      if(point.expressionError||!isFinite(q[0])||!isFinite(q[1]))throw Error('Cannot measure artwork');
     }
     mapped.push(q);
    }
    for(var j=0;j<mapped.length;j++){var q=mapped[j];left=Math.min(left,q[0]);top=Math.min(top,q[1]);right=Math.max(right,q[0]);bottom=Math.max(bottom,q[1]);}
   }catch(_bounds){}
  }
 }finally{if(probe)try{probe.remove();}catch(_removeProbe){}}
 if(!isFinite(left))return null;
 return {left:left,top:top,right:right,bottom:bottom,center:[(left+right)/2,(top+bottom)/2]};
};

Transferify._bridgeScript=function(script){return '(function(){return eval(('+Transferify._decodePayload.toString()+')("'+Transferify._encodePayload(String(script))+'"));})();';};

// Optional development module; definitions only, never starts Photoshop.
(function(){var moduleFile=new File(new File($.fileName).parent.fsName+'/photoshop.jsx');if(moduleFile.exists)$.evalFile(moduleFile);})();
Transferify.pushFromPS=function(destination){
  if(Transferify._host()!='ae')return 'After Effects only';
  var comp=Transferify._aeComp();if(!comp)return 'Open the target composition first.';
  var folder;try{folder=Transferify._imageFolder(destination).fsName;}catch(error){return 'ERROR: '+String(error);}
  var compID=comp.id;
  return Transferify._psRequest(Transferify._psSnapshot,[folder],function(snapshot){return Transferify._receivePS(snapshot,compID);});
};


(function(){var moduleFile=new File(new File($.fileName).parent.fsName+'/figma-illustrator.jsx');if(moduleFile.exists)$.evalFile(moduleFile);})();
