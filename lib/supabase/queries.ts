import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingSlot } from "@/types";
import type { Database } from "@/types/database";

function toMinutes(value:string){const [hours,minutes]=value.slice(0,5).split(":").map(Number);return hours*60+minutes}
function toTime(value:number){return `${String(Math.floor(value/60)).padStart(2,"0")}:${String(value%60).padStart(2,"0")}`}

export async function getAvailableSlots(supabase:SupabaseClient<Database>,serviceId:string,doctorId:string|undefined,date:string):Promise<BookingSlot[]>{
  const { data:service }=await supabase.from("services").select("duration_minutes").eq("id",serviceId).eq("active",true).maybeSingle();
  if(!service?.duration_minutes) return [];

  let availabilityQuery=supabase.from("availability").select("doctor_id,start_time,end_time").eq("date",date).eq("available",true);
  if(doctorId) availabilityQuery=availabilityQuery.eq("doctor_id",doctorId);
  const { data:periods,error }=await availabilityQuery;
  if(error||!periods?.length) return [];

  const doctorIds=[...new Set(periods.map(period=>period.doctor_id))];
  const { data:appointments }=await supabase.from("appointments").select("doctor_id,appointment_time").eq("appointment_date",date).in("doctor_id",doctorIds);
  const occupied=new Set((appointments??[]).map(item=>`${item.doctor_id}:${item.appointment_time.slice(0,5)}`));
  const slots:BookingSlot[]=[];
  for(const period of periods){
    for(let cursor=toMinutes(period.start_time);cursor+service.duration_minutes<=toMinutes(period.end_time);cursor+=service.duration_minutes){
      const time=toTime(cursor);
      if(!occupied.has(`${period.doctor_id}:${time}`)) slots.push({time,doctorId:period.doctor_id});
    }
  }
  const unique=new Map<string,BookingSlot>();
  for(const slot of slots.sort((a,b)=>a.time.localeCompare(b.time))) if(!unique.has(slot.time)) unique.set(slot.time,slot);
  return [...unique.values()];
}
