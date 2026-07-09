const PORT = 3847;

export async function checkServer(base) {
  const url = base.replace(/\/$/, '');
  try {
    const res = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(800),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.ok ? url : null;
  } catch {
    return null;
  }
}

async function getLocalIPViaWebRTC() {
  if (typeof RTCPeerConnection === 'undefined') return null;

  return new Promise((resolve) => {
    let resolved = false;
    const done = (ip) => {
      if (resolved) return;
      resolved = true;
      try {
        pc.close();
      } catch {}
      resolve(ip);
    };

    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('nearby');
    pc.onicecandidate = (e) => {
      const cand = e.candidate?.candidate || '';
      const m = /(\d+\.\d+\.\d+\.\d+)/.exec(cand);
      if (m && !m[1].startsWith('127.')) done(m[1]);
    };
    pc.createOffer()
      .then((o) => pc.setLocalDescription(o))
      .catch(() => done(null));

    setTimeout(() => done(null), 2500);
  });
}

function subnetFromIP(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

async function scanSubnet(subnet, onProgress) {
  const hosts = [];
  for (let i = 1; i <= 254; i++) hosts.push(i);

  const batchSize = 40;
  for (let i = 0; i < hosts.length; i += batchSize) {
    const batch = hosts.slice(i, i + batchSize);
    onProgress?.(`Scanning ${subnet}.x (${i + batch.length}/254)…`);
    const results = await Promise.all(
      batch.map(async (n) => checkServer(`http://${subnet}.${n}:${PORT}`))
    );
    const found = results.find(Boolean);
    if (found) return found;
  }
  return null;
}

/**
 * Find the Nearby server on the same WiFi network.
 */
export async function discoverServer(onProgress) {
  const saved = localStorage.getItem('nearby-server');
  const origin = window.location.origin;
  const hostname = window.location.hostname;

  onProgress?.('Checking this device…');

  // Already on the server
  if (!['localhost', '127.0.0.1'].includes(hostname)) {
    const hit = await checkServer(origin);
    if (hit) return hit;
  }

  // mDNS hostname (works on many phones when server advertises nearby.local)
  onProgress?.('Looking for nearby.local…');
  for (const host of ['nearby.local', 'nearby-chat.local']) {
    const hit = await checkServer(`http://${host}:${PORT}`);
    if (hit) return hit;
  }

  // Previously used server on this network
  if (saved) {
    onProgress?.('Trying saved server…');
    const hit = await checkServer(saved);
    if (hit) return hit;
  }

  // Scan the phone/laptop's own subnet via WebRTC local IP
  onProgress?.('Scanning your WiFi…');
  const localIP = await getLocalIPViaWebRTC();
  if (localIP) {
    const subnet = subnetFromIP(localIP);
    if (subnet) {
      const selfHit = await checkServer(`http://${localIP}:${PORT}`);
      if (selfHit) return selfHit;

      const found = await scanSubnet(subnet, onProgress);
      if (found) return found;
    }
  }

  // Common home subnets if WebRTC blocked
  onProgress?.('Scanning common networks…');
  for (const subnet of ['192.168.1', '192.168.0', '10.0.0', '192.168.43']) {
    const found = await scanSubnet(subnet, onProgress);
    if (found) return found;
  }

  return null;
}

export function saveServer(url) {
  localStorage.setItem('nearby-server', url.replace(/\/$/, ''));
}

export function getServerUrl() {
  const saved = localStorage.getItem('nearby-server');
  if (saved && !saved.includes('loca.lt') && !saved.includes('ngrok')) {
    return saved.replace(/\/$/, '');
  }
  if (saved) localStorage.removeItem('nearby-server');
  const params = new URLSearchParams(window.location.search);
  if (params.get('server')) return params.get('server').replace(/\/$/, '');
  if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return window.location.origin;
  }
  return `http://localhost:${PORT}`;
}
