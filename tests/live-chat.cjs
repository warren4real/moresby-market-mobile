const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(file,deps,extras={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,{exports,require:id=>deps[id],...extras});return exports;}
const message={id:'request',sequence:10,conversation_id:'chat',sender_id:'buyer',body:'Hello',created_at:'2026-10-23T00:00:00Z'};
function service(responses){const calls=[];const client={from(table){const call={table,filters:[]};calls.push(call);const q={select(){return q},eq(k,v){call.filters.push([k,v]);return q},insert(data){call.insert=data;return q},async single(){return responses.shift()},async maybeSingle(){return responses.shift()}};return q;}};return {calls,...load('src/live/chatService.ts',{'../services/supabase':{getSupabaseClient:()=>client}})};}
test('chat merge is ordered and deduplicates refreshed or retried messages',()=>{const s=service([]);const merged=s.mergeChatMessages([{...message,sequence:10},{...message,id:'old',sequence:1}],[{...message,body:'Confirmed'},{...message,id:'later',sequence:11}]);assert.equal(merged.length,3);assert.equal(merged[0].id,'old');assert.equal(merged[1].body,'Confirmed');assert.equal(merged[2].id,'later');});
test('starting chat derives seller on server, reuses existing conversation and recovers create race',async()=>{
 const existing=service([{data:{id:'existing'},error:null}]);assert.equal(await existing.startChat('listing','buyer'),'existing');assert.equal(existing.calls.length,1);
 const race=service([{data:null,error:null},{data:null,error:{code:'23505'}},{data:{id:'winner'},error:null}]);assert.equal(await race.startChat('listing','buyer'),'winner');assert.deepEqual(JSON.parse(JSON.stringify(race.calls[1].insert)),{listing_id:'listing',buyer_id:'buyer'});
});
test('message retry reuses request ID and verifies exact sender, conversation and body',async()=>{
 const s=service([{data:null,error:{code:'23505'}},{data:message,error:null}]);const result=await s.sendChatMessage('chat','buyer',' Hello ','request');assert.equal(result.id,'request');assert.equal(s.calls[0].insert.id,'request');assert.deepEqual(JSON.parse(JSON.stringify(s.calls[1].filters)),[['id','request'],['conversation_id','chat'],['sender_id','buyer'],['body','Hello']]);
 const denied=service([{data:null,error:{code:'23505'}},{data:null,error:{code:'denied'}}]);await assert.rejects(denied.sendChatMessage('chat','buyer','Hello','someone-else'));
});
test('empty and oversized messages never reach the database',async()=>{const s=service([]);await assert.rejects(s.sendChatMessage('chat','buyer',' ','id'));await assert.rejects(s.sendChatMessage('chat','buyer','a'.repeat(2001),'id'));assert.equal(s.calls.length,0);});
test('inbox polling pauses in background and never marks messages read',async()=>{
 const values=[],effects=[],cleanups=[],timers=new Set(),calls=[];let cursor=0,onState;
 const react={useState:initial=>{const i=cursor++;values[i]=initial;return[values[i],value=>{values[i]=typeof value==='function'?value(values[i]):value}]},useCallback:fn=>fn,useEffect:fn=>effects.push(fn)};
 const app={currentState:'active',addEventListener:(_event,fn)=>{onState=fn;return{remove:()=>{onState=null}}}};
 const client={from:table=>{calls.push(table);const q={select(){return q},order(){return q},range:async()=>({data:[],error:null})};return q},rpc:async name=>{calls.push(name);return {data:2,error:null}}};
 const m=load('src/live/useChatInbox.ts',{react,'react-native':{AppState:app},'../services/supabase':{getSupabaseClient:()=>client}},{setInterval:fn=>{timers.add(fn);return fn},clearInterval:fn=>timers.delete(fn)});
 m.useChatInbox('buyer');effects.forEach(fn=>cleanups.push(fn()));await new Promise(r=>setImmediate(r));assert.equal(values[1],2);assert.equal(timers.size,1);assert.ok(!calls.includes('mark_chat_read'));
 app.currentState='background';onState('background');assert.equal(timers.size,0);const before=calls.length;await new Promise(r=>setImmediate(r));assert.equal(calls.length,before);
 app.currentState='active';onState('active');await new Promise(r=>setImmediate(r));assert.ok(calls.length>before);cleanups.forEach(fn=>fn?.());assert.equal(timers.size,0);
});
test('thread marks only displayed latest messages read, and waits while scrolled away',async()=>{
 const state=[],effects=[],cleanups=[],depsBySlot=[],timers=new Set(),rpc=[];let cursor=0;
 const react={createElement:(type,props,...children)=>({type,props:props||{},children}),useState:initial=>{const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v}]},useRef:initial=>{const i=cursor++;if(!(i in state))state[i]={current:initial};return state[i]},useEffect:(fn,deps)=>{const i=cursor++;if(!depsBySlot[i]||deps.some((d,n)=>d!==depsBySlot[i][n])){depsBySlot[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn()})}}};
 let serverMessages=[message];const app={currentState:'active',addEventListener:()=>({remove:()=>{}})};
 const client={from:table=>{const q={select(){return q},eq(){return q},order(){return q},maybeSingle:async()=>({data:table==='listings'?{category:'Phones & Electronics',negotiable:true}:{id:'chat',buyer_id:'buyer',listing_id:'listing',other_name:'Seller',listing_status:'available'},error:null}),limit:async()=>({data:[...serverMessages].reverse(),error:null})};return q},rpc:async(name,args)=>{rpc.push({name,args});return {error:null}}};
 const extraDeps={react,'react-native':{Alert:{alert:()=>{}},AppState:app,Pressable:'Pressable',ScrollView:'ScrollView',Text:'Text',TextInput:'TextInput',View:'View'},'../components/Button':{Button:'Button'},'../components/ChoiceField':{ChoiceField:'ChoiceField'},'../services/supabase':{getSupabaseClient:()=>client},'../theme/marketplace':{ui:{},palette:{}},'./chatService':service([]),'../data/demoProfiles':load('src/data/demoProfiles.ts',{})};
 const exports={};const code=fs.readFileSync('src/live/LiveChats.tsx','utf8').replace('function ChatThread(', 'export function ChatThread(');
 vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText,{exports,require:id=>extraDeps[id],setInterval:fn=>{timers.add(fn);return fn},clearInterval:fn=>timers.delete(fn)});
 function render(active=true,userId='buyer'){cursor=0;return exports.ChatThread({id:'chat',userId,active,onDraft:()=>{},onBack:()=>{},onChanged:()=>{}})}
 async function flush(){effects.splice(0).forEach(fn=>fn());await new Promise(r=>setImmediate(r));}
 function find(node,pred){if(!node)return null;if(Array.isArray(node))return node.map(n=>find(n,pred)).find(Boolean);if(pred(node))return node;return find(node.children,pred);}
 render(false);await flush();assert.equal(rpc.length,0);
 render();await flush();let root=render();await flush();assert.equal(rpc.length,1);assert.equal(rpc[0].args.last_message,'request');assert.deepEqual(Object.keys(rpc[0].args).sort(),['last_message','target']);
 const suggestion=find(root,n=>n.props?.accessibilityLabel==='Use suggested message: Hi, is this still available?');assert.ok(suggestion);suggestion.props.onPress();root=render();await flush();assert.equal(find(root,n=>n.props?.accessibilityLabel==='Message text').props.value,'Hi, is this still available?');assert.equal(rpc.length,1);assert.ok(find(root,n=>n.props?.accessibilityLabel==='Use suggested message: Is the price negotiable?'));
 const sellerRoot=render(false,'seller');assert.ok(!find(sellerRoot,n=>n.props?.accessibilityLabel?.startsWith('Use suggested message:')));root=render();await flush();
 find(root,n=>n.type==='ScrollView').props.onScroll({nativeEvent:{contentOffset:{y:0},contentSize:{height:1000},layoutMeasurement:{height:100}}});
 serverMessages.push({...message,id:'new',sequence:11,sender_id:'seller'});timers.forEach(fn=>fn());await new Promise(r=>setImmediate(r));root=render();await flush();assert.equal(rpc.length,1);
 find(root,n=>n.type==='ScrollView').props.onScroll({nativeEvent:{contentOffset:{y:900},contentSize:{height:1000},layoutMeasurement:{height:100}}});await new Promise(r=>setImmediate(r));assert.equal(rpc.length,2);assert.equal(rpc[1].args.last_message,'new');
 render(false);await flush();assert.equal(timers.size,0);cleanups.forEach(fn=>fn?.());
});
