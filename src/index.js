const TWITCH_USERNAME = 'miemora'; // Twitch username to monitor

// Access environment variables directly from the `env` object
async function fetchTwitchAccessToken(env) {
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: env[0].TWITCH_CLIENT_ID,
      client_secret: env[0].TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });

  const data = await response.json();
  env[0].TWITCH_ACCESS_TOKEN = data.access_token; // Save token for future use
}

async function isStreamerLive(env) {
  console.log(env[0]);
  if (!env[0].TWITCH_ACCESS_TOKEN) {
    await fetchTwitchAccessToken(env);
  }

  const response = await fetch(
    `https://api.twitch.tv/helix/streams?user_login=${TWITCH_USERNAME}`,
    {
      headers: {
        'Client-ID': env[0].TWITCH_CLIENT_ID,
        Authorization: `Bearer ${env[0].TWITCH_ACCESS_TOKEN}`,
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

  await fetch(env[0].DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export default {
  async fetch(request, env) {
    console.log(env);
    // This function is triggered every 5 minutes using a cron schedule
    if (request.method === 'GET') {
      const isLive = await isStreamerLive(env);
      if (isLive) {
        // Send a notification only if the streamer is live
        await sendDiscordNotification(env);
      }

      return new Response('Checked live status.', { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
  },
};
