const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function fixture(options={}){
 let handler,clients=0;const calls=[];let files=options.files||['one.jpg','two.jpg'];
 const user={id:'fixture-owner',email:'fixture@example.invalid',email_confirmed_at:'now'};
 const admin={rpc:async(name,args)=>{calls.push({name,args});return {error:options.failBegin&&name==='begin_account_deletion'||options.failFinish&&name==='finish_account_deletion'?{message:'fail'}:null}},auth:{admin:{deleteUser:async(id,soft)=>{calls.push({deleteUser:id,soft});return {error:options.failDelete?{message:'fail'}:null}}}},storage:{from(bucket){assert.equal(bucket,'market-listing-images');return {list:async(prefix,opts)=>{calls.push({list:prefix,opts});return {data:files.slice(0,100).map(name=>({name})),error:options.failList?{message:'fail'}:null}},remove:async(paths)=>{calls.push({remove:paths});if(!options.failRemove)files=files.slice(paths.length);return {error:options.failRemove?{message:'fail'}:null}}}}}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('supabase/functions/delete-account/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:()=>({createClient:()=>{clients++;if(clients===1)return {auth:{getUser:async()=>({data:{user:options.signedOut?null:user},error:null})}};if(clients===2)return {auth:{signInWithPassword:async(value)=>{calls.push({reauth:value.email});return {data:{user:{id:options.wrongUser?'another-account':user.id}},error:options.badPassword?{message:'bad'}:null}}}};return admin;}}),Deno:{serve:fn=>{handler=fn},env:{get:()=>''}},Response,console});
 return {calls,async request(body={confirmation:'DELETE',password:'private-fixture-password'},bearer=true){return handler(new Request('https://example.invalid',{method:'POST',headers:bearer?{Authorization:'Bearer fixture'}:{},body:JSON.stringify(body)}));}};
}
test('deletion needs authenticated account, explicit confirmation and verified matching password',async()=>{
 const a=fixture();assert.equal((await a.request(undefined,false)).status,401);assert.equal(a.calls.length,0);
 const b=fixture({signedOut:true});assert.equal((await b.request()).status,401);
 const c=fixture();assert.equal((await c.request({confirmation:'delete',password:'value'})).status,400);assert.equal(c.calls.length,0);
 for(const options of [{badPassword:true},{wrongUser:true}]){const f=fixture(options);assert.equal((await f.request()).status,403);assert.equal(f.calls.filter(c=>c.name||c.remove||c.deleteUser).length,0);}
});
test('deletion targets only bearer owner, revokes first, paginates photos then hard deletes',async()=>{
 const f=fixture({files:Array.from({length:205},(_,i)=>`${i}.jpg`)});const response=await f.request({confirmation:'DELETE',password:'private',user_id:'injected-other'});assert.equal(response.status,200);assert.equal((await response.json()).deleted,true);
 const begin=f.calls.findIndex(c=>c.name==='begin_account_deletion'),remove=f.calls.findIndex(c=>c.remove),del=f.calls.findIndex(c=>c.deleteUser),finish=f.calls.findIndex(c=>c.name==='finish_account_deletion');assert.ok(begin<remove&&remove<del&&del<finish);assert.equal(f.calls[begin].args.target,'fixture-owner');assert.equal(f.calls[del].deleteUser,'fixture-owner');assert.equal(f.calls[del].soft,false);assert.equal(f.calls.filter(c=>c.remove).flatMap(c=>c.remove).length,205);assert.ok(f.calls.filter(c=>c.remove).flatMap(c=>c.remove).every(p=>p.startsWith('fixture-owner/')));
});
test('failed start does not remove photos or delete account',async()=>{
 const f=fixture({failBegin:true});assert.equal((await f.request()).status,503);assert.equal(f.calls.filter(c=>c.remove||c.deleteUser).length,0);
});
test('failed photo cleanup keeps account hidden and does not claim completion',async()=>{
 for(const options of [{failList:true},{failRemove:true}]){const f=fixture(options);const response=await f.request();assert.equal(response.status,503);assert.match((await response.json()).error,/hidden/);assert.equal(f.calls.filter(c=>c.deleteUser||c.name==='finish_account_deletion').length,0);}
});
test('failed user deletion or completion recording never reports successful deletion',async()=>{
 for(const options of [{failDelete:true},{failFinish:true}]){const f=fixture(options);assert.equal((await f.request()).status,503);}
});
test('native deletion UI requires typed confirmation, password and final destructive tap; cancel sends nothing',async()=>{
 const values=[],alerts=[],requests=[];let cursor=0;
 const react={createElement:(type,props,...children)=>({type,props:props||{},children}),useEffect:()=>{},useState:initial=>{const i=cursor++;if(!(i in values))values[i]=initial;return [values[i],v=>{values[i]=typeof v==='function'?v(values[i]):v}];}};
 const deps={react,'react-native':{Alert:{alert:(...args)=>alerts.push(args)},Text:'Text',TextInput:'TextInput',View:'View'},'../components/Button':{Button:'Button'},'../theme/marketplace':{ui:{}},'../services/supabase':{getSupabaseClient:()=>({functions:{invoke:async(name,args)=>{requests.push({name,args});return {data:{deleted:true},error:null}}},auth:{signOut:async()=>({error:null})}})}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/live/AccountSafety.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,{exports,require:id=>deps[id]});
 const render=()=>{cursor=0;return exports.AccountSafety({userId:'owner',onChanged:()=>{},onBusyChange:()=>{}})};
 function find(node,pred){if(!node)return null;if(Array.isArray(node))return node.map(n=>find(n,pred)).find(Boolean);if(pred(node))return node;return find(node.children,pred);}
 const button=title=>find(render(),node=>node.props?.title===title);
 button('Delete my account…').props.onPress();button('Permanently delete account').props.onPress();assert.equal(alerts.length,0);assert.equal(requests.length,0);
 find(render(),node=>node.props?.accessibilityLabel==='Deletion confirmation').props.onChangeText('DELETE');find(render(),node=>node.props?.accessibilityLabel==='Deletion password').props.onChangeText('synthetic-test-password');
 button('Permanently delete account').props.onPress();assert.equal(requests.length,0);assert.equal(alerts.at(-1)[2][0].text,'Keep account');assert.equal(alerts.at(-1)[2][1].style,'destructive');
 button('Cancel deletion').props.onPress();assert.equal(requests.length,0);
 button('Delete my account…').props.onPress();find(render(),node=>node.props?.accessibilityLabel==='Deletion confirmation').props.onChangeText('DELETE');find(render(),node=>node.props?.accessibilityLabel==='Deletion password').props.onChangeText('synthetic-test-password');button('Permanently delete account').props.onPress();alerts.at(-1)[2][1].onPress();await new Promise(resolve=>setImmediate(resolve));assert.equal(requests.length,1);assert.equal(requests[0].name,'delete-account');
});
