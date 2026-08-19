import "server-only";

export const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const DATE_PATTERN=/^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN=/^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function isUuid(value:unknown):value is string{return typeof value==="string"&&UUID_PATTERN.test(value)}
export function isIsoDate(value:unknown):value is string{
  if(typeof value!=="string"||!DATE_PATTERN.test(value))return false;
  const date=new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function isTime(value:unknown):value is string{return typeof value==="string"&&TIME_PATTERN.test(value)}
export function isTrimmedText(value:unknown,min:number,max:number):value is string{
  if(typeof value!=="string")return false;const length=value.trim().length;return length>=min&&length<=max;
}
export function isOptionalText(value:unknown,max:number){return value===undefined||value===null||typeof value==="string"&&value.trim().length<=max}

export function mutationOriginError(request:Request){
  const length=Number(request.headers.get("content-length")??0);
  if(Number.isFinite(length)&&length>32_768)return Response.json({error:"Слишком большой запрос."},{status:413});
  const origin=request.headers.get("origin");
  if(!origin)return null;
  const forwardedHost=request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host=forwardedHost||request.headers.get("host");
  try{if(host&&new URL(origin).host===host)return null}catch{/* Invalid origins are rejected below. */}
  return Response.json({error:"Недопустимый источник запроса."},{status:403});
}

export function requestBodySizeError(request:Request){
  const length=Number(request.headers.get("content-length")??0);
  return Number.isFinite(length)&&length>32_768?Response.json({error:"Слишком большой запрос."},{status:413}):null;
}

export function safeServerError(scope:string,error:unknown){
  const code=typeof error==="object"&&error!==null&&"code" in error&&typeof error.code==="string"?error.code:"unknown";
  console.error(`[${scope}] request failed`,{code});
}

type LimitBucket={count:number;resetAt:number};
const buckets=new Map<string,LimitBucket>();
export function checkPublicWriteRateLimit(request:Request,limit=8,windowMs=10*60_000){
  const now=Date.now();
  if(buckets.size>5000)for(const[key,value]of buckets)if(value.resetAt<=now)buckets.delete(key);
  const forwarded=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key=request.headers.get("x-real-ip")||forwarded||"unknown";
  const current=buckets.get(key);
  if(!current||current.resetAt<=now){buckets.set(key,{count:1,resetAt:now+windowMs});return null}
  current.count+=1;
  if(current.count<=limit)return null;
  return Response.json({error:"Слишком много попыток. Попробуйте немного позже."},{status:429,headers:{"Retry-After":String(Math.max(1,Math.ceil((current.resetAt-now)/1000)))}});
}
