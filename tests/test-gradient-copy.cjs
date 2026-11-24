const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const host=fs.readFileSync(require('node:path').join(__dirname,'../Transferify/jsx/host.jsx'),'utf8');
const a=host.indexOf('var layerIDs={};',host.indexOf('function gradientLayer(n)')),b=host.indexOf('var group=copied.property',a);const code=host.slice(a,b);
for(const insertion of [0,1,3]){let layers=[{id:1,name:'Vector'},{id:2,name:'Texto'},{id:3,name:'Foto'}],added={id:44,name:'Transferify Gradient'};added.remove=()=>layers.splice(layers.indexOf(added),1);const comp={get numLayers(){return layers.length;},layer:i=>layers[i-1]};const source={layer:()=>({copyToComp:()=>layers.splice(insertion,0,added)})};const ctx={comp,source,n:{name:'Sombra do Figma'},copied:null};vm.runInNewContext(code,ctx);assert.equal(ctx.copied,added);assert.equal(added.name,'Sombra do Figma');assert.equal(layers.find(l=>l.id===1).name,'Vector');assert.ok(!layers.some(l=>l.name==='Transferify Gradient'));}
console.log('PASS gradient source copy identified at top/middle/end; original user layers untouched and copied template receives source node name.');

assert.ok(host.includes("contents.property(i).matchName=='ADBE Vector Shape - Rect'"));
