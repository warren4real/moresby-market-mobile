// Operator-only recovery for an already-requested deletion. Never ship this in the app.
import {createClient} from '@supabase/supabase-js';
const target=process.argv[2];
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target||''))throw Error('Pass the verified pending account UUID.');
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('Set server-only SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the operator environment.');
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const bucket=admin.storage.from('market-listing-images');
if(!process.argv.includes('--confirm-delete')){
 const list=await bucket.list(target,{limit:100});if(list.error)throw Error('Could not inspect photos.');
 console.log('Inspection only:',list.data.length,'photo entries in first batch. Confirm the UUID is in the private pending-deletion queue before using --confirm-delete.');
 process.exit(0);
}
const begin=await admin.rpc('begin_account_deletion',{target});if(begin.error)throw Error('Could not hide the account and revoke sessions.');
async function purge(){for(let i=0;i<100;i++){
 const listed=await bucket.list(target,{limit:100,offset:0});if(listed.error)throw Error('Photo listing failed. Retry cleanup.');
 if(!listed.data.length)return;
 const removed=await bucket.remove(listed.data.map(file=>`${target}/${file.name}`));if(removed.error)throw Error('Photo removal failed. Retry cleanup.');
}throw Error('More photos remain. Retry cleanup.');}
await purge();
const user=await admin.auth.admin.getUserById(target);
if(user.error&&user.error.status!==404)throw Error('Could not check account state.');
if(user.data.user){const result=await admin.auth.admin.deleteUser(target,false);if(result.error)throw Error('Auth cleanup failed. Retry cleanup.');}
await purge();
const finished=await admin.rpc('finish_account_deletion',{target});if(finished.error)throw Error('Could not record completion. Retry cleanup.');
console.log('Deletion cleanup completed.');
