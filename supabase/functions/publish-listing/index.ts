import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import jpeg from 'npm:jpeg-js@0.4.4';
const headers = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info', 'Content-Type':'application/json' };
const reply=(status:number,error:string)=>new Response(JSON.stringify({error}),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers});
 if(req.method!=='POST') return reply(405,'Use POST');
 const bearer=req.headers.get('Authorization') || '';
 if(!bearer.startsWith('Bearer ')) return reply(401,'Sign in to publish.');
 const url=Deno.env.get('SUPABASE_URL')!;
 const userClient=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:bearer}},auth:{persistSession:false}});
 const {data:{user},error:authError}=await userClient.auth.getUser();
 if(authError || !user || user.is_anonymous || !user.email_confirmed_at) return reply(401,'A verified account is required.');
 const {data:profile,error:sessionError}=await userClient.from('saved_listings').select('listing_id').limit(1);
 // Writes still enforce current session through database RLS. No user metadata
 // is used for roles or ownership. Service access is confined to validated files.
 void profile;
 if(sessionError) return reply(401,'Your session could not be verified.');
 const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 let imagePath:string|undefined;
 try {
  const length=Number(req.headers.get('content-length')||0); if(length>6*1024*1024) return reply(413,'Photo is too large.');
  const form=await req.formData(); const photo=form.get('photo');
  if(!(photo instanceof File) || photo.size>5*1024*1024 || photo.size<4) return reply(400,'Choose a JPEG photo under 5 MB.');
  let fields;try {fields=JSON.parse(String(form.get('listing')));} catch {return reply(400,'Invalid listing details.');}
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fields.id||'')) return reply(400,'Invalid request ID.');
  const {data:existing}=await userClient.from('listings').select('id,owner_id').eq('id',fields.id).maybeSingle();
  if(existing?.owner_id===user.id) return new Response(JSON.stringify({id:existing.id}),{headers});
  const {count}=await admin.from('listing_assets').select('path',{count:'exact',head:true}).eq('owner_id',user.id).gte('created_at',new Date(Date.now()-86400000).toISOString());
  if(count===null || count>=30) return reply(429,'Daily photo limit reached. Try again tomorrow.');
  const bytes=new Uint8Array(await photo.arrayBuffer());
  if(bytes[0]!==255 || bytes[1]!==216) return reply(400,'Choose a valid JPEG photo.');
  const decoded=jpeg.decode(bytes,{useTArray:true,maxResolutionInMP:8,maxMemoryUsageInMB:96});
  // Re-encode pixels only: EXIF/location metadata and comments are not published.
  const clean=jpeg.encode({data:decoded.data,width:decoded.width,height:decoded.height},70).data;
  if(clean.length>1048576) return reply(400,'Photo is too detailed. Choose a smaller image.');
  imagePath=`${user.id}/${fields.id}-${crypto.randomUUID()}.jpg`;
  const upload=await admin.storage.from('market-listing-images').upload(imagePath,clean,{contentType:'image/jpeg',upsert:false});
  if(upload.error) throw Error('Photo could not be saved.');
  const asset=await admin.from('listing_assets').insert({path:imagePath,owner_id:user.id});if(asset.error) throw Error('Photo record could not be saved.');
  // Explicit allowlist: caller cannot inject owner, status, timestamps or roles.
  const listing={id:fields.id,owner_id:user.id,image_path:imagePath,title:fields.title,description:fields.description,price:fields.price,category:fields.category,condition:fields.condition??null,province:fields.province,area:fields.area,negotiable:fields.negotiable===true,handovers:fields.handovers,property_type:fields.property_type??null,purpose:fields.purpose??null,price_period:fields.price_period||'Total',bedrooms:fields.bedrooms??null,size_sqm:fields.size_sqm??null};
  const result=await userClient.from('listings').insert(listing).select('id').single();
  if(result.error) {
   // Retry of the same request may have won concurrently.
   const retry=await userClient.from('listings').select('id,owner_id').eq('id',fields.id).maybeSingle();
   if(retry.data?.owner_id===user.id){await admin.storage.from('market-listing-images').remove([imagePath]);await admin.from('listing_assets').delete().eq('path',imagePath);return new Response(JSON.stringify({id:retry.data.id}),{headers});}
   throw Error('Listing could not be published. Check its details and your verified session.');
  }
  return new Response(JSON.stringify(result.data),{headers});
 } catch(error) {
  if(imagePath){await admin.storage.from('market-listing-images').remove([imagePath]);await admin.from('listing_assets').delete().eq('path',imagePath);}
  return reply(400,error instanceof Error && /could not/.test(error.message)?error.message:'Could not process this photo or listing.');
 }
});
