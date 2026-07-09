import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
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

function getServerUrl() {
  const saved = localStorage.getItem('nearby-server');
  if (saved) return saved.replace(/\/$/, '');
  const params = new URLSearchParams(window.location.search);
  if (params.get('server')) return params.get('server').replace(/\/$/, '');
  return window.location.origin;
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export default function App() {
  const [screen, setScreen] = useState('lobby'); // lobby | create | chat
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomLabel, setRoomLabel] = useState('');
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
  const [availableRooms, setAvailableRooms] = useState([]);
  const [roomCount, setRoomCount] = useState(0);
  const [showRoomsPopup, setShowRoomsPopup] = useState(false);
  const [lobbyError, setLobbyError] = useState(null);
  const [serverInfo, setServerInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [socketOk, setSocketOk] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [showManual, setShowManual] = useState(false);

  const socketRef = useRef(null);
  const myIdRef = useRef(null);
  const openEndRef = useRef(null);
  const dmEndRef = useRef(null);
  const popupShownRef = useRef(false);

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
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setSocketOk(false);
    });

    socket.on('rooms-list', ({ rooms, count }) => {
      setAvailableRooms(rooms || []);
      setRoomCount(count ?? rooms?.length ?? 0);
      if (!popupShownRef.current) {
        setShowRoomsPopup(true);
        popupShownRef.current = true;
        setTimeout(() => setShowRoomsPopup(false), 4000);
      }
    });

    socket.on('joined', ({ userId, roomId: joinedRoom, roomName: joinedName }) => {
      myIdRef.current = userId;
      setMyId(userId);
      setRoomId(joinedRoom);
      setRoomName(joinedName || joinedRoom);
      setScreen('chat');
      setShowRoomsPopup(false);
      setLobbyError(null);
    });

    socket.on('left-room', () => {
      setScreen('lobby');
      setRoomId('');
      setRoomName('');
      myIdRef.current = null;
      setMyId(null);
      setOpenMessages([]);
      setUsers([]);
      setFriends([]);
      setFriendRequests({ incoming: [], outgoing: [] });
      setDms({});
      setDmWith(null);
      setTab('open');
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

    socket.on('connect_error', (err) => {
      setSocketOk(false);
      const onPhone = isMobileDevice() || !['localhost', '127.0.0.1'].includes(window.location.hostname);
      if (onPhone) {
        setLobbyError(
          'Cannot connect. Ask the host to run ./start-phone.sh and send you the https:// link. Same WiFi? Use http://192.168.x.x:3847 not localhost.'
        );
        setShowManual(true);
      } else {
        setLobbyError(`Connection failed: ${err.message}. Run ./start.sh and keep terminal open.`);
      }
    });

    socket.on('error', ({ message }) => setLobbyError(message));

    return socket;
  }, [applyState]);

  const connectToServer = useCallback((baseUrl) => {
    const clean = baseUrl?.trim().replace(/\/$/, '');
    if (!clean) return;
    localStorage.setItem('nearby-server', clean);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    window.location.href = clean;
  }, []);

  useEffect(() => {
    const base = getServerUrl();
    fetch(`${base}/api/info`, { signal: AbortSignal.timeout(10000) })
      .then((r) => r.json())
      .then((info) => {
        setServerInfo(info);
        setNetworkReady(true);
        setupSocket();
      })
      .catch(() => {
        const onPhone = !['localhost', '127.0.0.1'].includes(window.location.hostname);
        setLobbyError(
          onPhone
            ? 'Cannot reach the app. Ask the host to run ./start-phone.sh on laptop and open the https:// link they send you.'
            : 'Could not start. Run ./start.sh or ./start-phone.sh and keep the terminal open.'
        );
      });

    const poll = setInterval(() => {
      if (screen !== 'lobby' && screen !== 'create') return;
      fetch(`${getServerUrl()}/api/rooms`)
        .then((r) => r.json())
        .then(({ rooms, count }) => {
          setAvailableRooms(rooms || []);
          setRoomCount(count ?? rooms?.length ?? 0);
        })
        .catch(() => {});
    }, 3000);

    const pollInfo = setInterval(() => {
      if (screen !== 'lobby' && screen !== 'create') return;
      fetch(`${getServerUrl()}/api/info`)
        .then((r) => r.json())
        .then((info) => setServerInfo(info))
        .catch(() => {});
    }, 2000);

    return () => {
      clearInterval(poll);
      clearInterval(pollInfo);
    };
  }, [screen, setupSocket, connectToServer]);

  const leaveRoom = () => {
    socketRef.current?.emit('leave-room');
  };

  useEffect(() => {
    openEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [openMessages]);

  useEffect(() => {
    dmEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dms, dmWith]);

  const joinRoom = (targetRoomId, targetLabel) => {
    const name = displayName.trim();
    if (!name) {
      setLobbyError('Pick an anonymous name first.');
      return;
    }
    const socket = setupSocket();
    const doJoin = () => {
      socket.emit('join', {
        roomId: targetRoomId,
        displayName: name,
        roomLabel: targetLabel || targetRoomId,
      });
    };
    if (socket.connected) doJoin();
    else socket.once('connect', doJoin);
  };

  const handleCreateRoom = (e) => {
    e.preventDefault();
    const label = roomLabel.trim();
    if (!label) return;
    const id = slugify(label) || `room-${Date.now()}`;
    joinRoom(id, label);
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
  const phoneUrl = serverInfo?.bestPhoneUrl || serverInfo?.tunnelUrl || serverInfo?.phoneUrls?.[0] || null;
  const isTunnel = Boolean(serverInfo?.tunnelUrl);

  const copyPhoneUrl = async () => {
    const url = phoneUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(phoneUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setLobbyError('Copy failed — type the URL manually in your phone browser.');
    }
  };

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
          <p className="tagline">Anonymous chat for people on the same WiFi</p>

          <div className={`network-status ${networkReady && socketOk ? 'online' : networkReady ? 'partial' : 'offline'}`}>
            <span className="dot" />
            {!networkReady
              ? 'Connecting…'
              : socketOk
                ? 'Connected — ready to chat'
                : 'Server found, connecting live chat…'}
          </div>

          {networkReady && (
            <div className="status-checks">
              <span className={networkReady ? 'ok' : ''}>App {networkReady ? '✓' : '…'}</span>
              <span className={socketOk ? 'ok' : ''}>Live chat {socketOk ? '✓' : '…'}</span>
            </div>
          )}

          <label className="name-field">
            <span>Your anonymous name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
              maxLength={24}
            />
          </label>

          {lobbyError && <p className="error-text">{lobbyError}</p>}

          {isHostComputer && phoneUrl && screen === 'lobby' && (
            <div className="phone-help">
              <h3>📱 Open on your phone</h3>
              {isTunnel ? (
                <p>Works on <strong>any network</strong>. If you see a warning page, tap <strong>Continue</strong>.</p>
              ) : (
                <p>Same WiFi only. If it fails, run <code>./start-phone.sh</code> on laptop.</p>
              )}
              <div className="phone-url-row">
                <code>{phoneUrl}</code>
                <button type="button" className="btn-copy" onClick={copyPhoneUrl}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {showManual && screen === 'lobby' && (
            <div className="manual-connect">
              <p><strong>Phone not connecting?</strong> Paste the link from the laptop:</p>
              <div className="phone-url-row">
                <input
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="https://xxxx.loca.lt or http://192.168.1.5:3847"
                />
                <button type="button" className="btn-copy" onClick={() => connectToServer(manualUrl)}>
                  Go
                </button>
              </div>
            </div>
          )}

          {!isHostComputer && networkReady && screen === 'lobby' && (
            <div className="phone-help on-phone">
              <p>✓ You're on a phone/device. Connected to the host.</p>
            </div>
          )}

          {screen === 'lobby' && (
            <>
              <div className="rooms-section">
                <div className="rooms-header">
                  <h2>Rooms nearby</h2>
                  <span className="room-count-pill">{roomCount} active</span>
                </div>

                {availableRooms.length === 0 ? (
                  <div className="empty-rooms">
                    <p>No rooms yet on this network.</p>
                    <p className="hint-small">Create one and others will see it automatically.</p>
                  </div>
                ) : (
                  <ul className="room-list">
                    {availableRooms.map((room) => (
                      <li key={room.id} className="room-item">
                        <div className="room-info">
                          <strong>{room.name}</strong>
                          <span>{room.userCount} {room.userCount === 1 ? 'person' : 'people'} online</span>
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

              <button
                type="button"
                className="btn-primary btn-create"
                onClick={() => setScreen('create')}
              >
                + Create a room
              </button>
            </>
          )}

          {screen === 'create' && (
            <form onSubmit={handleCreateRoom} className="create-form">
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
              <div className="create-actions">
                <button type="button" onClick={() => setScreen('lobby')}>Back</button>
                <button type="submit" className="btn-primary">Create & join</button>
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
