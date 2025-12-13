function extractProgram(fileName) {
    let BASENAME = fileName;
    let PROGRAM = BASENAME;
    let EPISODE = "";
    
    // 区切り文字の優先順位リスト
    const delimiterOrder = ["＃", "♯", "#", "第", "最終回", "最終話", "最終首", "(", "（", "話", "★", "☆", "▼", "◆", "▽", "【", "「", "["];

    // 区切り文字と対応するセカンドデリミタを定義 (Mapを使用)
    const delimiterPairs = new Map([
        ["話", ""], ["＃", "！"], ["♯", ""], ["#", ""], ["第", ""],
        ["最終回", ""], ["最終話", ""], ["最終首", ""], ["(", ")"], ["（", "）"],
        ["★", ""], ["☆", ""], ["▼", ""], ["▽", ""], ["◆", ""],
        [" ", ""], ["【", "】"], ["「", "」"], ["『", "』"],
        ["[", "."]
    ]);

    // 3. FILENAMEの整形 (先頭文字列削除)
    let FILENAME = BASENAME
        .replace(/^\[[^\]]+\]/, '') // 先頭の [字] などを削除 (一度目)
        .replace(/^\[[^\]]+\]/, '') // 先頭の [字] などを削除 (二度目、Bashロジックに合わせる)
        .replace(/^【[^】]*】/, '') // 【夜ドラ】 などを削除
        .replace(/^＜[^＞]*＞/, '') 
        .replace(/^[＃#]/, '') 
        .replace(/^時代劇[ \s]*/, '')
        .replace(/^映画の時間[ \s]*/, '')
        .replace(/^映画[ \s]*/, '')
        .replace(/^金曜ロードショー[ \s]*/, '')
        .replace(/^午後ロー[ \s]*/, '')
        .replace(/^土曜プレミアム・映画[ \s]*/, '')
        .replace(/^プチプチ・アニメ[ \s]*/, '')
        .replace(/^ミニアニメ[ \s]*/, '')
        .replace(/^ドラマブレイク[ \s]*/, '')
        .replace(/^大河ドラマ[ \s]*/, '')
        .replace(/^台湾ドラマ[ \s]*/, '')
        .replace(/^韓流朝ドラ６[ \s]*/, '')
        .replace(/^日曜ミステリー[ \s]*/, '')
        .replace(/^連続テレビ小説[ \s]*/, '');

    // 4. 区切り文字の検索
    let foundDelimiter = "";
    for (const delimiter of delimiterOrder) {
        if (FILENAME.includes(delimiter)) {
            foundDelimiter = delimiter;
            break;
        }
    }

    // 5. 区切り文字による分割処理
    if (foundDelimiter) {
        const delimiter = foundDelimiter;

        if (delimiter === "話") {
            // 「数字+話」で分割 (全角・半角数字対応)
            // Bashの =~ ([０-９0-9]{1,2}話) に相当
            const match = FILENAME.match(/([０-９0-9]{1,2}話)/);
            
            if (match) {
                const pos = match[0]; // 例: "２話"
                const index = FILENAME.indexOf(pos);
                PROGRAM = FILENAME.substring(0, index);
                EPISODE = pos;
            } else {
//                // 「話」の前が数字でない場合
//                if (FILENAME.includes("話")) {
//                    const temp = FILENAME.slice(0, FILENAME.lastIndexOf("話"));
//                    PROGRAM = temp.slice(0, -1);
//                    EPISODE = FILENAME.substring(PROGRAM.length);
                    PROGRAM = FILENAME
//                }
            }
        } else {
            // その他デリミタによる分割
            const index = FILENAME.indexOf(delimiter);
            PROGRAM = FILENAME.substring(0, index);
            let rest = FILENAME.substring(index + delimiter.length);
            
            const secondDelimiter = delimiterPairs.get(delimiter);

            if (secondDelimiter && rest.includes(secondDelimiter)) {
                EPISODE = rest.substring(0, rest.indexOf(secondDelimiter));
            } else {
                EPISODE = rest;
            }
	    
            if (["第", "[", "最終回", "最終話", "最終首"].includes(delimiter)) {
                EPISODE = delimiter + EPISODE;
            }
        }
    } else {
        PROGRAM = FILENAME;
    }

    // 6. PROGRAMの整理とORIGINALの準備
    // ORIGINAL = PROGRAMから [字] などを削除
    let ORIGINAL = PROGRAM
        .replace(/\[.*$/, ''); // [以降を削除

    let extractedProgram = "";
    const regexChecks = [
        // ドラマ「タイトル」
        { pattern: /ドラマ[^「『]*[「『]([^」』]+)[」』]/, type: 'series' },
        { pattern: /ドラ[「『]([^」』]+)[」』]/, type: 'series' },
        // サスペンス「タイトル」
        { pattern: /サスペンス[^「『]*[「『]([^」』]+)[」』]/, type: 'series' },
        // 劇場「タイトル」
        { pattern: /劇場[^「『]*[「『]([^」』]+)[」』]/, type: 'series' },
        // ミステリー「タイトル」
        { pattern: /ミステリー[^「『]*[「『]([^」』]+)[」』]/, type: 'series' },
        // 「タイトル」から始まる
        { pattern: /^[「『]([^」』]+)[」』]/, type: 'series' },
        // アニメ「タイトル」
        { pattern: /アニメ[^「『]*[「『]([^」』]+)[」』]/, type: 'series' },
        // 日５「タイトル」
        { pattern: /日５[^「『]*[「『]([^」』]+)[」』]/, type: 'series' },
    ];
    
    // 7. ヒューリスティックな抽出
    for (const check of regexChecks) {
        const match = ORIGINAL.match(check.pattern);
        if (match) {
            extractedProgram = match[1];
            break;
        }
    }

   // 8. フォールバック処理
    if (extractedProgram) {
        PROGRAM = extractedProgram;
    } else {
        // sedによるフォールバック処理をJSのreplaceで再現
        PROGRAM = ORIGINAL
            .replace(/【[^】]*】/g, '') // 【タイトル】の対タグを削除 (Bash -e 's/【[^】]*】//g')
            .replace(/＜[^＞]*＞/g, '') // ＜タイトル＞
            .replace(/[「『][^」』]*[」』].*/g, '') // 「タイトル」以降を削除
            .replace(/◆.*$/, '')
            .replace(/▼.*$/, '')
            .replace(/▽.*$/, '')
            .replace(/^アニメ/, '') // 先頭の "アニメ" を削除
            // ★ 修正/確認: 残った全ての【を削除する
            .replace(/[【】]/g, '') // Bash: -e 's/【//g' に相当
            
            // Bash: 前後の空白削除 + 最初のスペース以降を削除
            .trim()
            .replace(/★.*$/,"")
	    .replace(/「.*$/, '');
//            .replace(/[ \s].*$/, ''); 
    }

    // 9. EPISODEの整理
    EPISODE = EPISODE
        .replace(/\[[^\]]*\]/g, '') // [字] などを削除
        .replace(/__.*$/, ''); // __以降を削除

    // 10. 却下するPROGRAM名の判定と置換
    const MATCH_LIST = ["アニメ", "ミニアニメ", "サスペンス"];
    
    // PROGRAMが空、またはMATCH_LISTに含まれる場合はEPISODEに置換
    if (!PROGRAM || MATCH_LIST.includes(PROGRAM)) {
        PROGRAM = EPISODE;
    }
    
    // 最終的な戻り値はPROGRAM（改行を含まない文字列）
    return PROGRAM;
    }
