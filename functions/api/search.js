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

  // Extract core keywords from the query (ignoring pipes, symbols, and small words)
  const cleanedQuery = query.replace(/[|]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const searchTerms = cleanedQuery.split(' ').filter(term => term.length > 2);

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

  // Since BattleMetrics strict search fails on pipes/symbols, let's fetch active Rust servers directly 
  // and do a robust case-insensitive keyword match on the server names.
  const generalUrl = `https://api.battlemetrics.com/servers?filter[game]=rust&page[size]=100`;
  const allServers = await fetchFromBM(generalUrl);
  
  if (allServers && allServers.length > 0) {
    servers = allServers.filter(server => {
      const name = (server.attributes && server.attributes.name) ? server.attributes.name.toLowerCase() : '';
      // Match if the server name contains at least two of the primary keywords (e.g., 'hapis', 'monthly')
      // Or matches the primary token directly
      let matches = 0;
      searchTerms.forEach(term => {
        if (name.includes(term)) matches++;
      });
      return matches > 0 || name.includes(cleanedQuery);
    });
  }

  // Fallback to standard search if local filter returned nothing
  if (!servers || servers.length === 0) {
    const singleTerm = searchTerms[0] || cleanedQuery;
    const searchUrl = `https://api.battlemetrics.com/servers?filter[game]=rust&filter[search]=${encodeURIComponent(singleTerm)}&page[size]=25`;
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