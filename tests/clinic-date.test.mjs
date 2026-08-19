import test from "node:test";
import assert from "node:assert/strict";
import { archiveCutoffDate, clinicToday, clinicTomorrow, isArchivedAppointment } from "../lib/clinic-date.ts";

test("23:30 in Asia/Almaty",()=>{const now=new Date("2026-08-18T18:30:00Z");assert.equal(clinicToday(now),"2026-08-18");assert.equal(clinicTomorrow(now),"2026-08-19")});
test("00:10 in Asia/Almaty",()=>{const now=new Date("2026-08-18T19:10:00Z");assert.equal(clinicToday(now),"2026-08-19");assert.equal(clinicTomorrow(now),"2026-08-20")});
test("month boundary",()=>{const now=new Date("2026-01-31T18:30:00Z");assert.equal(clinicToday(now),"2026-01-31");assert.equal(clinicTomorrow(now),"2026-02-01")});
test("year boundary",()=>{const now=new Date("2026-12-31T18:30:00Z");assert.equal(clinicToday(now),"2026-12-31");assert.equal(clinicTomorrow(now),"2027-01-01")});
test("archive cutoff uses the Almaty calendar date",()=>{const now=new Date("2026-08-18T19:10:00Z");assert.equal(archiveCutoffDate(now),"2026-07-20")});
test("completed appointment from 10 days ago is not archived",()=>{const now=new Date("2026-08-19T06:00:00Z");assert.equal(isArchivedAppointment("completed","2026-08-09",now),false)});
test("completed appointment from 40 days ago is archived",()=>{const now=new Date("2026-08-19T06:00:00Z");assert.equal(isArchivedAppointment("completed","2026-07-10",now),true)});
test("cancelled appointment from 60 days ago is archived",()=>{const now=new Date("2026-08-19T06:00:00Z");assert.equal(isArchivedAppointment("cancelled","2026-06-20",now),true)});
test("confirmed appointment is never archived",()=>{const now=new Date("2026-08-19T06:00:00Z");assert.equal(isArchivedAppointment("confirmed","2026-06-20",now),false)});
