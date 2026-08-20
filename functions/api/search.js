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

  // Clean query: strip out pipes (|) and excessive spacing which break BattleMetrics search
  const cleanedQuery = query.replace(/[|]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = cleanedQuery.split(' ');
  const shortQuery = words.slice(0, 3).join(' ');

  async function fetchBM(qStr) {
    const targetUrl = `https://api.battlemetrics.com/servers?filter[game]=rust&filter[search]=${encodeURIComponent(qStr)}&page[size]=10`;
    
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
        if (json && json.data && json.data.length > 0) return json;
      }
    } catch (e) {}

    // Method 2: AllOrigins Proxy
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=` + encodeURIComponent(targetUrl);
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const text = await res.text();
        const json = JSON.parse(text);
        if (json && json.data && json.data.length > 0) return json;
      }
    } catch (e) {}

    // Method 3: CorsProxy.io
    try {
      const proxyUrl = `https://corsproxy.io/?` + encodeURIComponent(targetUrl);
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const json = await res.json();
        if (json && json.data && json.data.length > 0) return json;
      }
    } catch (e) {}

    return null;
  }

  // 1. Try with the cleaned query
  let data = await fetchBM(cleanedQuery);

  // 2. Fallback to short query if no results found
  if ((!data || !data.data || data.data.length === 0) && shortQuery !== cleanedQuery && shortQuery.length > 1) {
    data = await fetchBM(shortQuery);
  }

  // 3. Fallback to first keyword if multiple words exist
  if ((!data || !data.data || data.data.length === 0) && words.length > 1) {
    data = await fetchBM(words[0]);
  }

  if (data && data.data) {
    return new Response(JSON.stringify(data), {
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