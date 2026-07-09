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

function getServerUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('server')) return params.get('server');
  if (import.meta.env.DEV) return '';
  return window.location.origin;
}

export default function App() {
  const [screen, setScreen] = useState('join'); // join | chat
  const [roomId, setRoomId] = useState('');
  const [displayName, setDisplayName] = useState(() => randomName());
  const [myId, setMyId] = useState(null);
  const [users, setUsers] = useState([]);
  const [openMessages, setOpenMessages] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState({ incoming: [], outgoing: [] });
  const [dms, setDms] = useState({});
  const [tab, setTab] = useState('open'); // open | people | dms
  const [dmWith, setDmWith] = useState(null);
  const [openInput, setOpenInput] = useState('');
  const [dmInput, setDmInput] = useState('');
  const [requestTarget, setRequestTarget] = useState(null);
  const [requestIntro, setRequestIntro] = useState('');
  const [serverInfo, setServerInfo] = useState(null);
  const [connected, setConnected] = useState(false);

  const socketRef = useRef(null);
  const myIdRef = useRef(null);
  const openEndRef = useRef(null);
  const dmEndRef = useRef(null);

  useEffect(() => {
    fetch(`${getServerUrl()}/api/info`)
      .then((r) => r.json())
      .then(setServerInfo)
      .catch(() => {});
  }, []);

  useEffect(() => {
    openEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [openMessages]);

  useEffect(() => {
    dmEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dms, dmWith]);

  const applyState = useCallback((state, selfId) => {
    setUsers(state.users || []);
    setOpenMessages(state.openMessages || []);
    setFriends(state.friends || []);
    setFriendRequests(state.friendRequests || { incoming: [], outgoing: [] });
    setDms(state.dms || {});
    if (selfId) setMyId(selfId);
  }, []);

  const joinRoom = (e) => {
    e.preventDefault();
    const room = roomId.trim();
    const name = displayName.trim();
    if (!room || !name) return;

    const url = getServerUrl();
    const socket = io(url || undefined, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join', { roomId: room, displayName: name });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('joined', ({ userId }) => {
      myIdRef.current = userId;
      setMyId(userId);
      setScreen('chat');
    });

    socket.on('state', (state) => {
      applyState(state, myIdRef.current);
    });

    socket.on('open-message', (msg) => {
      setOpenMessages((prev) => [...prev, msg]);
    });

    socket.on('dm-message', ({ withUserId, message }) => {
      setDms((prev) => ({
        ...prev,
        [withUserId]: [...(prev[withUserId] || []), message],
      }));
    });

    socket.on('error', ({ message }) => alert(message));
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

  const networkUrl = serverInfo?.ips?.[0]
    ? `http://${serverInfo.ips[0]}:${serverInfo?.port || 3847}`
    : null;

  if (screen === 'join') {
    return (
      <div className="join-screen">
        <div className="join-card">
          <div className="logo">📡</div>
          <h1>Nearby</h1>
          <p className="tagline">Anonymous chat for people on the same WiFi</p>

          <form onSubmit={joinRoom}>
            <label>
              <span>WiFi / Room name</span>
              <input
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="e.g. cafe-wifi, library-5g"
                autoFocus
                required
              />
            </label>
            <label>
              <span>Your anonymous name</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name"
                maxLength={24}
                required
              />
            </label>
            <button type="submit" className="btn-primary">
              Join room
            </button>
          </form>

          {networkUrl && (
            <div className="network-hint">
              <p>Share with others on your WiFi:</p>
              <code>{networkUrl}</code>
              <p className="hint-small">Use the same room name on every device.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const dmUser = dmWith ? userById(dmWith) : null;
  const pendingCount = friendRequests.incoming.length;

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Nearby</h1>
          <span className="room-badge">#{roomId}</span>
        </div>
        <div className={`status ${connected ? 'on' : 'off'}`}>
          {connected ? `${users.length} nearby` : 'Reconnecting…'}
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
              <h3>On this network ({users.length})</h3>
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
                <p className="empty">You're the only one here. Share the WiFi URL so others can join!</p>
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
