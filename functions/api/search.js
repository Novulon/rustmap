export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const rawQuery = url.searchParams.get('q');

  if (!rawQuery) {
    return new Response(JSON.stringify({ error: 'Missing search query' }), { 
      status: 400,
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  }

  // Sanitize query & tokenize
  const cleanedQuery = rawQuery.replace(/[|\[\]()\\/:\-_]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const searchTerms = cleanedQuery.split(' ').filter(term => term.length >= 2);

  if (searchTerms.length === 0) {
    return new Response(JSON.stringify({ data: [] }), { 
      status: 200,
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      } 
    });
  }

  const stopWords = new Set(['eu', 'us', 'uk', 'au', '1x', '2x', '3x', '5x', 'vanilla', 'monthly', 'weekly', 'solo', 'duo', 'trio', 'quad', 'main']);

  // Sort keywords: longest non-stopwords first
  const sortedTerms = [...searchTerms].sort((a, b) => {
    const aStop = stopWords.has(a) ? 1 : 0;
    const bStop = stopWords.has(b) ? 1 : 0;
    if (aStop !== bStop) return aStop - bStop;
    return b.length - a.length;
  });

  const anchorTerm = sortedTerms[0] || cleanedQuery;
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  };

  let candidateServers = [];

  try {
    // Stage 1: Search BattleMetrics with primary anchor keyword
    const primaryUrl = `https://api.battlemetrics.com/servers?filter[game]=rust&filter[search]=${encodeURIComponent(anchorTerm)}&page[size]=100`;
    let res = await fetch(primaryUrl, { headers });

    if (res.ok) {
      const json = await res.json();
      candidateServers = json.data || [];
    }

    // Stage 2: Fallback to general active server list if anchor search returned empty
    if (candidateServers.length === 0) {
      const fallbackUrl = `https://api.battlemetrics.com/servers?filter[game]=rust&page[size]=100`;
      res = await fetch(fallbackUrl, { headers });
      if (res.ok) {
        const json = await res.json();
        candidateServers = json.data || [];
      }
    }
  } catch (e) {
    console.error("BattleMetrics fetch error:", e);
  }

  // Local weighted re-ranking
  const scored = candidateServers.map(server => {
    const name = (server.attributes && server.attributes.name) ? server.attributes.name.toLowerCase() : '';
    let score = 0;

    searchTerms.forEach(term => {
      if (name.includes(term)) {
        const isStop = stopWords.has(term);
        const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const isExactWord = new RegExp(`\\b${safeTerm}\\b`, 'i').test(name);
        
        score += isExactWord ? (isStop ? 3 : 10) : (isStop ? 1 : 4);
      }
    });

    if (name.includes(cleanedQuery)) score += 25;

    return { server, score };
  });

  const results = scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.server);

  if (results.length > 0) {
    return new Response(JSON.stringify({ data: results }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=120, s-maxage=300'
      }
    });
  }

  return new Response(JSON.stringify({ data: [], error: 'No Rust servers found matching query.' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    }
  });
}