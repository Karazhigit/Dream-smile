"use client";
import { useEffect, useRef, useState } from "react";

const revealCallbacks=new Map<Element,()=>void>();
let revealObserver:IntersectionObserver|null=null;
function getRevealObserver(){
  if(!revealObserver)revealObserver=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;revealCallbacks.get(entry.target)?.();revealCallbacks.delete(entry.target);revealObserver?.unobserve(entry.target)}},{rootMargin:"0px 0px -8%",threshold:.08});
  return revealObserver;
}

export function FadeInSection({id,className="",children}:{id?:string;className?:string;children:React.ReactNode}){
  const ref=useRef<HTMLElement>(null);const[revealed,setRevealed]=useState(false);
  useEffect(()=>{const element=ref.current;if(!element)return;if(!window.IntersectionObserver){queueMicrotask(()=>setRevealed(true));return}const observer=getRevealObserver();revealCallbacks.set(element,()=>setRevealed(true));observer.observe(element);return()=>{revealCallbacks.delete(element);observer.unobserve(element)}},[]);
  return <section ref={ref} id={id} data-revealed={revealed} className={`motion-reveal ${className}`}>{children}</section>;
}

export function PageTransition({children,className=""}:{children:React.ReactNode;className?:string}){return <div className={`motion-page-enter ${className}`}>{children}</div>}
