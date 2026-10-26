import * as SecureStore from 'expo-secure-store';
// Separate bounded chunks prevent native size limits from silently truncating
// sessions. Commit the generation pointer only after every chunk is written.
export function makeProtectedStorage(store: { getItemAsync(key: string): Promise<string | null>; setItemAsync(key: string, value: string): Promise<void>; deleteItemAsync(key: string): Promise<void> }) {
 let pending: Promise<unknown> = Promise.resolve();
 const serial = <T,>(task: () => Promise<T>): Promise<T> => {
  const next = pending.then(task); pending = next.catch(() => {}); return next;
 };
 const manifest = async (key: string) => {
  const raw = await store.getItemAsync(key);
  if (!raw) return null;
  const value = JSON.parse(raw) as { generation: string; count: number };
  if (!/^[a-z0-9-]+$/.test(value.generation) || !Number.isInteger(value.count) || value.count < 1 || value.count > 1000) throw new Error('Invalid protected session');
  return value;
 };
 const removeChunks = async (key: string, value: { generation: string; count: number } | null) => {
  if (value) for (let i=0;i<value.count;i++) await store.deleteItemAsync(`${key}.${value.generation}.${i}`);
 };
 return {
  getItem: (key: string) => serial(async () => {
   const value = await manifest(key); if (!value) return null;
   let result=''; for(let i=0;i<value.count;i++) { const part=await store.getItemAsync(`${key}.${value.generation}.${i}`); if(part===null) throw new Error('Incomplete protected session'); result+=part; } return result;
  }),
  setItem: (key: string, text: string) => serial(async () => {
   const points=Array.from(text); if(points.length>400000) throw new Error('Session too large');
   const old=await manifest(key), generation=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
   const count=Math.max(1,Math.ceil(points.length/400)); const next={generation,count};
   try { for(let i=0;i<count;i++) await store.setItemAsync(`${key}.${generation}.${i}`,points.slice(i*400,(i+1)*400).join('')); await store.setItemAsync(key,JSON.stringify(next)); }
   catch(error) { await removeChunks(key,next).catch(()=>{}); throw error; }
   // Failure cleaning an obsolete generation must not roll back a committed session.
   await removeChunks(key,old).catch(()=>{});
  }),
  removeItem: (key: string) => serial(async () => { const old=await manifest(key); await store.deleteItemAsync(key); await removeChunks(key,old); }),
 };
}
export const protectedSessionStorage = makeProtectedStorage({
 getItemAsync: key=>SecureStore.getItemAsync(key),
 setItemAsync: (key,value)=>SecureStore.setItemAsync(key,value,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY}),
 deleteItemAsync: key=>SecureStore.deleteItemAsync(key),
});
