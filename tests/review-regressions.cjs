const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(file, dependencies={}, transform=s=>s){
 const module={exports:{}};
 const code=ts.transpileModule(transform(fs.readFileSync(file,'utf8')),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:id=>{if(!(id in dependencies))throw Error(id);return dependencies[id];}});
 return module.exports;
}
function fixture(){
 const files=new Map(),writes=[];let raw=null,failRead=false,failFile=false;
 const disk={documentDirectory:'file:///new/Documents/',makeDirectoryAsync:async()=>{},writeAsStringAsync:async(uri,data)=>{if(failFile)throw Error('disk full');files.set(uri,data);},copyAsync:async({from,to})=>{if(failFile)throw Error('disk full');files.set(to,from);}};
 const photos=load('src/services/photos.ts',{'expo-file-system/legacy':disk});
 const storage=load('src/services/storage.ts',{'./photos':photos,'@react-native-async-storage/async-storage':{getItem:async()=>{if(failRead)throw Error('read failed');return raw;},setItem:async(key,value)=>{writes.push(value);raw=value;}}});
 return {photos,storage,files,writes,setRaw:v=>raw=v,getRaw:()=>raw,failRead:()=>failRead=true,failFile:()=>failFile=true};
}
const photo='data:image/png;base64,'+'A'.repeat(2200000);
const product={id:1,name:'Item',image:photo,stock:1,area:'Boroko',shop:'Seller',category:'Other Items'};
const snapshot={products:[product],orders:[{product}],chats:[{id:'chat',product,messages:[]}],saved:[1],shop:null};
test('large legacy photos migrate once across listings, orders and chats before saving',async()=>{
 const f=fixture();f.setRaw(JSON.stringify(snapshot));const result=await f.storage.loadMarketplace();
 assert.equal(f.files.size,1);assert.ok(result.products[0].image.startsWith('file:///new/Documents/listing-photos/'));
 assert.equal(result.products[0].image,result.orders[0].product.image);assert.equal(result.products[0].image,result.chats[0].product.image);
 assert.ok(f.getRaw().length<2000);assert.equal(result.saved[0],1);
});
test('failed migration preserves original snapshot',async()=>{
 const f=fixture();const raw=JSON.stringify(snapshot);f.setRaw(raw);f.failFile();await assert.rejects(f.storage.loadMarketplace());assert.equal(f.getRaw(),raw);assert.equal(f.writes.length,0);
});
test('picked cache photos are copied to durable files; app paths rebase after update',async()=>{
 const f=fixture();const uri=await f.photos.persistPhoto('file:///cache/picked.jpg');assert.ok(uri.includes('/Documents/listing-photos/'));assert.equal(f.files.get(uri),'file:///cache/picked.jpg');
 assert.equal(f.photos.resolvePhoto('file:///old/Documents/listing-photos/photo.jpg'),'file:///new/Documents/listing-photos/photo.jpg');
});
test('overlapping saves preserve latest data',async()=>{
 const f=fixture();await Promise.all([f.storage.saveMarketplace({...snapshot,saved:[1]}),f.storage.saveMarketplace({...snapshot,saved:[2]})]);assert.equal(JSON.parse(f.getRaw()).saved[0],2);
});
function provider(storage){
 const values=[],effects=[],lastDeps=[];let cursor=0,effectCursor=0;
 const react={createContext:()=>({}),useContext:()=>null,useState:initial=>{const index=cursor++;if(!(index in values))values[index]=initial;return [values[index],value=>{values[index]=typeof value==='function'?value(values[index]):value;}];},useEffect:(fn,deps)=>{const i=effectCursor++;if(!lastDeps[i]||deps.some((d,n)=>d!==lastDeps[i][n])){lastDeps[i]=deps;effects.push(fn);}}};
 const alerts=[];const module=load('src/state/MarketplaceProvider.tsx',{'react':react,'react-native':{Alert:{alert:(...args)=>alerts.push(args)}},'../data/sampleProducts':{initialProducts:[{...product,image:'https://image'}],normaliseProduct:p=>p},'../services/storage':storage,'../data/demoProfiles':load('src/data/demoProfiles.ts'),'./useSellerDraft':load('src/state/useSellerDraft.ts',{'react':react})},s=>s.replace('function useMarketplaceState()', 'export function useMarketplaceState()'));
 return {alerts,render(){cursor=0;effectCursor=0;return module.useMarketplaceState();},async flush(){while(effects.length)effects.shift()();await new Promise(r=>setImmediate(r));}};
}
test('failed initial load never enables automatic saving',async()=>{
 let saves=0;const p=provider({loadMarketplace:async()=>{throw Error('read failed');},saveMarketplace:async()=>{saves++;}});p.render();await p.flush();const state=p.render();await p.flush();assert.equal(state.ready,true);assert.equal(saves,0);assert.ok(p.alerts[0][1].includes('Saving is paused'));
});
test('chat snapshot opens latest sold item and rejects a stale request; removed listing cannot open',async()=>{
 const p=provider({loadMarketplace:async()=>null,saveMarketplace:async()=>{}});let s=p.render();s.setProducts([{...product,stock:0}]);s=p.render();s.showProduct({...product,stock:1});s=p.render();assert.equal(s.selected.stock,0);s.setSelected({...product,stock:1});s=p.render();s.request();s=p.render();assert.equal(s.orders.length,0);assert.equal(s.selected.stock,0);s.setProducts([]);s=p.render();s.setSelected(null);s.showProduct(product);s=p.render();assert.equal(s.selected,null);
});

