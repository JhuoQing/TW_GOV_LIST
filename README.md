# 台灣政府人事派系圖鑑

中央政務官員、國營與公股事業董事長、地方縣市首長共 74 位人物的政黨歸屬、派系淵源與彼此關係的互動網站。

- **人物圖鑑**：可依類別、政黨、派系篩選與搜尋，點選卡片看完整背景與相關人物。
- **派系星圖**：以力導向網絡圖呈現人物與派系群組的關係，可拖曳、縮放、聚焦。
- 支援深色模式與手機版；人物可用網址分享（例如 `#p00`）。

## 發布到 GitHub Pages

Settings → Pages → Source 選 **Deploy from a branch**，Branch 選 `main`、資料夾 `/ (root)`，儲存後約一分鐘可在
`https://jhuoqing.github.io/TW_GOV_LIST/` 看到網站。

## 本機預覽

網站以 `fetch` 讀取資料，需透過本機伺服器開啟：

```bash
python3 -m http.server 8000
# 開啟 http://localhost:8000
```

## 更新資料

1. 編輯 `data/roc_government_factions.csv`。
2. 若有新人物或派系異動，到 `scripts/build_data.py` 調整 `MEMBERS`（派系歸類）與 `EDGES`（人物間直接淵源）。
3. 執行 `python3 scripts/build_data.py` 重新產生 `data/people.json`。

## 資料說明

派系與背景歸屬屬於詮釋性描述，並非當事人或政黨的官方認定；人事可能已有異動，引用前請以官方資訊核對。
