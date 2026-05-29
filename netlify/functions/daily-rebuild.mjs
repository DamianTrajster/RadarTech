export default async () => {
  const buildHookUrl = process.env.NETLIFY_BUILD_HOOK_URL;

  if (!buildHookUrl) {
    console.warn('NETLIFY_BUILD_HOOK_URL is not configured; skipping daily rebuild.');
    return new Response(null, { status: 204 });
  }

  const response = await fetch(buildHookUrl, { method: 'POST' });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`Netlify build hook failed with ${response.status}: ${body}`);
    return new Response('Build hook failed', { status: 502 });
  }

  console.log('Daily rebuild triggered successfully.');
  return new Response(null, { status: 204 });
};

export const config = {
  // Netlify schedules run in UTC. 08:15 UTC is 05:15 in Argentina.
  schedule: '15 8 * * *',
};