test('seller draft survives tab changes and seller pages clear incompatible filters',()=>{
 const p=provider({loadMarketplace:async()=>null,saveMarketplace:async()=>{}});
 let s=p.render();s.sellerDraft.setName('Apartment draft');s.sellerDraft.setPhoto('file:///saved.jpg');s.sellerDraft.setBedrooms('2');s.setTab('Me');
 s=p.render();s.setTab('Sell');s=p.render();assert.equal(s.sellerDraft.name,'Apartment draft');assert.equal(s.sellerDraft.photo,'file:///saved.jpg');assert.equal(s.sellerDraft.bedrooms,'2');
 s.setSellerFilter('Businesses');s.setProvinceFilter('Morobe');s.setLocalityFilter('Lae');s.setConditionFilter('Second-hand');s.setSearch('unrelated');s.setCategory('Property');s.setPropertyType('Rooms');s.setPropertyPurpose('For rent');
 s=p.render();assert.equal(s.filtered.length,0);s.openSeller('Seller');s=p.render();assert.equal(s.filtered.length,1);assert.equal(s.activeShop,'Seller');assert.equal(s.tab,'Explore');assert.equal(s.propertyType,'All property');assert.equal(s.propertyPurpose,'Any purpose');
});
test('land publishing ignores a hidden invalid bedroom value; apartments still reject it',()=>{
 let created=0;const alerts=[];
 const draft={name:'Land',price:'1000',area:'Lae',description:'Listing details',photo:'https://example.com/land.jpg',photoLink:'',mode:'Individual',category:'Property',propertyType:'Land & Lots',purpose:'For sale',period:'Per month',bedrooms:'1.5',size:'100',province:'Morobe',meetup:false,pickup:false};
 for(const key of Object.keys(draft))draft['set'+key[0].toUpperCase()+key.slice(1)]=()=>{};
 const react={createElement:(type,props,...children)=>({type,props:props||{},children})};
 const market={sellerDraft:draft,profile:{name:'Seller',area:'Lae'},products:[],activeProfileId:'demo-seller',isOwnProduct:p=>p.ownerId==='demo-seller',setProducts:()=>created++,setTab:()=>{},setShop:()=>{}};
 const {SellerScreen}=load('src/screens/SellerScreen.tsx',{'react':react,'react-native':{Alert:{alert:(...a)=>alerts.push(a)},Image:'Image',Pressable:'Pressable',Text:'Text',TextInput:'TextInput',View:'View'},'../services/photos':{},'expo-image-picker':{},'../state/MarketplaceProvider':{useMarketplace:()=>market},'../components/ProvinceField':{ProvinceField:'ProvinceField'},'../components/ChoiceField':{ChoiceField:'ChoiceField'},'../data/categories':{marketplaceCategories:[],propertyTypes:[],purposesFor:()=>[]},'../theme/marketplace':{ui:{}},'../components/Icon':{Icon:'Icon'},'../components/Button':{Button:'Button'}});
 function find(node){if(!node||typeof node!=='object')return;if(node.type==='Button'&&node.props.title==='Create demo listing →')return node;for(const child of (Array.isArray(node)?node:node.children||[])){const match=find(child);if(match)return match;}}
 find(SellerScreen()).props.onPress();assert.equal(created,1);
 draft.propertyType='Apartments & Houses';find(SellerScreen()).props.onPress();assert.equal(created,1);assert.equal(alerts.at(-1)[0],'Property details');
});

