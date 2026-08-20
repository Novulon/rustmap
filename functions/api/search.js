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

  async function fetchFromBM(targetUrl) {
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
    return null;
  }

  let servers = null;

  // 1. Fetch general active Rust servers from BattleMetrics
  const generalUrl = `https://api.battlemetrics.com/servers?filter[game]=rust&page[size]=100`;
  const allServers = await fetchFromBM(generalUrl);
  
  if (allServers && allServers.length > 0) {
    // 2. Filter locally by matching any part of the query string or individual keywords
    const searchTerms = cleanedQuery.split(' ').filter(term => term.length > 0);
    
    servers = allServers.filter(server => {
      const name = (server.attributes && server.attributes.name) ? server.attributes.name.toLowerCase() : '';
      return searchTerms.every(term => name.includes(term));
    });
  }

  // 3. If local filter was too strict or returned nothing, try a broader keyword match (any word matches)
  if ((!servers || servers.length === 0) && allServers) {
    const primaryTerm = cleanedQuery.split(' ')[0];
    if (primaryTerm && primaryTerm.length > 1) {
      servers = allServers.filter(server => {
        const name = (server.attributes && server.attributes.name) ? server.attributes.name.toLowerCase() : '';
        return name.includes(primaryTerm);
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