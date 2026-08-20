export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const query = url.searchParams.get('q');

  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing search query' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Construct the direct BattleMetrics API URL
  const targetUrl = `https://api.battlemetrics.com/servers?filter[game]=rust&filter[search]=${encodeURIComponent(query)}&page[size]=10`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json',
        // If you acquire a BattleMetrics API Key in the future, you can safely add it here
        // 'Authorization': 'Bearer YOUR_API_KEY'
      }
    });

    const data = await response.json();

    // Return the response directly to your frontend
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // Or restrict to 'https://rustmap-4ii.pages.dev'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}