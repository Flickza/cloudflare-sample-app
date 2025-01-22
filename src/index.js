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
    content: `@everyone ${TWITCH_USERNAME} is live! https://twitch.tv/${TWITCH_USERNAME}`,
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: 'Watch Stream',
            url: `https://twitch.tv/${TWITCH_USERNAME}`,
          },
        ],
      },
    ],
  };

  await fetch(
    `https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );
}

export default {
  async scheduled(event, env) {
    await checkStreamerStatus(env);
  },

  async fetch(request, env) {
    if (request.method === 'GET') {
      await checkStreamerStatus(env);
      return new Response('Checked live status.', { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
  },
};

async function checkStreamerStatus(env) {
  const isLive = await isStreamerLive(env);
  const wasLive = await env.KV.get(KV_KEY);

  if (isLive && !wasLive) {
    await sendDiscordNotification(env);
    await env.KV.put(KV_KEY, 'true');
  } else if (!isLive && wasLive) {
    await env.KV.delete(KV_KEY);
  }
}
