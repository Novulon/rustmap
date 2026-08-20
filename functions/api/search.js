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

  // Fetch active Rust servers from BattleMetrics
  const generalUrl = `https://api.battlemetrics.com/servers?filter[game]=rust&page[size]=100`;
  const allServers = await fetchFromBM(generalUrl);
  
  if (allServers && allServers.length > 0) {
    // Score each server based on how many search keywords appear in its name
    const scoredServers = allServers.map(server => {
      const name = (server.attributes && server.attributes.name) ? server.attributes.name.toLowerCase() : '';
      let score = 0;
      searchTerms.forEach(term => {
        if (name.includes(term)) score++;
      });
      return { server, score };
    });

    // Sort by highest score (most matching keywords)
    scoredServers.sort((a, b) => b.score - a.score);
    
    // Keep servers that matched at least one keyword
    servers = scoredServers.filter(item => item.score > 0).map(item => item.server);
  }

  // Fallback to direct search if no scored matches found
  if (!servers || servers.length === 0) {
    const primaryTerm = searchTerms[0] || cleanedQuery;
    const searchUrl = `https://api.battlemetrics.com/servers?filter[game]=rust&filter[search]=${encodeURIComponent(primaryTerm)}&page[size]=25`;
    servers = await fetchFromBM(searchUrl);
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