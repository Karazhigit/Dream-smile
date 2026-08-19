import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingSlot } from "@/types";
import type { Database } from "@/types/database";

const CLINIC_TIME_ZONE="Asia/Almaty";
const SLOT_STEP_MINUTES=60;
const DEFAULT_DURATION_MINUTES=60;

type Period={start:number;end:number;breakStart:number|null;breakEnd:number|null};
type BlockingAppointment={doctor_id:string;appointment_date:string;appointment_time:string;duration_minutes:number};

function toMinutes(value:string){const[hours,minutes]=value.slice(0,5).split(":").map(Number);return hours*60+minutes}
function toTime(value:number){return `${String(Math.floor(value/60)).padStart(2,"0")}:${String(value%60).padStart(2,"0")}`}
function overlaps(startA:number,endA:number,startB:number,endB:number){return startA<endB&&endA>startB}
function dateValues(from:string,to:string){const values:string[]=[];for(let cursor=new Date(`${from}T00:00:00Z`),last=new Date(`${to}T00:00:00Z`);cursor<=last;cursor.setUTCDate(cursor.getUTCDate()+1))values.push(cursor.toISOString().slice(0,10));return values}
function weekday(value:string){return new Date(`${value}T00:00:00Z`).getUTCDay()}
function missingRelation(error:{code?:string}|null){return error?.code==="42P01"||error?.code==="PGRST205"}
function getClinicNow(){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:CLINIC_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
  const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return{date:`${values.year}-${values.month}-${values.day}`,minutes:Number(values.hour)*60+Number(values.minute)};
}
function mergeLegacyPeriods(periods:{start_time:string;end_time:string}[]):Period[]{
  const sorted=periods.map(row=>({start:toMinutes(row.start_time),end:toMinutes(row.end_time)})).sort((a,b)=>a.start-b.start);const merged:{start:number;end:number}[]=[];
  for(const item of sorted){const previous=merged.at(-1);if(previous&&item.start<=previous.end)previous.end=Math.max(previous.end,item.end);else merged.push({...item})}
  return merged.map(item=>({...item,breakStart:null,breakEnd:null}));
}

async function getBlockingAppointments(supabase:SupabaseClient<Database>,doctorIds:string[],from:string,to:string,excludeAppointmentId?:string):Promise<{data:BlockingAppointment[];error:unknown|null}>{
  if(excludeAppointmentId){
    const excluded=await supabase.from("appointments").select("doctor_id,appointment_date,appointment_time,service:services!appointments_service_id_fkey(duration_minutes)").in("status",["new","confirmed"]).gte("appointment_date",from).lte("appointment_date",to).in("doctor_id",doctorIds).neq("id",excludeAppointmentId);
    if(excluded.error)return{data:[],error:excluded.error};
    type JoinedBlocking={doctor_id:string;appointment_date:string;appointment_time:string;service:{duration_minutes:number|null}|null};
    return{data:((excluded.data??[]) as unknown as JoinedBlocking[]).map(row=>({doctor_id:row.doctor_id,appointment_date:row.appointment_date,appointment_time:row.appointment_time,duration_minutes:row.service?.duration_minutes??DEFAULT_DURATION_MINUTES})),error:null};
  }
  const current=await supabase.rpc("get_blocking_appointments",{p_doctor_ids:doctorIds,p_from:from,p_to:to});
  if(!current.error)return{data:current.data??[],error:null};
  if(current.error.code!=="PGRST202")return{data:[],error:current.error};

  const previous=await supabase.rpc("get_occupied_appointment_slots",{p_doctor_ids:doctorIds,p_from:from,p_to:to});
  if(!previous.error)return{data:(previous.data??[]).map(row=>({...row,duration_minutes:DEFAULT_DURATION_MINUTES})),error:null};
  if(previous.error.code!=="PGRST202")return{data:[],error:previous.error};

  const legacy=await supabase.from("appointments").select("doctor_id,appointment_date,appointment_time,service_id").in("status",["new","confirmed"]).gte("appointment_date",from).lte("appointment_date",to).in("doctor_id",doctorIds);
  if(legacy.error)return{data:[],error:legacy.error};
  const serviceIds=[...new Set((legacy.data??[]).map(row=>row.service_id))];
  const durations=serviceIds.length?await supabase.from("services").select("id,duration_minutes").in("id",serviceIds):{data:[],error:null};
  if(durations.error)return{data:[],error:durations.error};
  const durationMap=new Map((durations.data??[]).map(row=>[row.id,row.duration_minutes??DEFAULT_DURATION_MINUTES]));
  return{data:(legacy.data??[]).map(row=>({doctor_id:row.doctor_id,appointment_date:row.appointment_date,appointment_time:row.appointment_time,duration_minutes:durationMap.get(row.service_id)??DEFAULT_DURATION_MINUTES})),error:null};
}

