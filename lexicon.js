// =========================================================================
// 西班牙文全構詞詞素資料庫 - 雙軌讀取版（優先讀取 backups/lexicon(local).js + 背景同步 Google Sheets）
// =========================================================================
const MORPHEMES_CSV_URL = "https://docs.google.com/spreadsheets/d/1Y5Tdp5xYBfuhEtIuLNTG0HJQW5sD5SWQ8TofVxwNOHk/gviz/tq?tqx=out:csv&sheet=MORPHEMES";
const WORDS_CSV_URL = "https://docs.google.com/spreadsheets/d/1Y5Tdp5xYBfuhEtIuLNTG0HJQW5sD5SWQ8TofVxwNOHk/gviz/tq?tqx=out:csv&sheet=WORDS";

(function initDualLexicon() {
  const CACHE_KEY = "es_lexicon_sheets_cache_v3";

  // 1. 保留由 <script src="backups/lexicon(local).js"></script> 載入的本地資料
  window.MORPHEMES = Array.isArray(window.MORPHEMES) ? window.MORPHEMES : [];
  window.WORDS = Array.isArray(window.WORDS) ? window.WORDS : [];

  // 2. 若瀏覽器有比本地檔更新的雲端快取，先用快取秒開
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (cached && Array.isArray(cached.morphemes) && cached.morphemes.length && Array.isArray(cached.words) && cached.words.length) {
      window.MORPHEMES = cached.morphemes;
      window.WORDS = cached.words;
    }
  } catch (e) {}

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    const cleanText = String(text || "").replace(/^\uFEFF/, "");

    for (let i = 0; i < cleanText.length; i++) {
      const ch = cleanText[i];
      const next = cleanText[i + 1];
      if (inQuotes) {
        if (ch === '"' && next === '"') { field += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { field += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { row.push(field.trim()); field = ""; }
        else if (ch === '\r' && next === '\n') { row.push(field.trim()); rows.push(row); row = []; field = ""; i++; }
        else if (ch === '\n' || ch === '\r') { row.push(field.trim()); rows.push(row); row = []; field = ""; }
        else { field += ch; }
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field.trim());
      rows.push(row);
    }
    return rows.filter(r => r.some(cell => cell !== ""));
  }

  async function syncFromGoogleSheets() {
    try {
      const cacheBuster = (url) => url + (url.includes("?") ? "&" : "?") + "_t=" + Date.now();
      const [mRes, wRes] = await Promise.all([
        fetch(cacheBuster(MORPHEMES_CSV_URL)),
        fetch(cacheBuster(WORDS_CSV_URL))
      ]);
      if (!mRes.ok || !wRes.ok) return;

      const [mText, wText] = await Promise.all([mRes.text(), wRes.text()]);
      const mRows = parseCSV(mText);
      const wRows = parseCSV(wText);

      const parsedMorphemes = mRows.slice(1)
        .filter(r => r[0] && r[2])
        .map(r => [r[0] || "", r[1] || "root", r[2] || "", r[3] || "", r[4] || ""]);

      const parsedWords = wRows.slice(1)
        .filter(r => r[0])
        .map(r => {
          const mIds = (r[3] || "").split(/[,，、;；]+/).map(s => s.trim()).filter(Boolean);
          const customBrk = (r[4] || "").trim();
          return customBrk
            ? [r[0], r[1] || "", r[2] || "", mIds, customBrk]
            : [r[0], r[1] || "", r[2] || "", mIds];
        });

      if (parsedMorphemes.length > 0 && parsedWords.length > 0) {
        const prev = JSON.stringify({ m: window.MORPHEMES, w: window.WORDS });
        const next = JSON.stringify({ m: parsedMorphemes, w: parsedWords });

        window.MORPHEMES = parsedMorphemes;
        window.WORDS = parsedWords;
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          morphemes: parsedMorphemes,
          words: parsedWords,
          updatedAt: Date.now()
        }));

        if (prev !== next) {
          window.dispatchEvent(new CustomEvent("lexiconUpdated"));
        }
      }
    } catch (err) {
      console.warn("Google Sheets 背景同步略過，使用本地資料：", err);
    }
  }

  window.LEXICON_READY = syncFromGoogleSheets();
})();
