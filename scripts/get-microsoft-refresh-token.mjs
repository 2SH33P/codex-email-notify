#!/usr/bin/env node

const args = parseArgs(process.argv.slice(2));
const tenant = args.tenant || process.env.MICROSOFT_OAUTH_TENANT || "common";
const clientId = args.clientId || process.env.MICROSOFT_OAUTH_CLIENT_ID || "";
const scope =
  args.scope ||
  process.env.MICROSOFT_OAUTH_SCOPE ||
  "https://outlook.office.com/SMTP.Send offline_access openid profile email";

if (!clientId) {
  process.stderr.write(
    "Usage: node scripts/get-microsoft-refresh-token.mjs --client-id <CLIENT_ID> [--tenant common] [--scope \"https://outlook.office.com/SMTP.Send offline_access openid profile email\"]\n"
  );
  process.exit(1);
}

const deviceCodeUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/devicecode`;
const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

await main();

async function main() {
  const device = await requestDeviceCode();
  printIntro(device);
  const token = await pollForToken(device);
  printSuccess(token);
}

async function requestDeviceCode() {
  const body = new URLSearchParams({
    client_id: clientId,
    scope
  });

  const response = await fetch(deviceCodeUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

async function pollForToken(device) {
  const intervalMs = Math.max(5, Number(device.interval) || 5) * 1000;
  const expiresAt = Date.now() + (Number(device.expires_in) || 900) * 1000;
  let delayMs = intervalMs;

  while (Date.now() < expiresAt) {
    await sleep(delayMs);

    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      client_id: clientId,
      device_code: device.device_code
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body
    });
    const payload = await response.json().catch(() => ({}));

    if (response.ok) {
      if (!payload.refresh_token) {
        throw new Error("No refresh_token returned. Make sure your scope includes offline_access.");
      }
      return payload;
    }

    if (payload.error === "authorization_pending") {
      continue;
    }
    if (payload.error === "slow_down") {
      delayMs += 5000;
      continue;
    }
    if (payload.error === "authorization_declined") {
      throw new Error("Authorization declined by user.");
    }
    if (payload.error === "expired_token") {
      throw new Error("Device code expired before authorization completed.");
    }

    throw new Error(payload.error_description || payload.error || `HTTP ${response.status}`);
  }

  throw new Error("Timed out waiting for Microsoft sign-in.");
}

function printIntro(device) {
  process.stdout.write("\nMicrosoft OAuth2 device sign-in\n\n");
  if (typeof device.message === "string" && device.message.trim()) {
    process.stdout.write(`${device.message.trim()}\n\n`);
  } else {
    process.stdout.write(`Open: ${device.verification_uri}\n`);
    process.stdout.write(`Code: ${device.user_code}\n\n`);
  }
  process.stdout.write("Waiting for authorization...\n");
}

function printSuccess(token) {
  const result = {
    authType: "oauth2",
    oauth2: {
      provider: "microsoft",
      tenant,
      clientId,
      refreshToken: token.refresh_token,
      accessToken: token.access_token,
      accessTokenExpires: typeof token.expires_in === "number" ? Date.now() + token.expires_in * 1000 : undefined,
      scope: token.scope || scope
    }
  };

  process.stdout.write("\nAuthorization successful.\n\n");
  process.stdout.write("Paste this into your config.local.json and then add your smtp/from/to values:\n\n");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) {
      continue;
    }
    const key = current.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[toCamel(key)] = next;
      index += 1;
    } else {
      parsed[toCamel(key)] = "true";
    }
  }
  return parsed;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
