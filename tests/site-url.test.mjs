import assert from "node:assert/strict";
import test from "node:test";
import { getAbsoluteUrl, getSiteUrl } from "../lib/site-url.ts";

test("uses localhost when NEXT_PUBLIC_SITE_URL is not configured",()=>{
  const previous=process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  try{assert.equal(getSiteUrl(),"http://localhost:3000")}finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_SITE_URL;else process.env.NEXT_PUBLIC_SITE_URL=previous}
});

test("normalizes the configured production origin",()=>{
  const previous=process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL="https://dream-smile-puce.vercel.app/ignored/path";
  try{
    assert.equal(getSiteUrl(),"https://dream-smile-puce.vercel.app");
    assert.equal(getAbsoluteUrl("/doctor"),"https://dream-smile-puce.vercel.app/doctor");
  }finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_SITE_URL;else process.env.NEXT_PUBLIC_SITE_URL=previous}
});

test("rejects unsafe protocols",()=>{
  const previous=process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL="javascript:alert(1)";
  try{assert.throws(()=>getSiteUrl(),/valid http\(s\) origin/)}finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_SITE_URL;else process.env.NEXT_PUBLIC_SITE_URL=previous}
});
