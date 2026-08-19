import type { BookingSlot, Doctor, Service } from "@/types";

type Catalog={services:Service[];doctors:Doctor[]};
type AvailabilityRange={availableDates:string[];slotsByDate:Record<string,BookingSlot[]>};
type CacheEntry<T>={value?:T;promise?:Promise<T>;expiresAt:number};

const catalogTtl=5*60_000;
const availabilityTtl=60_000;
const requestTimeout=12_000;
export const availabilityInvalidatedEvent="dream-smile:availability-invalidated";
const availabilityInvalidatedStorageKey="dream-smile-availability-version";
let catalogCache:CacheEntry<Catalog>|undefined;
const rangeCache=new Map<string,CacheEntry<AvailabilityRange>>();
const slotsCache=new Map<string,CacheEntry<BookingSlot[]>>();

function doctorKey(doctorId:string){return doctorId||"any"}
function rangeKey(serviceId:string,doctorId:string,from:string,to:string){return `${serviceId}:${doctorKey(doctorId)}:${from}:${to}`}
function slotsKey(serviceId:string,doctorId:string,date:string){return `${serviceId}:${doctorKey(doctorId)}:${date}`}
function fresh<T>(entry:CacheEntry<T>|undefined){return Boolean(entry&&entry.expiresAt>Date.now())}

async function fetchJson<T>(url:string,options?:RequestInit):Promise<T>{
  const controller=new AbortController();
  const timeoutId=window.setTimeout(()=>controller.abort(),requestTimeout);
  try{
    const response=await fetch(url,{...options,signal:controller.signal});
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error((body as {error?:string}).error||"Не удалось загрузить данные.");
    return body as T;
  }catch(error){
    if(error instanceof DOMException&&error.name==="AbortError")throw new Error("Сервер не ответил вовремя. Попробуйте ещё раз.");
    throw error;
  }finally{window.clearTimeout(timeoutId)}
}

export function getCatalog(options?:{force?:boolean}){
  if(!options?.force&&fresh(catalogCache)){if(catalogCache?.value)return Promise.resolve(catalogCache.value);if(catalogCache?.promise)return catalogCache.promise}
  const promise=fetchJson<Catalog>("/api/catalog",{cache:"no-store"}).then(value=>{catalogCache={value,expiresAt:Date.now()+catalogTtl};return value}).catch(error=>{catalogCache=undefined;throw error});
  catalogCache={promise,expiresAt:Date.now()+catalogTtl};return promise;
}

export function getAvailabilityRange(serviceId:string,doctorId:string,from:string,to:string,options?:{force?:boolean}){
  const key=rangeKey(serviceId,doctorId,from,to);const cached=rangeCache.get(key);
  if(!options?.force&&fresh(cached)){if(cached?.value)return Promise.resolve(cached.value);if(cached?.promise)return cached.promise}
  const params=new URLSearchParams({serviceId,from,to});if(doctorId)params.set("doctorId",doctorId);
  const promise=fetchJson<AvailabilityRange>(`/api/availability?${params}`,{cache:"no-store"}).then(value=>{const expiresAt=Date.now()+availabilityTtl;rangeCache.set(key,{value,expiresAt});for(const [date,slots] of Object.entries(value.slotsByDate))slotsCache.set(slotsKey(serviceId,doctorId,date),{value:slots,expiresAt});return value}).catch(error=>{rangeCache.delete(key);throw error});
  rangeCache.set(key,{promise,expiresAt:Date.now()+availabilityTtl});return promise;
}

export function getCachedSlots(serviceId:string,doctorId:string,date:string){const cached=slotsCache.get(slotsKey(serviceId,doctorId,date));return fresh(cached)?cached?.value:undefined}

export function getAvailabilitySlots(serviceId:string,doctorId:string,date:string){
  const key=slotsKey(serviceId,doctorId,date);const cached=slotsCache.get(key);
  if(fresh(cached)){if(cached?.value)return Promise.resolve(cached.value);if(cached?.promise)return cached.promise}
  const params=new URLSearchParams({serviceId,date});if(doctorId)params.set("doctorId",doctorId);
  const promise=fetchJson<{slots:BookingSlot[]}>(`/api/availability?${params}`,{cache:"no-store"}).then(body=>{const value=body.slots;slotsCache.set(key,{value,expiresAt:Date.now()+availabilityTtl});return value}).catch(error=>{slotsCache.delete(key);throw error});
  slotsCache.set(key,{promise,expiresAt:Date.now()+availabilityTtl});return promise;
}

export function invalidateAvailability(serviceId:string,doctorId:string,date:string){slotsCache.delete(slotsKey(serviceId,doctorId,date));for(const key of rangeCache.keys())if(key.startsWith(`${serviceId}:${doctorKey(doctorId)}:`))rangeCache.delete(key);notifyAvailabilityInvalidated()}
function clearLocalAvailabilityCache(){rangeCache.clear();slotsCache.clear()}
function notifyAvailabilityInvalidated(){if(typeof window==="undefined")return;window.dispatchEvent(new Event(availabilityInvalidatedEvent));try{window.localStorage.setItem(availabilityInvalidatedStorageKey,String(Date.now()))}catch{}}
export function clearAvailabilityCache(){clearLocalAvailabilityCache();notifyAvailabilityInvalidated()}

if(typeof window!=="undefined")window.addEventListener("storage",event=>{if(event.key!==availabilityInvalidatedStorageKey)return;clearLocalAvailabilityCache();window.dispatchEvent(new Event(availabilityInvalidatedEvent))});
