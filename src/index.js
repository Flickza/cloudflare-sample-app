const TWITCH_USERNAME = 'miemora'; // Twitch username to monitor
const KV_KEY = `twitch-live-status-${TWITCH_USERNAME}`; // Key for KV storage

// Access environment variables directly from the `env` object
async function fetchTwitchAccessToken(env) {
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID,
      client_secret: env.TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });

  const data = await response.json();
  env.TWITCH_ACCESS_TOKEN = data.access_token; // Save token for future use
}

async function isStreamerLive(env) {
  if (!env.TWITCH_ACCESS_TOKEN) {
    await fetchTwitchAccessToken(env);
  }

  const response = await fetch(
    `https://api.twitch.tv/helix/streams?user_login=${TWITCH_USERNAME}`,
    {
      headers: {
        'Client-ID': env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${env.TWITCH_ACCESS_TOKEN}`,
      },
    },
  );

  const data = await response.json();
  return data.data && data.data.length > 0;
}

async function sendDiscordNotification(env) {
  const payload = {
    content: `${TWITCH_USERNAME} is live! Watch here: https://twitch.tv/${TWITCH_USERNAME}`,
  };

  await fetch(env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export default {
  async fetch(request, env) {
    // This function is triggered every 5 minutes using a cron schedule
    if (request.method === 'GET') {
      const isLive = await isStreamerLive(env);
      const wasLive = await env.KV.get(KV_KEY);
      console.log(await env.KV.get(KV_KEY));

      if (isLive && !wasLive) {
        // Streamer just went live; send a notification
        await sendDiscordNotification(env);
        await env.KV.put(KV_KEY, 'true');
      } else if (!isLive && wasLive) {
        // Streamer went offline; reset live status
        await env.KV.delete(KV_KEY);
      } else if (wasLive) {
        // Streamer is still live; do nothing
        return new Response('Streamer is still live.', { status: 200 });
      }

      return new Response('Checked live status.', { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
  },
};