test('property condition and filtering stay consistent across reloads, including older New values',()=>{
 const categories=load('src/data/categories.ts');
 const {normaliseProduct}=load('src/data/sampleProducts.ts',{'./categories':categories});
 const room={...product,id:99,image:'https://example.com/room.jpg',category:'Property',condition:undefined,property:{type:'Rooms',purpose:'For rent',pricePeriod:'Per month'}};
 const freshItem={...product,id:100,condition:'New'};
 const usedItem={...product,id:101,condition:'Good'};
 assert.equal(normaliseProduct(room).condition,undefined);
 assert.equal(normaliseProduct({...room,condition:'New'}).condition,undefined);
 for(const property of [room, normaliseProduct(JSON.parse(JSON.stringify(room))), normaliseProduct({...room,condition:'New'})]){
   const p=provider({loadMarketplace:async()=>null,saveMarketplace:async()=>{}});
   let s=p.render();s.setProducts([property,freshItem,usedItem]);s=p.render();
   assert.equal(s.filtered.length,3);
   s.setConditionFilter('New');s=p.render();assert.equal(s.filtered.length,1);assert.equal(s.filtered[0].id,100);
   s.setConditionFilter('Second-hand');s=p.render();assert.equal(s.filtered.length,1);assert.equal(s.filtered[0].id,101);
   s.setCategory('Property');s=p.render();assert.equal(s.filtered.length,1);assert.equal(s.filtered[0].id,99);
 }
});
test('buyer and seller exchange attributed local messages and retain separate saved items and drafts',()=>{
 const p=provider({loadMarketplace:async()=>null,saveMarketplace:async()=>{}});
 let s=p.render();s.setProducts([{...product,ownerId:'demo-seller'}]);s.sellerDraft.setName('Seller draft');s.toggleSaved(1);s.openChat(product);s=p.render();assert.equal(s.visibleChats.length,0);
 s.switchProfile('demo-buyer');s=p.render();assert.equal(s.saved.length,0);assert.equal(s.sellerDraft.name,'');s.sellerDraft.setName('Buyer draft');s.openChat(product);s=p.render();assert.equal(s.visibleChats.length,1);const id=s.conversationId;
 s.sendMessage(id,'Is it available?');s=p.render();assert.equal(s.visibleChats[0].messages[0].senderId,'demo-buyer');
 s.switchProfile('demo-seller');s=p.render();assert.equal(s.conversationId,null);assert.equal(s.saved.length,1);assert.equal(s.sellerDraft.name,'Seller draft');assert.equal(s.visibleChats[0].messages[0].text,'Is it available?');
 s.sendMessage(id,'Yes, we can meet in Boroko.');s=p.render();assert.equal(s.visibleChats[0].messages[1].senderId,'demo-seller');
 s.switchProfile('demo-buyer');s=p.render();assert.equal(s.sellerDraft.name,'Buyer draft');assert.equal(s.visibleChats[0].messages.length,2);s.openChat(product);s=p.render();assert.equal(s.visibleChats.length,1);assert.equal(s.conversationId,id);
});
test('profiles and two-sided chat survive persistence and legacy chats remain readable',async()=>{
 let saved;
 const p=provider({loadMarketplace:async()=>null,saveMarketplace:async data=>{saved=data;}});
 p.render();await p.flush();let s=p.render();await p.flush();s.switchProfile('demo-buyer');s=p.render();s.openChat(product);s=p.render();s.sendMessage(s.conversationId,'Hello seller');s.setProfile({name:'Test Buyer',area:'Lae'});s=p.render();await p.flush();
 assert.equal(saved.activeProfileId,'demo-buyer');assert.equal(saved.buyerProfile.name,'Test Buyer');
 const next=provider({loadMarketplace:async()=>saved,saveMarketplace:async()=>{}});next.render();await next.flush();s=next.render();assert.equal(s.profile.name,'Test Buyer');assert.equal(s.visibleChats[0].messages[0].text,'Hello seller');s.switchProfile('demo-seller');s=next.render();assert.equal(s.visibleChats[0].messages[0].senderId,'demo-buyer');
 const helpers=load('src/data/demoProfiles.ts');assert.equal(helpers.participants({product,messages:[]}).buyerId,'demo-buyer');
});
function photoHarness(granted=true,canceled=false){
 const calls=[];const alerts=[];
 const draft={mode:'Individual',name:'',price:'',area:'',description:'',condition:'Good',category:'Other Items',photo:'file:///selected.jpg',photoLink:'land',negotiable:false,businessName:'',meetup:true,pickup:false,province:'National Capital District',propertyType:'Rooms',purpose:'For rent',period:'Per month',bedrooms:'',size:''};
 for(const key of Object.keys(draft)) draft['set'+key[0].toUpperCase()+key.slice(1)]=v=>draft[key]=v;
 const react={createElement:(type,props,...children)=>({type,props:props||{},children})};
 const picker={requestCameraPermissionsAsync:async()=>{calls.push('camera permission');return{granted};},requestMediaLibraryPermissionsAsync:async()=>{calls.push('library permission');return{granted};},launchCameraAsync:async()=>{calls.push('camera');return{canceled,assets:[{uri:'file:///camera.jpg'}]};},launchImageLibraryAsync:async()=>{calls.push('library');return{canceled,assets:[{uri:'file:///library.jpg'}]};}};
 const screen=load('src/screens/SellerScreen.tsx',{'react':react,'react-native':{Alert:{alert:(...a)=>alerts.push(a)},Image:'Image',Pressable:'Pressable',Text:'Text',TextInput:'TextInput',View:'View',Linking:{}},'../services/photos':{persistPhoto:async uri=>'file:///durable/'+uri.split('/').at(-1)},'expo-image-picker':picker,'../state/MarketplaceProvider':{useMarketplace:()=>({sellerDraft:draft,products:[],profile:{name:'Demo Seller'},isOwnProduct:()=>false})},'../components/ProvinceField':{ProvinceField:'ProvinceField'},'../components/ChoiceField':{ChoiceField:'ChoiceField'},'../data/categories':{marketplaceCategories:[],propertyTypes:[],purposesFor:()=>[]},'../theme/marketplace':{ui:{}},'../components/Icon':{Icon:'Icon'},'../components/Button':{Button:'Button'}});
 function find(predicate,node=screen.SellerScreen()){if(!node||typeof node!=='object')return;if(predicate(node))return node;for(const child of (Array.isArray(node)?node:node.children||[])){const match=find(predicate,child);if(match)return match;}}
 return {draft,calls,alerts,find};
}
test('camera capture requests permission only on tap and stores a durable photo',async()=>{
 const h=photoHarness();assert.equal(h.calls.length,0);await h.find(n=>n.props?.accessibilityLabel==='Take a listing photo').props.onPress();assert.equal(h.calls.join(','),'camera permission,camera');assert.equal(h.draft.photo,'file:///durable/camera.jpg');
});
test('denied camera access and canceling the camera preserve the selected photo',async()=>{
 for(const [granted,canceled] of [[false,false],[true,true]]){const h=photoHarness(granted,canceled);await h.find(n=>n.props?.accessibilityLabel==='Take a listing photo').props.onPress();assert.equal(h.draft.photo,'file:///selected.jpg');if(!granted){assert.equal(h.calls.length,1);assert.equal(h.alerts[0][0],'Camera access');}}
});
test('typing an image URL cannot replace a selected photo until explicitly applied',()=>{
 const h=photoHarness();h.find(n=>n.props?.accessibilityLabel==='Photo URL').props.onChangeText('land');assert.equal(h.draft.photo,'file:///selected.jpg');h.find(n=>n.children?.some(c=>c?.children?.includes('Use image link'))).props.onPress();assert.equal(h.draft.photo,'file:///selected.jpg');assert.equal(h.alerts[0][0],'Image link');
});
test('unread indicators belong to recipient and clear only after opening that conversation',()=>{
 const p=provider({loadMarketplace:async()=>null,saveMarketplace:async()=>{}});
 let s=p.render();s.switchProfile('demo-buyer');s=p.render();s.openChat(product);s=p.render();const id=s.conversationId;s.sendMessage(id,'Hello');s=p.render();
 assert.equal(s.unreadCount('demo-seller'),1);assert.equal(s.unreadCount('demo-buyer'),0);
 s.switchProfile('demo-seller');s=p.render();assert.equal(s.unreadCount('demo-seller'),1);s.setTab('Chats');s=p.render();assert.equal(s.unreadCount('demo-seller'),1);
 s.openConversation(id);s=p.render();assert.equal(s.unreadCount('demo-seller'),0);s.sendMessage(id,'Yes, available');s=p.render();assert.equal(s.unreadCount('demo-buyer'),1);assert.equal(s.unreadCount('demo-seller'),0);
 s.switchProfile('demo-buyer');s=p.render();s.openChat(product);s=p.render();assert.equal(s.unreadCount('demo-buyer'),0);
});
test('read positions persist through a restart without clearing the other profile unread count',async()=>{
 let saved;const p=provider({loadMarketplace:async()=>null,saveMarketplace:async data=>{saved=data;}});
 p.render();await p.flush();let s=p.render();s.switchProfile('demo-buyer');s=p.render();s.openChat(product);s=p.render();s.sendMessage(s.conversationId,'First');s.sendMessage(s.conversationId,'Second');s=p.render();await p.flush();
 const next=provider({loadMarketplace:async()=>saved,saveMarketplace:async data=>{saved=data;}});next.render();await next.flush();s=next.render();assert.equal(s.unreadCount('demo-seller'),2);s.switchProfile('demo-seller');s=next.render();s.openConversation(s.visibleChats[0].id);s=next.render();await next.flush();assert.equal(s.unreadCount('demo-seller'),0);
 const again=provider({loadMarketplace:async()=>saved,saveMarketplace:async()=>{}});again.render();await again.flush();s=again.render();assert.equal(s.unreadCount('demo-seller'),0);
});
test('buyer suggestions match property or item context and include offers only for negotiable items',()=>{
 const {suggestedBuyerMessages,unreadMessages}=load('src/data/demoProfiles.ts');
 assert.ok(suggestedBuyerMessages({...product,negotiable:true}).includes('Is the price negotiable?'));
 assert.ok(!suggestedBuyerMessages({...product,negotiable:false}).includes('Is the price negotiable?'));
 assert.ok(suggestedBuyerMessages({...product,property:{type:'Rooms'}}).some(text=>text.includes('viewing')));
 assert.equal(unreadMessages({product,messages:[{text:'legacy'}]},'demo-seller'),1);assert.equal(unreadMessages({product,messages:[{text:'legacy'}]},'demo-buyer'),0);
});
