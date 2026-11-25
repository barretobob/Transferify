const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../Transferify/jsx/figma-illustrator.jsx'),'utf8');
const start=source.indexOf(' function directChildren('),end=source.indexOf(' var source=null,original=null',start);
assert.ok(start>0&&end>start);const context=vm.createContext({ElementPlacement:{PLACEBEFORE:'before',PLACEATEND:'end',PLACEATBEGINNING:'first'}});vm.runInContext(source.slice(start,end),context);
function attach(parent,item){item.parent=parent;parent.pageItems.push(item);return item;}
function movable(item){item.move=function(target,placement){const previous=this.parent;if(previous)previous.pageItems.splice(previous.pageItems.indexOf(this),1);let p=placement==='before'?target.parent:target;this.parent=p;if(placement==='before')p.pageItems.splice(p.pageItems.indexOf(target),0,this);else if(placement==='first')p.pageItems.unshift(this);else p.pageItems.push(this);};return item;}
function group(name,clipped=false){const g=movable({typename:'GroupItem',name,clipped,pageItems:[],visibleBounds:[-999,999,999,-999]});g.groupItems={add:()=>attach(g,group('new'))};g.pathItems={rectangle:(top,left,width,height)=>attach(g,leaf('mask',[left,top,left+width,top-height]))};return g;}
function leaf(name,bounds){return movable({typename:'PathItem',name,visibleBounds:bounds,geometricBounds:bounds,clipping:false,filled:true,stroked:false});}
const frame=[100,500,500,100],root=group('Frame'),inside=attach(root,leaf('inside',[130,470,200,400])),ball=attach(root,leaf('ball',[50,450,180,320])),nested=attach(root,group('nested')),nestedInside=attach(nested,leaf('nested inside',[200,400,300,300])),outside=attach(nested,leaf('large shape',[90,600,550,50]));
const photo=attach(root,group('photo',true)),photoMask=attach(photo,leaf('original mask',[250,450,350,350]));photoMask.clipping=true;const image=attach(photo,movable({typename:'RasterItem',name:'photo pixels',visibleBounds:[-500,900,1000,-600]}));
const crossing=attach(root,group('crossing existing mask',true)),crossMask=attach(crossing,leaf('existing mask',[450,450,550,350]));crossMask.clipping=true;attach(crossing,leaf('art',[430,480,600,250]));
const fullOutside=attach(root,leaf('entirely outside',[600,700,700,600]));
context.clipOverflow(root,frame);
assert.equal(root.clipped,false);assert.equal(inside.parent,root);assert.equal(nestedInside.parent,nested);assert.equal(photo.parent,root);assert.equal(photoMask.parent,photo);assert.equal(image.parent,photo,'existing photo clipping hides oversized pixel bounds');
function clipped(item){assert.equal(item.parent.clipped,true);const m=item.parent.pageItems[0];assert.equal(m.clipping,true);assert.deepEqual(m.geometricBounds,frame);assert.equal(item.parent.pageItems[1],item);return item.parent;}
const ballWrapper=clipped(ball),outsideWrapper=clipped(outside),crossWrapper=clipped(crossing),fullWrapper=clipped(fullOutside);assert.equal(crossMask.parent,crossing);assert.equal(crossing.clipped,true);assert.deepEqual(root.pageItems,[inside,ballWrapper,nested,photo,crossWrapper,fullWrapper]);assert.deepEqual(nested.pageItems,[nestedInside,outsideWrapper]);
const border=attach(root,leaf('exact edge',frame.slice()));context.clipOverflow(border,frame);assert.equal(border.parent,root);
// Native visible bounds include strokes: a stroke extending over the edge must be clipped.
const stroke=attach(root,leaf('stroke',[99,450,150,400]));stroke.geometricBounds=[100,449,149,401];context.clipOverflow(stroke,frame);clipped(stroke);
console.log('PASS selective native clipping: crossing/fully outside/stroked objects clipped; interior elements remain free; nested groups, photo masks, coordinates and paint order preserved.');
