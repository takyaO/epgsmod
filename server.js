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
//const EPG_API_BASE = 'http://100.70.190.41:8888'; 

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

// 1. 予約リスト取得用プロキシ
app.post('/proxy/reserves', async (req, res) => {
    try {
        const { epgApiBase, type, limit } = req.body;
        // EPGStationのAPIを叩くURLを構築
        const targetUrl = `${epgApiBase}/api/reserves?type=${type}&limit=${limit}&isHalfWidth=false`;
        
        console.log(`Proxy fetching: ${targetUrl}`);
        
        // ★ axios.get を使用
        const apiRes = await axios.get(targetUrl);
        
        res.json(apiRes.data);
    } catch (error) {
        console.error("Proxy Error:", error.message);
        // axiosのエラーは error.response.status でステータスを取得できる場合がある
        res.status(500).json({ error: error.message });
    }
});

// 2. 予約削除用プロキシ
app.post('/proxy/reserves/delete', async (req, res) => {
    try {
        const { epgApiBase, reserveId } = req.body;
        const targetUrl = `${epgApiBase}/api/reserves/${reserveId}`;
        
        console.log(`Proxy deleting: ${targetUrl}`);

        // ★ axios.delete を使用
        const apiRes = await axios.delete(targetUrl);
        
        // axiosは成功時 status: 200, 204 など
        if (apiRes.status >= 200 && apiRes.status < 300) {
            res.status(200).send("OK");
        } else {
            // ここには通常到達しませんが、念のため
            res.status(apiRes.status).send("Failed");
        }
    } catch (error) {
        console.error("Proxy Delete Error:", error.message);
        // EPGStation側で404などが返された場合、axiosはエラーを投げるためここで処理
        res.status(500).json({ error: error.message });
    }
});

// 4. ルール一覧取得用プロキシ
app.post('/proxy/rules', async (req, res) => {
    try {
        const { epgApiBase } = req.body;
        // limitやoffsetが必要な場合はここで調整可能ですが、一旦全件取得(デフォルト)とします
        const targetUrl = `${epgApiBase}/api/rules?limit=0`; 
        
        console.log(`[Proxy] Fetching Rules: ${targetUrl}`);
        
        const apiRes = await axios.get(targetUrl);
        res.json(apiRes.data);
        
    } catch (error) {
        console.error("Proxy Rules Error:", error.message);
        if (axios.isAxiosError(error) && error.response) {
            res.status(error.response.status).json({ error: error.response.data.message || error.message });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// 5. ルール削除用プロキシ
app.post('/proxy/rules/delete', async (req, res) => {
    try {
        const { epgApiBase, ruleId } = req.body;
        const targetUrl = `${epgApiBase}/api/rules/${ruleId}`;
        
        console.log(`[Proxy] Deleting Rule: ${targetUrl}`);
        
        const apiRes = await axios.delete(targetUrl);
        
        if (apiRes.status >= 200 && apiRes.status < 300) {
            res.status(200).json({ success: true });
        } else {
            res.status(apiRes.status).json({ error: "Failed to delete" });
        }
    } catch (error) {
        console.error("Proxy Delete Rule Error:", error.message);
        if (axios.isAxiosError(error) && error.response) {
            res.status(error.response.status).json({ error: error.response.data.message || error.message });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// 6. ルール追加用プロキシ
app.post('/proxy/rules/add', async (req, res) => {
    try {
        const { epgApiBase, rulePayload } = req.body;
        const targetUrl = `${epgApiBase}/api/rules`; // EPGStationのAPI URL
        
        console.log(`[Proxy] Adding Rule: ${targetUrl}`);
        
        // EPGStationのAPIを叩く (POSTメソッドでデータを送信)
        const apiRes = await axios.post(targetUrl, rulePayload);
        
        // EPGStationの応答データには、作成されたルールのIDなどが含まれる
        res.json(apiRes.data);
        
    } catch (error) {
        console.error("Proxy Add Rule Error:", error.message);
        
        if (axios.isAxiosError(error) && error.response) {
            res.status(error.response.status).json({ 
                error: `EPGStation API Error: ${error.response.statusText}`,
                details: error.response.data
            });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
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

