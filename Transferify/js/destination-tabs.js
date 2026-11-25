(function(root){'use strict';var labels={ae:'After Effects',ai:'Illustrator',figma:'Figma',ps:'Photoshop'},pairs={ae:['ai','figma','ps'],ai:['ae','figma'],figma:['ae','ai']};
function targets(host){return (pairs[host]||[]).slice();}
function choose(host,presence,preferred){var list=targets(host);if(list.indexOf(preferred)>=0&&presence[preferred])return preferred;for(var i=0;i<list.length;i++)if(presence[list[i]])return list[i];return list.indexOf(preferred)>=0?preferred:list[0];}
function render(doc,prefix,host,presence,selected,busy){targets(host).forEach(function(peer){var button=doc.getElementById(prefix+peer);if(!button)return;var active=peer===selected;button.className='destination-tab'+(active?' active':'');button.disabled=!!busy||!presence[peer];button.setAttribute('aria-selected',String(active));button.setAttribute('tabindex',active?'0':'-1');button.title=presence[peer]?labels[peer]:'Abra '+labels[peer]+' e o Transferify para conectar.';});}
var api={targets:targets,choose:choose,render:render,labels:labels};root.TransferifyTabs=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:this);
