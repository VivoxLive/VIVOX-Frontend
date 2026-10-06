const API_BASE = "https://vivox-backend.onrender.com";

/* =========================
   VIVOX AUTH + PROFILE
   ========================= */

function showAuth(mode) {
  $("loginForm").classList.toggle("hidden", mode !== "login");
  $("signupForm").classList.toggle("hidden", mode !== "signup");
  $("authMessage").textContent = "";
}

function previewProfile(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  $("photoPreview").src = url;
  $("photoPreview").classList.remove("hidden");
}

function signupUser() {
  const name = $("signupName").value.trim();
  const username = $("signupUsername").value.trim().replace(/^@/, "");
  const email = $("signupEmail").value.trim().toLowerCase();
  const password = $("signupPassword").value;
  const confirm = $("signupConfirm").value;
  const photo = $("signupPhoto").files[0];

  if (!name || !username || !email || !password || !confirm) {
    $("authMessage").textContent = "Please fill all required details.";
    return;
  }

  if (password.length < 6) {
    $("authMessage").textContent =
      "Password must be at least 6 characters.";
    return;
  }

  if (password !== confirm) {
    $("authMessage").textContent =
      "Passwords do not match.";
    return;
  }

  const users =
    JSON.parse(localStorage.getItem("vivoxUsers") || "[]");

  if (users.some(u => u.email === email)) {
    $("authMessage").textContent =
      "This email is already registered.";
    return;
  }

  const user = {
    name: name,
    username: username,
    email: email,
    password: password,
    photo: null,
    followers: [],
    following: [],
    moments: []
  };

  if (photo) {
    const reader = new FileReader();

    reader.onload = function () {
      user.photo = reader.result;
      saveVivoUser(user);
    };

    reader.readAsDataURL(photo);
  } else {
    saveVivoUser(user);
  }
}

function saveVivoUser(user) {
  const users =
    JSON.parse(localStorage.getItem("vivoxUsers") || "[]");

  users.push(user);

  localStorage.setItem(
    "vivoxUsers",
    JSON.stringify(users)
  );

  localStorage.setItem(
    "vivoxCurrentUser",
    JSON.stringify(user)
  );

  applyVivoProfile(user);
  enter();
}

function loginUser() {
  const email =
    $("loginEmail").value.trim().toLowerCase();

  const password =
    $("loginPassword").value;

  const users =
    JSON.parse(localStorage.getItem("vivoxUsers") || "[]");

  const user = users.find(
    u => u.email === email && u.password === password
  );

  if (!user) {
    $("authMessage").textContent =
      "Email or password is incorrect.";
    return;
  }

  localStorage.setItem(
    "vivoxCurrentUser",
    JSON.stringify(user)
  );

  applyVivoProfile(user);
  enter();
}

function applyVivoProfile(user) {
  if (!user) return;

  if ($("profileName")) {
    $("profileName").textContent =
      (user.name || "VIVOX User") + " 👑";
  }

  if ($("profileAvatar")) {
    $("profileAvatar").textContent =
      (user.name || "A").charAt(0).toUpperCase();
  }

  if (user.photo && $("profileAvatarImg")) {
    $("profileAvatarImg").src = user.photo;
    $("profileAvatarImg").classList.remove("hidden");

    if ($("profileAvatar")) {
      $("profileAvatar").classList.add("hidden");
    }
  }
}

function showProfileEdit() {
  go("profile");
}


/* =========================
   VIVOX LIVEKIT
   ========================= */

let room = null;
let localTracks = [];
let currentRoom = "vivox-main";
let role = "viewer";

const $ = id =>
  document.getElementById(id);

const pages = [
  "home",
  "live",
  "viewer",
  "wallet",
  "profile"
];


/* =========================
   ENTER APP
   ========================= */

function enter() {
  $("auth").classList.add("hidden");
  $("app").classList.remove("hidden");
}


/* =========================
   NAVIGATION
   ========================= */

function go(id) {
  pages.forEach(x => {
    const el = $(x);

    if (el) {
      el.classList.toggle(
        "hidden",
        x !== id
      );
    }
  });

  if (id === "live") {
    startPreview();
  }
}




/* =========================
   HOME TABS
   ========================= */
function setHomeTab(name){
  document.querySelectorAll('.tabs .tab').forEach(b=>b.classList.remove('active'));
  const map={forYou:'tabForYou',live:'tabLive',following:'tabFollowing',ranking:'tabRanking'};
  const el=$(map[name]); if(el) el.classList.add('active');
}

function homeTab(name){
  setHomeTab(name);
  if(name==='forYou'){ go('home'); window.scrollTo({top:0,behavior:'smooth'}); return; }
  if(name==='live'){ go('live'); return; }
  if(name==='following'){ showFollowing(); return; }
  if(name==='ranking'){ showRanking(); return; }
}

function showRanking(){
  const list=['👑 Angela — 36.6K','🥈 Aysha — 24.8K','🥉 Mike — 18.4K'];
  alert('🏆 VIVOX Ranking\n\n'+list.join('\n'));
}

/* =========================
   LIVEKIT TOKEN
   ========================= */

async function getToken(
  roomName,
  participantRole
) {
  const r = await fetch(
      API_BASE + "/api/livekit/token",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        room: roomName,

        identity:
          "user-" +
          Math.random()
            .toString(36)
            .slice(2),

        name: "VIVOX User",

        role: participantRole
      })
    }
  );

  const data = await r.json();

  if (!r.ok) {
    throw new Error(
      data.error || "Token error"
    );
  }

  return data;
}


