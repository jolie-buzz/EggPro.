import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createApp,initialize} from '../../server/app.mjs';
const pg=new PGlite();
let tail=Promise.resolve();
async function connect(){let release;const wait=tail;tail=new Promise(r=>release=r);await wait;return {query:(...args)=>pg.query(...args),release};}
const db={connect,async query(...args){const c=await connect();try{return await c.query(...args);}finally{c.release();}}};
// PGlite exposes exec for SQL migration batches.
const originalConnect=db.connect;
db.connect=async()=>{const c=await originalConnect();return {...c,query:(sql,params)=>sql.includes('CREATE SCHEMA')?pg.exec(sql):c.query(sql,params)};};
await initialize(db);
const app=createApp(db,{allowedOrigins:['https://localhost']});
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base=`http://127.0.0.1:${server.address().port}`;
async function request(path,{method='GET',body,token,headers={}}={}){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} :{}),...headers},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json(),headers:r.headers};}
after(async()=>{await new Promise(r=>server.close(r));await pg.close();});
let owner,other,recovery;
test('creates hashed credentials and session; authenticated owner isolation',async()=>{
 const a=await request('/api/auth/signup',{method:'POST',body:{email:'owner@example.test',password:'qa-long-password'}});
 assert.equal(a.status,201);owner=a.body.session.access_token;recovery=a.body.recoveryCode;assert.equal(recovery.length,32);
 const b=await request('/api/auth/signup',{method:'POST',body:{email:'other@example.test',password:'qa-long-password'}});other=b.body.session.access_token;
 const row=(await db.query('SELECT password_hash,recovery_hash FROM eggpro.users WHERE email=$1',['owner@example.test'])).rows[0];assert.notEqual(row.password_hash,'qa-long-password');assert.notEqual(row.recovery_hash,recovery);
 assert.equal((await request('/api/farm')).status,401);
 assert.equal((await request('/api/farm',{token:other})).body,null);
 const login=await request('/api/auth/login',{method:'POST',body:{email:'owner@example.test',password:'wrong-password'}});assert.equal(login.status,401);
 assert.equal((await request('/api/auth/login',{method:'POST',body:{email:'owner@example.test',password:'qa-long-password'}})).status,200);
});
test('atomic farm save, owner scoping, idempotency, conflict and validation',async()=>{
 const mutationId=randomUUID(),document={format:'FarmTrack',version:1,schemaVersion:2,data:{farms:[{id:'qa-farm'}]}};
 const saved=await request('/api/farm',{method:'PUT',token:owner,body:{revision:0,mutationId,document}});assert.equal(saved.status,200);assert.equal(saved.body.revision,1);
 assert.equal((await request('/api/farm',{token:other})).body,null);
 const replay=await request('/api/farm',{method:'PUT',token:owner,body:{revision:0,mutationId,document}});assert.equal(replay.body.revision,1);
 assert.equal((await request('/api/farm',{method:'PUT',token:owner,body:{revision:0,mutationId:randomUUID(),document}})).status,409);
 assert.equal((await request('/api/farm',{method:'PUT',token:owner,body:{revision:1,mutationId:randomUUID(),document:{}}})).status,400);
 const results=await Promise.all([1,2].map(()=>request('/api/farm',{method:'PUT',token:owner,body:{revision:1,mutationId:randomUUID(),document}})));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const read=await request('/api/farm',{token:owner});assert.equal(read.body.revision,2);assert.equal(read.headers.get('cache-control'),'no-store');
});
test('recovery rotates key, revokes old sessions, and leaves farm intact',async()=>{
 const restored=await request('/api/auth/recover',{method:'POST',body:{email:'owner@example.test',password:'new-long-password',recoveryCode:recovery}});assert.equal(restored.status,200);assert.notEqual(restored.body.recoveryCode,recovery);
 assert.equal((await request('/api/farm',{token:owner})).status,401);
 owner=restored.body.session.access_token;assert.equal((await request('/api/farm',{token:owner})).body.revision,2);
 assert.equal((await request('/api/auth/recover',{method:'POST',body:{email:'owner@example.test',password:'new-long-password',recoveryCode:recovery}})).status,401);
 await request('/api/auth/logout',{method:'POST',body:{},token:owner});assert.equal((await request('/api/farm',{token:owner})).status,401);
});
test('API unknown endpoints do not return app shell; native origins are narrowly allowed',async()=>{
 assert.equal((await request('/api/not-real')).status,404);
 assert.equal((await request('/api/health',{headers:{Origin:'https://localhost'}})).headers.get('access-control-allow-origin'),'https://localhost');
 assert.equal((await request('/api/health',{headers:{Origin:'https://evil.example'}})).headers.get('access-control-allow-origin'),null);
});
test('expired sessions cannot read cloud records; repeated login attempts are limited',async()=>{
 await db.query("UPDATE eggpro.sessions SET expires_at=now()-interval '1 minute' WHERE user_id IN (SELECT id FROM eggpro.users WHERE email=$1)",['other@example.test']);
 assert.equal((await request('/api/farm',{token:other})).status,401);
 let limited=false;
 for(let i=0;i<22;i++){
  const r=await request('/api/auth/login',{method:'POST',body:{email:'nobody@example.test',password:'wrong-password'}});
  if(r.status===429){limited=true;break;}
 }
 assert.equal(limited,true);
});
