const localSiteUrl="http://localhost:3000";

export function getSiteUrl(){
  const configured=process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if(!configured)return localSiteUrl;
  try{
    const url=new URL(configured);
    if(url.protocol!=="http:"&&url.protocol!=="https:")throw new Error("unsupported_protocol");
    return url.origin;
  }catch{
    throw new Error("NEXT_PUBLIC_SITE_URL must be a valid http(s) origin.");
  }
}

export function getAbsoluteUrl(path="/"){
  return new URL(path,getSiteUrl()).toString();
}