export async function getAvailabilityRange(supabase:SupabaseClient<Database>,serviceId:string,doctorId:string|undefined,from:string,to:string,excludeAppointmentId?:string):Promise<Record<string,BookingSlot[]>>{
  let doctorsQuery=supabase.from("doctors").select("id").eq("active",true);if(doctorId)doctorsQuery=doctorsQuery.eq("id",doctorId);
  const[{data:service,error:serviceError},{data:doctors,error:doctorsError}]=await Promise.all([supabase.from("services").select("id,duration_minutes").eq("id",serviceId).eq("active",true).maybeSingle(),doctorsQuery]);
  if(serviceError||doctorsError){console.error("[availability] Catalog query failed",{serviceError,doctorsError});throw new Error("availability_catalog_query_failed")}
  if(!service||!doctors?.length)return{};
  const doctorIds=doctors.map(row=>row.id);const duration=Math.max(service.duration_minutes??DEFAULT_DURATION_MINUTES,1);

  const[schedulesResult,exceptionsResult,legacyResult,blockingResult]=await Promise.all([
    supabase.from("doctor_schedules").select("doctor_id,weekday,start_time,end_time,break_start,break_end,active").in("doctor_id",doctorIds),
    supabase.from("schedule_exceptions").select("doctor_id,date,type,start_time,end_time,break_start,break_end").gte("date",from).lte("date",to).in("doctor_id",doctorIds),
    supabase.from("availability").select("doctor_id,date,start_time,end_time").gte("date",from).lte("date",to).eq("available",true).in("doctor_id",doctorIds),
    getBlockingAppointments(supabase,doctorIds,from,to,excludeAppointmentId),
  ]);
  if(legacyResult.error||blockingResult.error){console.error("[availability] Slot source query failed",{availabilityError:legacyResult.error,appointmentsError:blockingResult.error});throw new Error("availability_slot_source_query_failed")}
  if(schedulesResult.error&&!missingRelation(schedulesResult.error)){console.error("[availability] Schedule query failed",schedulesResult.error);throw new Error("availability_schedule_query_failed")}
  if(exceptionsResult.error&&!missingRelation(exceptionsResult.error)){console.error("[availability] Exception query failed",exceptionsResult.error);throw new Error("availability_exception_query_failed")}

  const schedules=schedulesResult.error?[]:schedulesResult.data??[];const exceptions=exceptionsResult.error?[]:exceptionsResult.data??[];
  const scheduleDoctors=new Set(schedules.map(row=>row.doctor_id));
  const scheduleMap=new Map(schedules.map(row=>[`${row.doctor_id}:${row.weekday}`,row]));
  const exceptionMap=new Map(exceptions.map(row=>[`${row.doctor_id}:${row.date}`,row]));
  const legacyMap=new Map<string,{start_time:string;end_time:string}[]>();
  for(const row of legacyResult.data??[]){const key=`${row.doctor_id}:${row.date}`;const values=legacyMap.get(key)??[];values.push(row);legacyMap.set(key,values)}
  const occupiedMap=new Map<string,BlockingAppointment[]>();
  for(const row of blockingResult.data){const key=`${row.doctor_id}:${row.appointment_date}`;const values=occupiedMap.get(key)??[];values.push(row);occupiedMap.set(key,values)}

  const now=getClinicNow();const slotsByDate=new Map<string,Map<string,BookingSlot>>();
  for(const date of dateValues(from,to))for(const id of doctorIds){
    const key=`${id}:${date}`;const exception=exceptionMap.get(key);let periods:Period[]=[];
    if(exception){if(exception.type==="day_off")continue;if(exception.start_time&&exception.end_time)periods=[{start:toMinutes(exception.start_time),end:toMinutes(exception.end_time),breakStart:exception.break_start?toMinutes(exception.break_start):null,breakEnd:exception.break_end?toMinutes(exception.break_end):null}]}
    else if(scheduleDoctors.has(id)){const schedule=scheduleMap.get(`${id}:${weekday(date)}`);if(!schedule?.active||!schedule.start_time||!schedule.end_time)continue;periods=[{start:toMinutes(schedule.start_time),end:toMinutes(schedule.end_time),breakStart:schedule.break_start?toMinutes(schedule.break_start):null,breakEnd:schedule.break_end?toMinutes(schedule.break_end):null}]}
    else periods=mergeLegacyPeriods(legacyMap.get(key)??[]);
    if(!periods.length)continue;

    for(const period of periods)for(let cursor=period.start;cursor+duration<=period.end;cursor+=SLOT_STEP_MINUTES){
      const end=cursor+duration;if(period.breakStart!==null&&period.breakEnd!==null&&overlaps(cursor,end,period.breakStart,period.breakEnd))continue;
      if(date<now.date||(date===now.date&&cursor<=now.minutes))continue;
      const occupied=(occupiedMap.get(key)??[]).some(item=>overlaps(cursor,end,toMinutes(item.appointment_time),toMinutes(item.appointment_time)+Math.max(item.duration_minutes,1)));
      const time=toTime(cursor);const slot={time,doctorId:id,available:!occupied};const dateSlots=slotsByDate.get(date)??new Map<string,BookingSlot>();const current=dateSlots.get(time);
      if(!current||(!current.available&&slot.available))dateSlots.set(time,slot);slotsByDate.set(date,dateSlots);
    }
  }
  return Object.fromEntries([...slotsByDate].map(([date,slots])=>[date,[...slots.values()].sort((a,b)=>a.time.localeCompare(b.time))]));
}

export async function getAvailableSlots(supabase:SupabaseClient<Database>,serviceId:string,doctorId:string|undefined,date:string,excludeAppointmentId?:string):Promise<BookingSlot[]>{const result=await getAvailabilityRange(supabase,serviceId,doctorId,date,date,excludeAppointmentId);return result[date]??[]}
