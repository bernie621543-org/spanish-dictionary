// =========================================================================
// 西班牙文全構詞詞素資料庫 - Google Sheets 雲端即時讀取版
// =========================================================================
const MORPHEMES_CSV_URL = "https://docs.google.com/spreadsheets/d/1Y5Tdp5xYBfuhEtIuLNTG0HJQW5sD5SWQ8TofVxwNOHk/gviz/tq?tqx=out:csv&sheet=MORPHEMES";
const WORDS_CSV_URL = "https://docs.google.com/spreadsheets/d/1Y5Tdp5xYBfuhEtIuLNTG0HJQW5sD5SWQ8TofVxwNOHk/gviz/tq?tqx=out:csv&sheet=WORDS";

(function initPureCloudLexicon() {
  window.MORPHEMES = [];
  window.WORDS = [];

  // 標準 RFC 4180 CSV 解析器（支援欄位內含逗號、換行與雙引號）
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
        if (ch === '"' && next === '"') {
          field += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          row.push(field.trim());
          field = "";
        } else if (ch === '\r' && next === '\n') {
          row.push(field.trim());
          rows.push(row);
          row = [];
          field = "";
          i++;
        } else if (ch === '\n' || ch === '\r') {
          row.push(field.trim());
          rows.push(row);
          row = [];
          field = "";
        } else {
          field += ch;
        }
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field.trim());
      rows.push(row);
    }
    return rows.filter(r => r.some(cell => cell !== ""));
  }

  async function loadFromGoogleSheets() {
    if (!MORPHEMES_CSV_URL || !WORDS_CSV_URL) {
      console.warn("尚未填入 MORPHEMES_CSV_URL 或 WORDS_CSV_URL，無法從雲端載入資料。");
      return;
    }
    try {
      const cacheBuster = (url) => url + (url.includes("?") ? "&" : "?") + "_t=" + Date.now();
      const [mRes, wRes] = await Promise.all([
        fetch(cacheBuster(MORPHEMES_CSV_URL)),
        fetch(cacheBuster(WORDS_CSV_URL))
      ]);
      if (!mRes.ok || !wRes.ok) {
        throw new Error(`HTTP 錯誤: MORPHEMES(${mRes.status}), WORDS(${wRes.status})`);
      }

      const [mText, wText] = await Promise.all([mRes.text(), wRes.text()]);
      const mRows = parseCSV(mText);
      const wRows = parseCSV(wText);

      // 略過標題列 (row 0)
      window.MORPHEMES = mRows.slice(1)
        .filter(r => r[0] && r[2])
        .map(r => [
          r[0] || "",
          r[1] || "root",
          r[2] || "",
          r[3] || "",
          r[4] || ""
        ]);

      window.WORDS = wRows.slice(1)
        .filter(r => r[0])
        .map(r => {
          const mIds = (r[3] || "")
            .split(/[,，、;；]+/)
            .map(s => s.trim())
            .filter(Boolean);
          const customBrk = (r[4] || "").trim();
          return customBrk
            ? [r[0], r[1] || "", r[2] || "", mIds, customBrk]
            : [r[0], r[1] || "", r[2] || "", mIds];
        });

      window.dispatchEvent(new CustomEvent("lexiconUpdated"));
    } catch (err) {
      console.error("從 Google Sheets 載入資料失敗：", err);
    }
  }

  window.LEXICON_READY = loadFromGoogleSheets();
})();
