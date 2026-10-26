const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const moduleUnderTest={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/sessionStorage.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:moduleUnderTest,exports:moduleUnderTest.exports,require:()=>({})});
function fixture(){const data=new Map();let fail='';const storage=moduleUnderTest.exports.makeProtectedStorage({getItemAsync:async k=>data.get(k)??null,setItemAsync:async(k,v)=>{if(k===fail)throw Error('locked');assert.ok(Buffer.byteLength(v)<=2000);data.set(k,v);},deleteItemAsync:async k=>{data.delete(k);}});return {data,storage,fail:k=>fail=k};}
test('large unicode sessions survive bounded secure-store chunks',async()=>{const {data,storage}=fixture();const session='🦜'.repeat(10000);await storage.setItem('session',session);assert.equal(await storage.getItem('session'),session);assert.ok(data.size>2);});
test('failed manifest commit preserves previous usable session',async()=>{const f=fixture();await f.storage.setItem('session','old');f.fail('session');await assert.rejects(f.storage.setItem('session','new'));assert.equal(await f.storage.getItem('session'),'old');assert.equal(f.data.size,2);});
test('concurrent refreshes serialize and remove deletes all committed chunks',async()=>{const f=fixture();await Promise.all([f.storage.setItem('session','first'),f.storage.setItem('session','latest')]);assert.equal(await f.storage.getItem('session'),'latest');await f.storage.removeItem('session');assert.equal(await f.storage.getItem('session'),null);assert.equal(f.data.size,0);});
test('missing chunks fail closed instead of returning a truncated token',async()=>{const f=fixture();await f.storage.setItem('session','token');const manifest=JSON.parse(f.data.get('session'));f.data.delete(`session.${manifest.generation}.0`);await assert.rejects(f.storage.getItem('session'));});
