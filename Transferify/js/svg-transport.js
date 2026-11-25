'use strict';
exports.validate=function(payload){
 if(!payload||payload.protocol!=='transferify-figma-svg'||payload.version!==1||!Array.isArray(payload.items)||!payload.items.length||payload.items.length>100)throw Error('Invalid Figma SVG package');
 return {protocol:payload.protocol,version:1,items:payload.items.map(function(item){
  if(typeof item.svg!=='string'||item.svg.length>48*1024*1024||!/<svg[\s>]/i.test(item.svg))throw Error('Invalid or oversized SVG');
  if(/<!DOCTYPE|<!ENTITY|<script\b|<foreignObject\b|\bon[a-z]+\s*=/i.test(item.svg))throw Error('Active SVG content is not supported');
  var refs=item.svg.match(/(?:href\s*=\s*["'][^"']*["']|url\([^)]*\))/gi)||[];
  refs.forEach(function(ref){var value=ref.replace(/^(?:.*?=\s*["']|url\(\s*["']?)/i,'').replace(/["')\s]+$/,'');if(value.charAt(0)!=='#'&&!/^data:image\/(png|jpeg|webp|gif);base64,/i.test(value))throw Error('External SVG resources are not supported');});
  if(typeof item.x!=='number'||typeof item.y!=='number'||!isFinite(item.x)||!isFinite(item.y)||Math.abs(item.x)>1e6||Math.abs(item.y)>1e6)throw Error('Invalid SVG coordinates');
  var frame=null;if(item.frame){var f=item.frame;if(f.type!=='FRAME'||typeof f.nodeId!=='string'||!f.nodeId||typeof f.width!=='number'||typeof f.height!=='number'||!isFinite(f.width)||!isFinite(f.height)||f.width<=0||f.height<=0||f.width>16383||f.height>16383)throw Error('Invalid Figma Frame metadata');frame={type:'FRAME',nodeId:f.nodeId.slice(0,200),width:f.width,height:f.height,clipsContent:!!f.clipsContent};}var groups=[];if(Array.isArray(item.groups)){if(item.groups.length>2000)throw Error('Too many Figma groups');groups=item.groups.map(function(g){if(!g||!/^TF_GROUP_[a-zA-Z0-9_]+$/.test(g.token)||typeof g.name!=='string')throw Error('Invalid Figma group metadata');return {token:g.token,name:g.name.slice(0,500)};});}return {name:String(item.name||'Figma artwork').slice(0,200),x:item.x,y:item.y,svg:item.svg,frame:frame,groups:groups};
 })};
};
