import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { discoverServer, discoverFromUniversalLink, checkServer, saveServer, getServerUrl, isUniversalOrigin, getUniversalLink, jumpToLocalHost, isCloudClient, getCloudServerUrl } from './discover';
import { PUBLIC_LOUNGE_ID, PUBLIC_LOUNGE_NAME, withPublicLounge, roomListCount } from './rooms';
import './App.css';

const ADJECTIVES = ['Blue', 'Swift', 'Calm', 'Bold', 'Bright', 'Cool', 'Wild', 'Zen', 'Lucky', 'Neon'];
const ANIMALS = ['Fox', 'Owl', 'Wolf', 'Bear', 'Hawk', 'Lynx', 'Panda', 'Tiger', 'Koala', 'Dolphin'];

function randomName() {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const b = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const n = Math.floor(Math.random() * 90) + 10;
  return `${a}${b}${n}`;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function slugify(text) {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export default function App() {
  const [screen, setScreen] = useState('lobby'); // lobby | scanning | no-host | create | chat
  const [lobbyLoading, setLobbyLoading] = useState(true);
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomLabel, setRoomLabel] = useState('');
  const [keepPublic, setKeepPublic] = useState(true);
  const [isRoomHost, setIsRoomHost] = useState(false);
  const [roomPersistent, setRoomPersistent] = useState(false);
  const [isDefaultRoom, setIsDefaultRoom] = useState(false);
  const [displayName, setDisplayName] = useState(() => randomName());
  const [myId, setMyId] = useState(null);
  const [users, setUsers] = useState([]);
  const [openMessages, setOpenMessages] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState({ incoming: [], outgoing: [] });
  const [dms, setDms] = useState({});
  const [tab, setTab] = useState('open');
  const [dmWith, setDmWith] = useState(null);
  const [openInput, setOpenInput] = useState('');
  const [dmInput, setDmInput] = useState('');
  const [requestTarget, setRequestTarget] = useState(null);
  const [requestIntro, setRequestIntro] = useState('');
  const [networkReady, setNetworkReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [availableRooms, setAvailableRooms] = useState(() => withPublicLounge([]));
  const [roomCount, setRoomCount] = useState(1);
  const [showRoomsPopup, setShowRoomsPopup] = useState(false);
  const [lobbyError, setLobbyError] = useState(null);
  const [serverInfo, setServerInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [socketOk, setSocketOk] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [scanStatus, setScanStatus] = useState('Connecting to your WiFi…');
  const [serverBase, setServerBase] = useState(null);

  const applyRooms = useCallback((rooms) => {
    const next = withPublicLounge(rooms);
    setAvailableRooms(next);
    setRoomCount(roomListCount(rooms));
  }, []);

  const socketRef = useRef(null);
  const myIdRef = useRef(null);
  const openEndRef = useRef(null);
  const dmEndRef = useRef(null);
  const popupShownRef = useRef(false);
  const autoJoinDoneRef = useRef(false);

  const applyState = useCallback((state, selfId) => {
    setUsers(state.users || []);
    setOpenMessages(state.openMessages || []);
    setFriends(state.friends || []);
    setFriendRequests(state.friendRequests || { incoming: [], outgoing: [] });
    setDms(state.dms || {});
    if (selfId) setMyId(selfId);
  }, []);

  const setupSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;

    const url = getServerUrl();
    const socket = io(url, {
      transports: isMobileDevice() ? ['polling', 'websocket'] : ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      timeout: 20000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setSocketOk(true);
      setLobbyError(null);
      const base = getServerUrl();
      fetch(`${base}/api/rooms`)
        .then((r) => r.json())
        .then(({ rooms }) => applyRooms(rooms))
        .catch(() => {});
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setSocketOk(false);
    });

    socket.on('rooms-list', ({ rooms }) => {
      applyRooms(rooms);
      if (!popupShownRef.current) {
        setShowRoomsPopup(true);
        popupShownRef.current = true;
        setTimeout(() => setShowRoomsPopup(false), 4000);
      }
    });

    socket.on('joined', ({ userId, roomId: joinedRoom, roomName: joinedName, isHost, persistent, isDefault }) => {
      myIdRef.current = userId;
      setMyId(userId);
      setRoomId(joinedRoom);
      setRoomName(joinedName || joinedRoom);
      setIsRoomHost(!!isHost);
      setRoomPersistent(!!persistent);
      setIsDefaultRoom(!!isDefault);
      setScreen('chat');
      setShowRoomsPopup(false);
      setLobbyError(null);
    });

    socket.on('room-meta', ({ persistent, isHost }) => {
      setRoomPersistent(!!persistent);
      setIsRoomHost(!!isHost);
    });

    socket.on('left-room', () => {
      setScreen('lobby');
      setRoomId('');
      setRoomName('');
      setIsRoomHost(false);
      setRoomPersistent(false);
      setIsDefaultRoom(false);
      myIdRef.current = null;
      setMyId(null);
      setOpenMessages([]);
      setUsers([]);
      setFriends([]);
      setFriendRequests({ incoming: [], outgoing: [] });
      setDms({});
      setDmWith(null);
      setTab('open');
      popupShownRef.current = false;
      fetch(`${getServerUrl()}/api/rooms`)
        .then((r) => r.json())
        .then(({ rooms }) => applyRooms(rooms))
        .catch(() => {});
    });

    socket.on('state', (state) => {
      applyState(state, myIdRef.current);
    });

    socket.on('open-message', (msg) => {
      setOpenMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on('connect_error', () => {
      setSocketOk(false);
      setLobbyError('Connection lost. Same WiFi? Open http://nearby.local:3847 or scan again.');
      setShowManual(true);
    });

    socket.on('error', ({ message }) => setLobbyError(message));

    return socket;
  }, [applyState, applyRooms]);

  const connectToServer = useCallback((baseUrl) => {
    const clean = baseUrl?.trim().replace(/\/$/, '');
    if (!clean) return;
    saveServer(clean);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setServerBase(clean);
    window.location.href = clean;
  }, []);

  const initNetwork = useCallback(async () => {
    setLobbyLoading(true);
    setLobbyError(null);

    const cloudUrl = getCloudServerUrl();
    const cloudMode = isCloudClient();

    if (cloudMode && cloudUrl) {
      setScreen('lobby');
      applyRooms([]);
      setScanStatus('Connecting to live server…');

      let base = await checkServer(cloudUrl);
      if (!base && !isUniversalOrigin()) {
        base = await checkServer(window.location.origin);
      }

      if (!base) {
        setNetworkReady(false);
        setLobbyLoading(false);
        setLobbyError('Live server is offline. Use the direct link below or try again.');
        return;
      }

      saveServer(base);
      setServerBase(base);
      const here = window.location.origin.replace(/\/$/, '');
      if (base !== here && isUniversalOrigin()) {
        window.location.replace(base);
        return;
      }

      try {
        const [info, roomsData] = await Promise.all([
          fetch(`${base}/api/info`, { signal: AbortSignal.timeout(15000) }).then((r) => r.json()),
          fetch(`${base}/api/rooms`, { signal: AbortSignal.timeout(15000) }).then((r) => r.json()),
        ]);
        setServerInfo(info);
        applyRooms(roomsData.rooms);
        setNetworkReady(true);
        setLobbyLoading(false);
        setLobbyError(null);
        setupSocket();
      } catch {
        setNetworkReady(false);
        setLobbyLoading(false);
        setLobbyError('Could not reach live server. Tap Try again.');
      }
      return;
    }

    const universal = isUniversalOrigin();
    let base = null;

    if (universal) {
      setScreen('lobby');
      applyRooms([]);
      setScanStatus('Connecting to your WiFi…');
      base = await discoverFromUniversalLink(setScanStatus);
    } else {
      const current = getServerUrl();
      base = await checkServer(current);

      if (!base && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
        base = await checkServer('http://localhost:3847');
      }

      if (!base) {
        setScreen('scanning');
        setScanStatus('Finding Nearby on your WiFi…');
        base = await discoverServer(setScanStatus);
      }
    }

    if (!base) {
      setScreen('lobby');
      applyRooms([]);
      setNetworkReady(false);
      setLobbyLoading(false);
      setLobbyError('No WiFi host yet. Someone on this network must run ./start.sh — then Open Lounge appears here.');
      return;
    }

    saveServer(base);
    setServerBase(base);
    setScreen('lobby');

    const here = window.location.origin.replace(/\/$/, '');
    if (base !== here) {
      window.location.replace(base);
      return;
    }

    try {
      const [info, roomsData] = await Promise.all([
        fetch(`${base}/api/info`, { signal: AbortSignal.timeout(10000) }).then((r) => r.json()),
        fetch(`${base}/api/rooms`, { signal: AbortSignal.timeout(10000) }).then((r) => r.json()),
      ]);
      setServerInfo(info);
      applyRooms(roomsData.rooms);
      setNetworkReady(true);
      setLobbyLoading(false);
      setupSocket();
    } catch {
      setScreen('lobby');
      applyRooms([]);
      setNetworkReady(false);
      setLobbyLoading(false);
      setLobbyError('Could not reach this WiFi host. Run ./start.sh on a laptop here, then open the link again.');
    }
  }, [setupSocket, applyRooms]);

  useEffect(() => {
    initNetwork();
  }, [initNetwork]);

  useEffect(() => {
    if (!networkReady || autoJoinDoneRef.current || screen !== 'lobby') return;
    const want = sessionStorage.getItem('nearby-auto-join');
    if (want !== 'lounge') return;
    sessionStorage.removeItem('nearby-auto-join');
    autoJoinDoneRef.current = true;
    const name = displayName.trim() || randomName();
    if (!displayName.trim()) setDisplayName(name);
    const socket = setupSocket();
    const doJoin = () => {
      socket.emit('join', {
        roomId: PUBLIC_LOUNGE_ID,
        displayName: name,
        roomLabel: PUBLIC_LOUNGE_NAME,
        keepPublic: false,
      });
    };
    if (socket.connected) doJoin();
    else socket.once('connect', doJoin);
  }, [networkReady, screen, displayName, setupSocket]);

  useEffect(() => {
    if (networkReady) return undefined;
    const retry = setInterval(() => {
      if (screen === 'lobby' && !lobbyLoading) initNetwork();
    }, 10000);
    return () => clearInterval(retry);
  }, [networkReady, screen, lobbyLoading, initNetwork]);

  useEffect(() => {
    const base = serverBase || getServerUrl();
    const poll = setInterval(() => {
      if (screen !== 'lobby' && screen !== 'create') return;
      fetch(`${base}/api/rooms`)
        .then((r) => r.json())
        .then(({ rooms }) => applyRooms(rooms))
        .catch(() => {});
    }, 2000);
    return () => clearInterval(poll);
  }, [screen, serverBase, applyRooms]);

  const leaveRoom = () => {
    socketRef.current?.emit('leave-room');
  };

  useEffect(() => {
    openEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [openMessages]);

  useEffect(() => {
    dmEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dms, dmWith]);

  const joinRoom = (targetRoomId, targetLabel, options = {}) => {
    const name = displayName.trim();
    if (!name) {
      setLobbyError('Pick an anonymous name first.');
      return;
    }
    if (!networkReady) {
      setLobbyError('Still connecting to your WiFi… wait a moment and try again.');
      return;
    }
    const socket = setupSocket();
    const doJoin = () => {
      socket.emit('join', {
        roomId: targetRoomId,
        displayName: name,
        roomLabel: targetLabel || targetRoomId,
        keepPublic: !!options.keepPublic,
      });
    };
    if (socket.connected) doJoin();
    else socket.once('connect', doJoin);
  };

  const toggleRoomPublic = (next) => {
    setRoomPersistent(next);
    socketRef.current?.emit('set-room-public', { keepPublic: next });
  };

  const handleCreateRoom = (e) => {
    e.preventDefault();
    const label = roomLabel.trim();
    if (!label) return;
    const id = slugify(label) || `room-${Date.now()}`;
    joinRoom(id, label, { keepPublic });
  };

  const sendOpen = (e) => {
    e.preventDefault();
    if (!openInput.trim()) return;
    socketRef.current?.emit('open-message', { text: openInput });
    setOpenInput('');
  };

  const sendDm = (e) => {
    e.preventDefault();
    if (!dmInput.trim() || !dmWith) return;
    socketRef.current?.emit('dm-message', { toUserId: dmWith, text: dmInput });
    setDmInput('');
  };

  const sendFriendRequest = () => {
    if (!requestTarget) return;
    socketRef.current?.emit('friend-request', {
      toUserId: requestTarget.id,
      intro: requestIntro,
    });
    setRequestTarget(null);
    setRequestIntro('');
  };

  const respondFriend = (fromUserId, accept) => {
    socketRef.current?.emit('friend-respond', { fromUserId, accept });
  };

  const userById = (id) => users.find((u) => u.id === id);
  const isFriend = (id) => friends.includes(id);
  const hasOutgoing = (id) => friendRequests.outgoing.some((r) => r.to === id);
  const hasIncoming = (id) => friendRequests.incoming.some((r) => r.from === id);

  const isHostComputer = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const universalLink = serverInfo?.universalLink || getUniversalLink();
  const shareLink = universalLink || serverInfo?.lanUrl || serverInfo?.bestPhoneUrl || serverInfo?.phoneUrls?.[0] || null;
  const localLink = serverInfo?.lanUrl || serverInfo?.bestPhoneUrl || serverInfo?.phoneUrls?.[0] || null;

  const copyShareLink = async () => {
    const url = shareLink;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setLobbyError('Copy failed — type the URL manually in your phone browser.');
    }
  };

  if (screen === 'scanning') {
    return (
      <div className="join-screen">
        <div className="join-card scanning-card">
          <div className="logo pulse">📡</div>
          <h1>Nearby</h1>
          <p className="tagline">{isUniversalOrigin() ? 'Connecting to your WiFi…' : 'Finding chat on your WiFi…'}</p>
          <p className="scan-status">{scanStatus}</p>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (screen === 'no-host') {
    return (
      <div className="join-screen">
        <div className="join-card lobby-card">
          <div className="logo">📡</div>
          <h1>Nearby</h1>
          <p className="tagline">Same WiFi chat</p>
          <div className="network-status offline">
            <span className="dot" />
            No host found on this WiFi
          </div>
          <div className="empty-rooms">
            <p><strong>This link only works on the same WiFi.</strong></p>
            <p>Rooms you see here are only from people connected to <em>your</em> network right now — not from other places in the world.</p>
            <p className="hint-small">Ask someone on this WiFi to run <code>./start.sh</code>, then share the universal link or open <code>http://nearby.local:3847</code></p>
          </div>
          <button type="button" className="btn-primary btn-create" onClick={() => { setScreen('scanning'); initNetwork(); }}>
            Scan WiFi again
          </button>
          <div className="manual-connect" style={{ marginTop: 16 }}>
            <p>Have a link? Paste it here:</p>
            <div className="phone-url-row">
              <input
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="http://nearby.local:3847"
              />
              <button type="button" className="btn-copy" onClick={() => connectToServer(manualUrl)}>
                Go
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'lobby' || screen === 'create') {
    return (
      <div className="join-screen">
        {showRoomsPopup && networkReady && (
          <div className="rooms-popup">
            <span className="popup-icon">📡</span>
            <strong>
              {roomCount === 0
                ? 'No active rooms yet — be the first!'
                : `${roomCount} room${roomCount === 1 ? '' : 's'} live on your network`}
            </strong>
            <p>Tap a room below to join, or create your own.</p>
          </div>
        )}

        <div className="join-card lobby-card">
          <div className="logo">📡</div>
          <h1>Nearby</h1>
          <p className="tagline">Open link · Open Lounge always live</p>

          <div className="wifi-scope-banner">
            <span className="wifi-icon">☁️</span>
            <div>
              <strong>{isCloudClient() ? 'Live cloud chat' : 'Rooms on this WiFi right now'}</strong>
              <p>{isCloudClient()
                ? 'No install. Open the link, join Open Lounge, chat instantly.'
                : 'Anyone on the same network can open this link and see these rooms. Other WiFi networks have their own separate rooms.'}</p>
            </div>
          </div>

          {isHostComputer && shareLink && screen === 'lobby' && (
            <div className="phone-help share-link">
              <h3>Share this one link</h3>
              <p>Anyone on your WiFi taps it — we find this network automatically and show live rooms:</p>
              <div className="phone-url-row">
                <code>{shareLink}</code>
                <button type="button" className="btn-copy" onClick={copyShareLink}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {localLink && localLink !== shareLink && (
                <p className="hint-small">Or same WiFi direct: <code>{localLink}</code></p>
              )}
            </div>
          )}

          {screen === 'lobby' && (
            <>
              {!networkReady && (
                <div className="connecting-banner">
                  <div className="spinner sm" />
                  <div>
                    <strong>{scanStatus || 'Connecting to your WiFi…'}</strong>
                    <p>Open Lounge is always here — connecting to the host on this network.</p>
                  </div>
                </div>
              )}

              <div className="rooms-section rooms-hero">
                <div className="rooms-header">
                  <h2>Live rooms</h2>
                  <span className="room-count-pill">{lobbyLoading ? '…' : `${roomCount} now`}</span>
                </div>

                <div className={`public-lounge-card${networkReady ? '' : ' waiting'}`}>
                  <div>
                    <strong>{PUBLIC_LOUNGE_NAME}</strong>
                    <span className="room-pill default">Always open</span>
                    <p className="hint-small">
                      {networkReady
                        ? (isCloudClient() ? 'Always open — tap to join and chat.' : 'Public room on this WiFi — jump in anytime.')
                        : (isCloudClient() ? 'Connecting to live server…' : 'Waiting for a host on this WiFi (someone runs ./start.sh).')}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-join btn-join-lounge"
                    disabled={!networkReady || lobbyLoading}
                    onClick={() => joinRoom(PUBLIC_LOUNGE_ID, PUBLIC_LOUNGE_NAME)}
                  >
                    {networkReady ? 'Join lounge' : 'Connecting…'}
                  </button>
                </div>

                {lobbyLoading ? (
                  <div className="empty-rooms loading-rooms">
                    <div className="spinner sm" />
                    <p>Loading rooms on this WiFi…</p>
                  </div>
                ) : availableRooms.filter((r) => r.id !== PUBLIC_LOUNGE_ID).length === 0 ? (
                  <div className="empty-rooms">
                    <p>No hosted rooms yet — start one below or join the lounge.</p>
                    <p className="hint-small">Hosts can keep a room always visible on this WiFi.</p>
                  </div>
                ) : (
                  <ul className="room-list">
                    {availableRooms.filter((r) => r.id !== PUBLIC_LOUNGE_ID).map((room) => (
                      <li key={room.id} className={`room-item${room.isPublic ? ' room-public' : ''}`}>
                        <div className="room-info">
                          <strong>{room.name}</strong>
                          <div className="room-meta-row">
                            {room.isPublic && <span className="room-pill">Always open</span>}
                            <span>{room.userCount} {room.userCount === 1 ? 'person' : 'people'} online</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-join"
                          onClick={() => joinRoom(room.id, room.name)}
                        >
                          Join
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <label className="name-field compact">
                <span>Your name (anonymous)</span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Pick a name before joining"
                  maxLength={24}
                />
              </label>

              {lobbyError && <p className="error-text">{lobbyError}</p>}

              <button
                type="button"
                className="btn-primary btn-create"
                disabled={!networkReady}
                onClick={() => setScreen('create')}
              >
                + Host a room
              </button>

              {!networkReady && isCloudClient() && (
                <div className="manual-connect connect-hero">
                  <p><strong>Live server is starting…</strong></p>
                  <p className="hint-small">Free cloud servers take ~30s to wake up if idle.</p>
                  <button type="button" className="btn-primary btn-connect-wifi" onClick={() => initNetwork()}>
                    Try again
                  </button>
                </div>
              )}

              {!networkReady && !isCloudClient() && (
                <div className="manual-connect connect-hero">
                  <p><strong>Not connected to a WiFi host yet.</strong></p>
                  <p className="hint-small">Someone on this WiFi must run <code>./start.sh</code> on a laptop first.</p>
                  <button type="button" className="btn-primary btn-connect-wifi" onClick={jumpToLocalHost}>
                    Connect to this WiFi
                  </button>
                  <p className="hint-small">Opens <code>http://nearby.local:3847</code> and joins Open Lounge.</p>
                  <div className="phone-url-row">
                    <input
                      value={manualUrl}
                      onChange={(e) => setManualUrl(e.target.value)}
                      placeholder="http://192.168.x.x:3847"
                    />
                    <button type="button" className="btn-copy" onClick={() => connectToServer(manualUrl)}>
                      Go
                    </button>
                  </div>
                  <button type="button" className="btn-linkish" onClick={() => initNetwork()}>
                    Scan WiFi again
                  </button>
                </div>
              )}
            </>
          )}

          {screen === 'create' && (
            <form onSubmit={handleCreateRoom} className="create-form">
              <p className="create-intro">Host a room others on this WiFi can find and join.</p>
              <label>
                <span>Room name</span>
                <input
                  value={roomLabel}
                  onChange={(e) => setRoomLabel(e.target.value)}
                  placeholder="e.g. Coffee chat, Study group"
                  autoFocus
                  required
                  maxLength={32}
                />
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={keepPublic}
                  onChange={(e) => setKeepPublic(e.target.checked)}
                />
                <span>Keep this room always visible on this WiFi (public host)</span>
              </label>
              <div className="create-actions">
                <button type="button" onClick={() => setScreen('lobby')}>Back</button>
                <button type="submit" className="btn-primary">Host & join</button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  const dmUser = dmWith ? userById(dmWith) : null;
  const pendingCount = friendRequests.incoming.length;
  const activeRoomName = roomName || availableRooms.find((r) => r.id === roomId)?.name || roomId;

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Nearby</h1>
          <span className="room-badge">{activeRoomName}</span>
        </div>
        <div className="header-right">
          {isRoomHost && !isDefaultRoom && (
            <label className="host-toggle" title="Keep this room listed even when empty">
              <input
                type="checkbox"
                checked={roomPersistent}
                onChange={(e) => toggleRoomPublic(e.target.checked)}
              />
              <span>Public room</span>
            </label>
          )}
          {isDefaultRoom && <span className="host-badge">Public lounge</span>}
          <div className={`status ${connected ? 'on' : 'off'}`}>
            {connected ? `${users.length} nearby` : 'Reconnecting…'}
          </div>
          <button type="button" className="btn-leave" onClick={leaveRoom}>Leave</button>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === 'open' ? 'active' : ''} onClick={() => { setTab('open'); setDmWith(null); }}>
          Open chat
        </button>
        <button className={tab === 'people' ? 'active' : ''} onClick={() => { setTab('people'); setDmWith(null); }}>
          People
          {pendingCount > 0 && <span className="badge">{pendingCount}</span>}
        </button>
        <button className={tab === 'dms' ? 'active' : ''} onClick={() => setTab('dms')}>
          Messages
          {friends.length > 0 && <span className="badge muted">{friends.length}</span>}
        </button>
      </nav>

      <main className="main">
        {tab === 'open' && (
          <div className="chat-panel">
            <div className="messages">
              {openMessages.map((m) =>
                m.type === 'system' ? (
                  <div key={m.id} className="msg-system">{m.text}</div>
                ) : (
                  <div key={m.id} className={`msg ${m.from === myId ? 'mine' : ''}`}>
                    <span className="msg-name" style={{ color: m.color }}>{m.fromName}</span>
                    <span className="msg-text">{m.text}</span>
                    <span className="msg-time">{formatTime(m.at)}</span>
                  </div>
                )
              )}
              <div ref={openEndRef} />
            </div>
            <form className="composer" onSubmit={sendOpen}>
              <input
                value={openInput}
                onChange={(e) => setOpenInput(e.target.value)}
                placeholder="Say something to the room…"
                maxLength={500}
              />
              <button type="submit" className="btn-send">↑</button>
            </form>
          </div>
        )}

        {tab === 'people' && (
          <div className="people-panel">
            {friendRequests.incoming.length > 0 && (
              <section className="section">
                <h3>Friend requests</h3>
                {friendRequests.incoming.map((req) => {
                  const u = userById(req.from);
                  if (!u) return null;
                  return (
                    <div key={req.from} className="person-card request">
                      <div className="avatar" style={{ background: u.color }}>{u.displayName[0]}</div>
                      <div className="person-info">
                        <strong>{u.displayName}</strong>
                        {req.intro && <p className="intro">"{req.intro}"</p>}
                      </div>
                      <div className="person-actions">
                        <button className="btn-accept" onClick={() => respondFriend(req.from, true)}>Accept</button>
                        <button className="btn-decline" onClick={() => respondFriend(req.from, false)}>Decline</button>
                      </div>
                    </div>
                  );
                })}
              </section>
            )}

            <section className="section">
              <h3>In this room ({users.length})</h3>
              {users.filter((u) => u.id !== myId).map((u) => (
                <div key={u.id} className="person-card">
                  <div className="avatar" style={{ background: u.color }}>{u.displayName[0]}</div>
                  <div className="person-info">
                    <strong>{u.displayName}</strong>
                    <span className="person-status">
                      {isFriend(u.id) ? '✓ Friends' : hasOutgoing(u.id) ? 'Request sent' : hasIncoming(u.id) ? 'Wants to connect' : 'Nearby'}
                    </span>
                  </div>
                  <div className="person-actions">
                    {isFriend(u.id) ? (
                      <button className="btn-msg" onClick={() => { setTab('dms'); setDmWith(u.id); }}>Message</button>
                    ) : !hasOutgoing(u.id) && !hasIncoming(u.id) ? (
                      <button className="btn-add" onClick={() => setRequestTarget(u)}>+ Connect</button>
                    ) : null}
                  </div>
                </div>
              ))}
              {users.length <= 1 && (
                <p className="empty">You're alone in this room. Others on the network will see it in the lobby.</p>
              )}
            </section>
          </div>
        )}

        {tab === 'dms' && !dmWith && (
          <div className="dms-list">
            {friends.length === 0 ? (
              <p className="empty">No friends yet. Send a connection request from the People tab.</p>
            ) : (
              friends.map((fid) => {
                const u = userById(fid);
                if (!u) return null;
                const msgs = dms[fid] || [];
                const last = msgs[msgs.length - 1];
                return (
                  <button key={fid} className="dm-row" onClick={() => setDmWith(fid)}>
                    <div className="avatar" style={{ background: u.color }}>{u.displayName[0]}</div>
                    <div className="dm-preview">
                      <strong>{u.displayName}</strong>
                      <span>{last ? last.text : 'Start chatting'}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {tab === 'dms' && dmWith && dmUser && (
          <div className="chat-panel dm">
            <button className="back-btn" onClick={() => setDmWith(null)}>← Back</button>
            <div className="dm-header">
              <div className="avatar sm" style={{ background: dmUser.color }}>{dmUser.displayName[0]}</div>
              <strong>{dmUser.displayName}</strong>
            </div>
            <div className="messages">
              {(dms[dmWith] || []).map((m) => (
                <div key={m.id} className={`msg ${m.from === myId ? 'mine' : ''}`}>
                  <span className="msg-text">{m.text}</span>
                  <span className="msg-time">{formatTime(m.at)}</span>
                </div>
              ))}
              <div ref={dmEndRef} />
            </div>
            <form className="composer" onSubmit={sendDm}>
              <input
                value={dmInput}
                onChange={(e) => setDmInput(e.target.value)}
                placeholder={`Message ${dmUser.displayName}…`}
                maxLength={500}
              />
              <button type="submit" className="btn-send">↑</button>
            </form>
          </div>
        )}
      </main>

      {requestTarget && (
        <div className="modal-overlay" onClick={() => setRequestTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Connect with {requestTarget.displayName}</h3>
            <p>Send a friend request to unlock private chat.</p>
            <textarea
              value={requestIntro}
              onChange={(e) => setRequestIntro(e.target.value)}
              placeholder="Optional intro message…"
              rows={3}
              maxLength={200}
            />
            <div className="modal-actions">
              <button onClick={() => setRequestTarget(null)}>Cancel</button>
              <button className="btn-primary" onClick={sendFriendRequest}>Send request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
