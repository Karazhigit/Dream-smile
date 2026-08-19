import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync,readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root=new URL("..",import.meta.url);
const read=path=>readFileSync(new URL(path,root),"utf8");

test("production schema contains no demo policy creation",()=>{
  const schema=read("supabase/schema.sql");
  assert.doesNotMatch(schema,/create policy\s+"demo admin/i);
  assert.match(schema,/public reads active doctors[\s\S]*for select to anon\b/);
});

test("public booking writes only through the server-side RPC",()=>{
  const route=read("app/api/appointments/route.ts");
  const finalize=read("supabase/security-hardening-finalize.sql");
  assert.match(route,/createSupabaseAdminClient/);
  assert.match(route,/\.rpc\("create_public_appointment"/);
  assert.doesNotMatch(route,/\.from\("appointments"\)\.insert/);
  assert.match(finalize,/revoke all on function public\.create_public_appointment[\s\S]*from public, anon, authenticated/);
  assert.match(finalize,/grant execute[\s\S]*to service_role/);
});

test("hardening migrations reference only production functions",()=>{
  const hardening=read("supabase/security-hardening.sql");
  const finalize=read("supabase/security-hardening-finalize.sql");
  const combined=`${hardening}\n${finalize}`;
  const actualFunctions=new Set([
    "claim_notification_jobs",
    "complete_doctor_appointment",
    "create_admin_appointment",
    "create_public_appointment",
    "get_blocking_appointments",
    "reschedule_admin_appointment",
  ]);
  const referenced=[...combined.matchAll(/(?:revoke all on|grant execute on) function public\.([a-z_]+)\(/gi)].map(match=>match[1]);
  assert.ok(referenced.length>0);
  for(const name of referenced)assert.ok(actualFunctions.has(name),`Unknown production function: ${name}`);
  assert.doesNotMatch(combined,/get_occupied_appointment_slots/);
});

test("every admin API route performs server-side admin authorization",()=>{
  const base=fileURLToPath(new URL("app/api/admin/",root));
  const files=[];
  const walk=directory=>readdirSync(directory,{withFileTypes:true}).forEach(entry=>entry.isDirectory()?walk(join(directory,entry.name)):entry.name==="route.ts"&&files.push(join(directory,entry.name)));
  walk(base);
  assert.ok(files.length>0);
  for(const file of files)assert.match(readFileSync(file,"utf8"),/requireAdminApi\(/,file);
});

test("doctor access is derived from auth.uid and scoped to own doctor id",()=>{
  const rls=read("supabase/security-hardening.sql");
  const route=read("app/api/doctor/appointments/route.ts");
  assert.match(rls,/account\.user_id = auth\.uid\(\).*account\.doctor_id = appointments\.doctor_id/);
  assert.match(route,/\.eq\("doctor_id",doctor\.id\)/);
  assert.match(route,/complete_doctor_appointment/);
});
