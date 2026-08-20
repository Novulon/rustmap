const RustPlus = require('@liamcottle/rustplus.js');
const admin = require('firebase-admin');

const serviceAccount = require('./firebase-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://rust-live-af441-default-rtdb.firebaseio.com"
});
const db = admin.database();

let rustplus = null;
let teamInterval = null;

function cleanupConnection() {
  if (teamInterval) {
    clearInterval(teamInterval);
    teamInterval = null;
  }
  if (rustplus) {
    rustplus.removeAllListeners();
    try {
      rustplus.disconnect();
    } catch (e) {
      // Ignore disconnect errors on already closed sockets
    }
    rustplus = null;
  }
}

// Listen for dynamic server AND player credentials from Firebase
db.ref('target_server').on('value', (snapshot) => {
  const config = snapshot.val();
  
  if (!config || !config.ip || !config.port || !config.steamId || !config.playerToken) {
    console.log("Waiting for full server & player credentials from website UI...");
    return;
  }

  console.log(`Connecting to ${config.name || config.ip} (${config.ip}:${config.port}) using Steam ID: ${config.steamId}...`);

  cleanupConnection();

  rustplus = new RustPlus(config.ip, config.port, config.steamId, config.playerToken);

  rustplus.on('error', (err) => {
    console.error("RustPlus API Error:", err.message || err);
  });

  rustplus.on('disconnected', () => {
    console.log("Disconnected from Rust+ server.");
    cleanupConnection();
  });

  rustplus.on('connected', () => {
    console.log("Connected to Rust+ API!");

    // Fetch server map image & size
    rustplus.sendRequest({ getMap: {} }, (message) => {
      if (message && message.response && message.response.map) {
        const mapInfo = message.response.map;
        if (mapInfo.jpgImage) {
          db.ref('mapImage').set(mapInfo.jpgImage.toString('base64'));
        }
        if (mapInfo.width) {
          db.ref('mapSize').set(mapInfo.width);
        }
      }
    });

    // Poll team member locations every 2 seconds
    teamInterval = setInterval(() => {
      rustplus.getTeamInfo((data) => {
        if (data && data.response && data.response.teamInfo) {
          const members = data.response.teamInfo.members;
          const playerData = {};

          members.forEach(member => {
            playerData[member.steamId] = {
              name: member.name,
              x: member.x,
              z: member.y,
              isOnline: member.isOnline
            };
          });

          db.ref('live_session').set({
            serverInfo: {
              name: config.name,
              ip: config.ip,
              port: config.port
            },
            players: playerData
          });
        }
      });
    }, 2000);
  });

  rustplus.connect();
});