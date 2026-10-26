const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(path,requireFn=()=>({}),extra={}) {
 const exports={};const context={exports,module:{exports},require:requireFn,console,...extra};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,context);return exports;
}
const {listingEditPayload}=load('src/live/listingEdits.ts');
const row={id:'33333333-3333-4333-8333-333333333333',owner_id:'owner',title:'Original',description:'Original description',price:100,image_path:'owner/old.jpg',status:'unavailable'};
function fixture(options={}) {
 let handler;const calls=[];const saved={...row,...options.existing};
 const client={auth:{getUser:async()=>({data:{user:options.signedOut?null:{id:'owner',email_confirmed_at:'now'}},error:null})},from(table){
  let patch,filters=[];const q={select(){return q},eq(k,v){filters.push([k,v]);return q},neq(k,v){filters.push(['not:'+k,v]);return q},update(v){patch=v;calls.push({patch});return q},async maybeSingle(){
   if(options.readFailure)return {data:null,error:{message:'denied'}};
   if(!patch)return {data:saved.owner_id==='owner'?{...saved}:null,error:null};
   if(options.writeFailure)return {data:null,error:{message:'denied'}};
   if(options.conflict)return {data:null,error:null};
   assert.ok(filters.some(([k,v])=>k==='owner_id'&&v==='owner'));
   assert.ok(filters.some(([k,v])=>k==='not:status'&&v==='removed'));
   Object.assign(saved,patch);return {data:{id:row.id},error:null};
  }};return q;
 }};
 const admin={storage:{from(){return {upload:async(path,bytes)=>{calls.push({upload:path,bytes:[...bytes]});return {error:null}},remove:async(paths)=>{calls.push({remove:paths});return {error:null}}}}},from(){const q={select(){return q},eq(){return q},gte(){return Promise.resolve({count:0})},insert:async(v)=>{calls.push({asset:v});return {error:null}},delete(){calls.push({deleteAsset:true});return q},then(resolve){resolve({error:null})}};return q}};
 load('supabase/functions/edit-listing/index.ts',id=>id.includes('supabase')?{createClient:(_url,key)=>key==='service'?admin:client}:{decode:()=>({data:new Uint8Array([1,2,3,4]),width:1,height:1}),encode:()=>({data:new Uint8Array([255,216,1,255,217])})},{Deno:{serve(fn){handler=fn},env:{get:key=>key==='SUPABASE_SERVICE_ROLE_KEY'?'service':'anon'}},Response,File,Uint8Array,crypto:require('node:crypto').webcrypto});
 return {calls,saved,async request({photo,fields=listingEditPayload(row,'Edited','Edited description','200'),bearer=true}={}){const form=new FormData();form.append('listing',JSON.stringify(fields));if(photo)form.append('photo',new Blob([photo],{type:'image/jpeg'}),'image.jpg');return handler(new Request('https://test.invalid',{method:'POST',headers:bearer?{Authorization:'Bearer fixture'}:{},body:form}));}};
}
test('edit payload validates values and sends only allowed fields with original snapshot',()=>{
 const value=listingEditPayload(row,' Updated ',' New description ','200.50');
 assert.deepEqual(Object.keys(value).sort(),['before','description','id','price','title']);assert.equal(value.title,'Updated');assert.equal(value.price,200.5);assert.equal(value.before.image_path,row.image_path);
 for(const price of ['', 'NaN','-1','10000000000'])assert.throws(()=>listingEditPayload(row,'A','B',price));
 assert.throws(()=>listingEditPayload(row,' ','B','1'));
});
test('metadata save retains current photo and availability and does not upload',async()=>{
 const f=fixture();const response=await f.request();assert.equal(response.status,200);assert.equal(f.saved.title,'Edited');assert.equal(f.saved.price,200);assert.equal(f.saved.image_path,row.image_path);assert.equal(f.saved.status,'unavailable');assert.equal(f.calls.filter(c=>c.upload).length,0);
});
test('photo replacement uses unique validated asset and allowlisted caller-RLS write',async()=>{
 const f=fixture();const response=await f.request({photo:new Uint8Array([255,216,8,9])});assert.equal(response.status,200);assert.notEqual(f.saved.image_path,row.image_path);assert.ok(f.saved.image_path.startsWith('owner/'));assert.equal(f.calls.filter(c=>c.upload).length,1);assert.equal(f.calls.filter(c=>c.remove).length,0);assert.deepEqual(Object.keys(f.calls.find(c=>c.patch).patch).sort(),['description','image_path','price','title']);
});
test('missing authentication, foreign owners and removed rows cannot edit or upload',async()=>{
 const a=fixture();assert.equal((await a.request({bearer:false})).status,401);
 const b=fixture({signedOut:true});assert.equal((await b.request()).status,401);
 for(const existing of [{owner_id:'someone-else'},{status:'removed'}]){const f=fixture({existing});assert.equal((await f.request({photo:new Uint8Array([255,216,8,9])})).status,404);assert.equal(f.calls.length,0);}
});
test('stale editor is rejected before upload',async()=>{
 const f=fixture({existing:{title:'Changed elsewhere'}});assert.equal((await f.request({photo:new Uint8Array([255,216,8,9])})).status,409);assert.equal(f.calls.length,0);
});
test('failed or racing save cleans only its newly uploaded photo and leaves original untouched',async()=>{
 for(const opt of [{writeFailure:true},{conflict:true}]){const f=fixture(opt);assert.equal((await f.request({photo:new Uint8Array([255,216,8,9])})).status,400);assert.equal(f.saved.image_path,row.image_path);const removed=f.calls.find(c=>c.remove).remove;assert.equal(removed.length,1);assert.notEqual(removed[0],row.image_path);assert.ok(f.calls.some(c=>c.deleteAsset));}
});
test('invalid photo is rejected without changing listing',async()=>{
 const f=fixture();assert.equal((await f.request({photo:new Uint8Array([0,1,2,3])})).status,400);assert.equal(f.calls.length,0);
});
