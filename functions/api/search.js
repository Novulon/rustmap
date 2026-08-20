export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const query = url.searchParams.get('q');

  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing search query' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const cleanedQuery = query.replace(/[|]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const searchTerms = cleanedQuery.split(' ').filter(term => term.length > 1);

  async function fetchFromBM(targetUrl) {
    // Method 1: Direct fetch
    try {
      const res = await fetch(targetUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.data) return json.data;
      }
    } catch (e) {}

    // Method 2: AllOrigins Proxy
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=` + encodeURIComponent(targetUrl);
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const text = await res.text();
        const json = JSON.parse(text);
        if (json && json.data) return json.data;
      }
    } catch (e) {}

    // Method 3: CorsProxy.io
    try {
      const proxyUrl = `https://corsproxy.io/?` + encodeURIComponent(targetUrl);
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const json = await res.json();
        if (json && json.data) return json.data;
      }
    } catch (e) {}

    return null;
  }

  let servers = null;

  // Try standard BattleMetrics search first
  const searchUrl = `https://api.battlemetrics.com/servers?filter[game]=rust&filter[search]=${encodeURIComponent(query)}&page[size]=25`;
  servers = await fetchFromBM(searchUrl);

  // If standard search returns nothing, fetch active Rust servers and match keywords locally
  if (!servers || servers.length === 0) {
    const generalUrl = `https://api.battlemetrics.com/servers?filter[game]=rust&page[size]=100`;
    const allServers = await fetchFromBM(generalUrl);
    
    if (allServers && allServers.length > 0) {
      servers = allServers.filter(server => {
        const name = (server.attributes && server.attributes.name) ? server.attributes.name.toLowerCase() : '';
        // Match if any significant keyword (like 'hapis' or 'monthly') is present in the server name
        return searchTerms.some(term => name.includes(term));
      });
    }
  }

  if (servers && servers.length > 0) {
    return new Response(JSON.stringify({ data: servers }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  return new Response(JSON.stringify({ data: [], error: 'No Rust servers found matching query.' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}