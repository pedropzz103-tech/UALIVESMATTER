Deno.serve(async () => {
  const key = Deno.env.get("UKRAINE_ALARM_API_KEY");
  if (!key) return new Response(JSON.stringify({error:"Missing UKRAINE_ALARM_API_KEY"}), {status:500,headers:{"content-type":"application/json"}});
  const upstream = await fetch("https://api.ukrainealarm.com/api/v3/alerts", {
    headers: { "Authorization": key }
  });
  const body = await upstream.text();
  return new Response(body, {status:upstream.status, headers:{
    "content-type":"application/json",
    "access-control-allow-origin":"*",
    "cache-control":"public,max-age=20"
  }});
});
