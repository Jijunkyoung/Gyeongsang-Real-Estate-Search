import {env} from 'cloudflare:workers';
import {seed} from './estate';
export function database(){if(!env.DB)throw new Error('저장소를 사용할 수 없습니다.');return env.DB;}
export async function allRecords(){const r=await database().prepare('SELECT payload FROM estate_records').all<{payload:string}>();const map=new Map(seed.map(x=>[x.id,x]));for(const x of r.results){const v=JSON.parse(x.payload);map.set(v.id,v);}return [...map.values()];}
export function owner(req:Request){const v=req.headers.get('oai-authenticated-user-email');if(!v)throw new Error('로그인이 필요합니다.');return v;}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new Error('요청 출처를 확인할 수 없습니다.');}
export function settings(){return env as unknown as Record<string,string>;}
