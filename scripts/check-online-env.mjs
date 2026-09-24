const {VITE_SUPABASE_URL:url,VITE_SUPABASE_PUBLISHABLE_KEY:key,VITE_LOCAL_ONLY:local}=process.env;
if(!url||!key||local==='true')throw new Error('Set the Supabase URL and public publishable key; disable local-only mode before deployment.');
const parsed=new URL(url);
if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.supabase.co'))throw new Error('Use the HTTPS URL of your Supabase project.');
if(key.startsWith('sb_secret_'))throw new Error('Never put a secret key in the frontend. Use the publishable key.');
if(!key.startsWith('sb_publishable_')){
 let payload;try{payload=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));}catch{throw new Error('Invalid public key.');}
 if(payload.role!=='anon')throw new Error('Only an anon/public key may be bundled.');
}
