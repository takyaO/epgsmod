// server.js
process.on("uncaughtException", err => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", err => {
  console.error("UNHANDLED REJECTION:", err);
});

const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

const PORT = 3001;

app.use(express.json());

// public 配信
app.use(express.static(path.join(__dirname, 'public')));

// =========================
// 検索 API プロキシ
// =========================
app.post('/proxy/search', function(req, res) {
    // ★ 修正: クライアントのペイロードから EPG URLを取得
    const clientEpgApiBase = req.body.epgApiBase;
    const bodyForEpgstation = { ...req.body };
    delete bodyForEpgstation.epgApiBase; // EPGStationへは渡さない

    if (!clientEpgApiBase) {
        return res.status(400).json({ error: "EPG API URLが指定されていません" });
    }

    axios.post(clientEpgApiBase + '/api/schedules/search', bodyForEpgstation)
        .then(function(r){
            res.json(r.data);
        })
        .catch(function(e){
            // ... (エラー処理)
            res.status(500).json({ error: "EPGStation への接続に失敗しました" });
        });
});

// =========================
// ルール追加 API
// =========================
app.post('/proxy/rule', function(req, res) {
    // ★ 修正: クライアントのペイロードから EPG URLを取得
    const clientEpgApiBase = req.body.epgApiBase;
    const bodyForEpgstation = { ...req.body };
    delete bodyForEpgstation.epgApiBase; // EPGStationへは渡さない

    if (!clientEpgApiBase) {
        return res.status(400).json({ error: "EPG API URLが指定されていません" });
    }
    
    axios.post(clientEpgApiBase + '/api/rules/keyword', bodyForEpgstation)
        .then(function(r){
            res.json(r.data);
        })
        .catch(function(e){
            // ... (エラー処理)
            res.status(500).json({ error: "ルールの追加に失敗しました" });
        });
});


// =========================
// 起動
// =========================
app.listen(PORT, '0.0.0.0', function() {
  console.log('-------------------------------------------');
  console.log('Server running at: http://localhost:' + PORT);
  console.log('Target EPGStation: クライアント側で設定'); 
  console.log('-------------------------------------------');
});