/* =========================
   CAMERA PREVIEW
   ========================= */

async function startPreview() {
  if (localTracks.length) return;

  try {
    localTracks =
      await LivekitClient.createLocalTracks({
        audio: true,
        video: true
      });

    const v = $("local");

    if (v) {
      v.srcObject =
        new MediaStream(
          localTracks.map(
            t => t.mediaStreamTrack
          )
        );
    }

  } catch (e) {

    if ($("info")) {
      $("info").textContent =
        "Camera/Mic permission required. Use HTTPS or localhost.";
    }
  }
}


/* =========================
   START / STOP LIVE
   ========================= */

async function toggleLive() {

  await startPreview();

  if (!localTracks.length) return;

  if (room) {

    await room.disconnect();

    room = null;

    $("liveBtn").textContent =
      "📡 Start Live";

    return;
  }

  try {

    const data =
      await getToken(
        currentRoom,
        "host"
      );

    // The backend creates a unique live-room ID for each broadcast.
    if (data.liveRoom && data.liveRoom.id) {
      currentRoom = data.liveRoom.id;
    }

    room =
      new LivekitClient.Room({
        adaptiveStream: true,
        dynacast: true
      });

    room.on(
      LivekitClient.RoomEvent.ParticipantConnected,
      () => {}
    );

    room.on(
      LivekitClient.RoomEvent.Disconnected,
      () => {
        room = null;
      }
    );

    await room.connect(
      data.serverUrl,
      data.participantToken
    );

    for (const track of localTracks) {

      await room.localParticipant
        .publishTrack(track);
    }

    $("liveBtn").textContent =
      "🔴 Live Now";

    $("info").textContent =
      "VIVOX live room is running through the SFU.";

  } catch (e) {

    $("info").textContent =
      "LiveKit connection failed: " +
      e.message;
  }
}


/* =========================
   WATCH LIVE
   ========================= */

async function watch(title) {

  $("title").textContent = title;

  go("viewer");

  try {

    if (room) {
      await room.disconnect();
      room = null;
    }

    // Find the currently live room instead of using the old static room name.
    const listResponse = await fetch(API_BASE + "/api/live-rooms");
    const listData = await listResponse.json();
    const rooms = Array.isArray(listData.rooms) ? listData.rooms : [];
    const wanted = rooms.find(r => r.title === title) || rooms[0];
    if (!wanted) throw new Error("No live room is currently available.");
    currentRoom = wanted.id;

    const data =
      await getToken(
        currentRoom,
        "viewer"
      );

    room =
      new LivekitClient.Room({
        adaptiveStream: true,
        dynacast: true
      });

    room.on(
      LivekitClient.RoomEvent.TrackSubscribed,
      track => attachRemote(track)
    );

    room.on(
      LivekitClient.RoomEvent.DataReceived,
      (payload, participant) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload));
          const who = participant?.identity || "User";
          if (msg.type === "chat") {
            $("chat").innerHTML += "<div class=\"msg\"><b>" + safe(who) + ":</b> " + safe(msg.text || "") + "</div>";
          } else if (msg.type === "gift") {
            $("chat").innerHTML += "<div class=\"msg\">🎁 <b>" + safe(who) + "</b> sent a gift</div>";
          }
          $("chat").scrollTop = $("chat").scrollHeight;
        } catch (_) {}
      }
    );

    room.on(
      LivekitClient.RoomEvent.Disconnected,
      () => {
        room = null;
      }
    );

    await room.connect(
      data.serverUrl,
      data.participantToken
    );

  } catch (e) {

    $("chat").innerHTML +=
      "<br>SFU connection error: " +
      safe(e.message);
  }
}


/* =========================
   REMOTE VIDEO
   ========================= */

function attachRemote(track) {

  if (track.kind === "video") {

    const el =
      track.attach();

    el.autoplay = true;
    el.playsInline = true;
    el.className = "remoteVideo";
    el.id = "remote";

    $("remote").replaceWith(el);

  } else if (track.kind === "audio") {

    track.attach();
  }
}


/* =========================
   CHAT
   ========================= */

function chatSend() {

  const v =
    $("msg").value.trim();

  if (!v) return;

  $("chat").innerHTML +=
    "<br><b>You:</b> " +
    safe(v);

  $("msg").value = "";

  if (room) {

    room.localParticipant.publishData(
      new TextEncoder().encode(
        JSON.stringify({
          type: "chat",
          text: v
        })
      ),
      "reliable"
    );
  }
}


/* =========================
   GIFT
   ========================= */

function gift() {

  $("chat").innerHTML +=
    "<br>🎁 You sent a Gift";

  if (room) {

    room.localParticipant.publishData(
      new TextEncoder().encode(
        JSON.stringify({
          type: "gift",
          gift: "🎁"
        })
      ),
      "reliable"
    );
  }
}


/* =========================
   SECURITY
   ========================= */

function safe(s) {

  return String(s).replace(
    /[&<>"']/g,

    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[c])
  );
}


/* =========================
   LOAD CURRENT USER
   ========================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const user =
      JSON.parse(
        localStorage.getItem(
          "vivoxCurrentUser"
        ) || "null"
      );

    if (user) {
      applyVivoProfile(user);
    }
  }
);