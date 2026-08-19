import "server-only";

export function measureServerDuration(label:string,start:number){
  const durationMs=Date.now()-start;
  console.info(`[duration] ${label}`,{durationMs});
  return durationMs;
}
