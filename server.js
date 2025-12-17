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
//const PORT = 3001;
// 環境変数 PORT が設定されていればそれを使用し、なければ 3001 をデフォルトとして使用する
const PORT = process.env.PORT || 3001;
const { URL } = require('url');

app.use(express.json());

// public 配信
app.use(express.static(path.join(__dirname, 'public')));

// =========================
// 検索 API プロキシ
// =========================
app.post('/proxy/search', function(req, res) {
    // ★ 修正: クライアントのペイロードから EPG URLを取得
    const clientEpgApiBase = req.body.epgApiBase;
    if (!isAllowedEpgApiBase(clientEpgApiBase)) {
        console.error(`SSRF Risk Detected: ${clientEpgApiBase}`);
        return res.status(403).json({ error: "指定されたEPG API URLは許可されていません。" });
    }
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
    if (!isAllowedEpgApiBase(clientEpgApiBase)) {
        console.error(`SSRF Risk Detected: ${clientEpgApiBase}`);
        return res.status(403).json({ error: "指定されたEPG API URLは許可されていません。" });
    }
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
        const {
            epgApiBase,
            startAt,
            endAt,
            type,
	    limit,
            isHalfWidth = false
        } = req.body;

        if (!isAllowedEpgApiBase(epgApiBase)) {
            console.error(`SSRF Risk Detected in /proxy/reserves: ${epgApiBase}`);
            return res.status(403).json({ error: "指定されたEPG API URLは許可されていません。" });
        }

        const params = new URLSearchParams({
            isHalfWidth: isHalfWidth,
        });

        if (startAt) params.append('startAt', startAt);
        if (endAt)   params.append('endAt', endAt);
        if (type)    params.append('type', type); 
        if (limit)    params.append('limit', limit); 

        const targetUrl = `${epgApiBase}/api/reserves?${params.toString()}`;

        console.log(`Proxy fetching reserves: ${targetUrl}`);

        const apiRes = await axios.get(targetUrl);

        res.json(apiRes.data);
    } catch (error) {
        console.error("Proxy reserves Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 2. 予約削除用プロキシ
app.post('/proxy/reserves/delete', async (req, res) => {
    try {
        const { epgApiBase, reserveId } = req.body;
	if (!isAllowedEpgApiBase(epgApiBase)) {
            console.error(`SSRF Risk Detected in /proxy/rules: ${epgApiBase}`);
            return res.status(403).json({ error: "指定されたEPG API URLは許可されていません。" });
        }
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

// 4. ルール一覧取得用プロキシ (予約数カウント機能付き)
app.post('/proxy/rules', async (req, res) => {
    try {
        const { epgApiBase } = req.body;
	if (!isAllowedEpgApiBase(epgApiBase)) {
            console.error(`SSRF Risk Detected in /proxy/rules: ${epgApiBase}`);
            return res.status(403).json({ error: "指定されたEPG API URLは許可されていません。" });
        }
        
        console.log(`[Proxy] Fetching Rules & Reserves count...`);

        // ルール一覧と、予約一覧(全件取得に近い状態)を並列で取得
        const [rulesRes, reservesRes] = await Promise.all([
            // 1. ルール取得: limit=0 (全件)
            axios.get(`${epgApiBase}/api/rules?limit=0`),
            
            // 2. 予約取得: limit=9999, type=normal に加え、isHalfWidth=true を追加 ★★★
            axios.get(`${epgApiBase}/api/reserves?limit=9999&type=normal&isHalfWidth=true`) 
        ]);

        const rules = rulesRes.data.rules || rulesRes.data;
        const reserves = reservesRes.data.reserves || reservesRes.data;

        // --- 集計処理 ---
        const countMap = {};
        reserves.forEach(r => {
            if (r.ruleId) {
                countMap[r.ruleId] = (countMap[r.ruleId] || 0) + 1;
            }
        });

        // ルールリストに reservesCnt を付与して新しい配列を作成
        const enrichedRules = rules.map(rule => {
            return {
                ...rule,
                reservesCnt: countMap[rule.id] || 0
            };
        });

        // クライアントへ返す
        res.json({ rules: enrichedRules });
        
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
	if (!isAllowedEpgApiBase(epgApiBase)) {
            console.error(`SSRF Risk Detected in /proxy/rules: ${epgApiBase}`);
            return res.status(403).json({ error: "指定されたEPG API URLは許可されていません。" });
        }
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
	if (!isAllowedEpgApiBase(epgApiBase)) {
            console.error(`SSRF Risk Detected in /proxy/rules: ${epgApiBase}`);
            return res.status(403).json({ error: "指定されたEPG API URLは許可されていません。" });
        }
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

/**
 * EPG API URLが安全な（プライベートネットワークまたは許可されたホスト）
 * IPアドレスまたはホスト名を使用しているかチェックする。
 * @param {string} url - クライアントから渡されたAPI URL
 * @returns {boolean} - 許可されていれば true
 */
function isAllowedEpgApiBase(url) {
    if (!url) return false;

    try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname;

        // 1. 許可するホスト名のリスト
        const allowedHosts = [
            'localhost',
            '127.0.0.1',
            // EPGStationの公式なホスト名などがあればここに追加
        ];
        if (allowedHosts.includes(hostname)) {
            return true;
        }

        // 2. プライベートIPアドレス範囲のチェック (正規表現)
        // 以下のプライベートIP範囲は、IETF RFC 1918 (IPv4) および IETF RFC 6890 (特別なアドレス) に基づいています。
        
        // 正規表現は文字列として定義
        const privateIpRanges = [
            // RFC 1918 (標準プライベートIP)
            /^192\.168\./,       // Class C: 192.168.0.0/16
            /^10\./,             // Class A: 10.0.0.0/8
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B: 172.16.0.0/12
            
            // TailscaleのIP範囲 (CGNAT 100.64.0.0/10 の一部を使用)
            /^100\.(6[4-9]|[7-9][0-9]|1[0-2][0-7])\./, // 100.64.0.0/10 (厳密には 100.64.0.0 から 100.127.255.255)
                                                      // ここでは範囲の先頭部分をカバー
            
            // その他の特殊/ローカルループバック
            /^127\./,            // ループバック: 127.0.0.0/8
            /^(0|169\.254)\./,   // 0.0.0.0/8, 169.254.0.0/16 (Link-Local)
        ];

        // IPアドレスとして有効かチェック
        if (privateIpRanges.some(regex => regex.test(hostname))) {
            return true;
        }

    } catch (e) {
        // URLが不正な形式の場合
        console.error("URL解析エラー:", e.message);
    }

    return false;
}

// =========================
// 起動
// =========================
app.listen(PORT, '0.0.0.0', function() {
  console.log('-------------------------------------------');
  console.log('Server running at: http://localhost:' + PORT);
  console.log('Target EPGStation: クライアント側で設定'); 
  console.log('-------------------------------------------');
});

