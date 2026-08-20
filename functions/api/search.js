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

  const targetUrl = `https://api.battlemetrics.com/servers?filter[game]=rust&filter[search]=${encodeURIComponent(query)}&page[size]=10`;

  let data = null;

  // Method 1: Direct fetch with browser headers
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    if (response.ok) {
      data = await response.json();
    }
  } catch (e) {
    // Try fallback
  }

  // Method 2: AllOrigins Proxy
  if (!data) {
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=` + encodeURIComponent(targetUrl);
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const text = await response.text();
        data = JSON.parse(text);
      }
    } catch (e) {
      // Try fallback
    }
  }

  // Method 3: CorsProxy.io
  if (!data) {
    try {
      const proxyUrl = `https://corsproxy.io/?` + encodeURIComponent(targetUrl);
      const response = await fetch(proxyUrl);
      if (response.ok) {
        data = await response.json();
      }
    } catch (e) {
      // Ignore
    }
  }

  if (data && data.data) {
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // Fallback response so the frontend receives valid JSON instead of a 500 error
  return new Response(JSON.stringify({ data: [], error: 'BattleMetrics search temporarily restricted.' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}