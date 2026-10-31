"""把 data/roc_government_factions.csv 轉成網站使用的 data/people.json。

派系分群（clusters）與人物關聯（edges）為依 CSV 說明文字整理的詮釋性歸類，
修改歸類請編輯下方 CLUSTERS / MEMBERS / EDGES，再執行：
    python3 scripts/build_data.py
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "roc_government_factions.csv"
OUT = ROOT / "data" / "people.json"

# 派系／背景群組。family 決定星圖中樞紐的分區。
CLUSTERS = {
    "nl":      {"label": "新潮流系",          "family": "政黨派系"},
    "ing":     {"label": "英系",              "family": "政黨派系"},
    "zgh":     {"label": "正國會",            "family": "政黨派系"},
    "mzhs":    {"label": "民主活水",          "family": "政黨派系"},
    "lsyy":    {"label": "綠色友誼連線",      "family": "政黨派系"},
    "xie":     {"label": "謝系／湧言會",      "family": "政黨派系"},
    "ke":      {"label": "柯建銘黨團系統",    "family": "政黨派系"},
    "ju":      {"label": "菊系（高雄市政團隊）", "family": "政黨派系"},
    "trust":   {"label": "蔡賴信任・無派系",  "family": "政黨派系"},
    "kmtmetro":{"label": "國民黨都會／中央",  "family": "政黨派系"},
    "tpp":     {"label": "民眾黨系統",        "family": "政黨派系"},
    "local":   {"label": "地方派系與家族",    "family": "地方網絡"},
    "south":   {"label": "南部市政系統",      "family": "地方網絡"},
    "tainan":  {"label": "台南地緣",          "family": "地方網絡"},
    "civil":   {"label": "常任文官・內部升任", "family": "專業體系"},
    "xpert":   {"label": "產學界延攬",        "family": "專業體系"},
}

# 姓名 -> [(cluster, 強度)]；1 = 核心成員，0.5 = 友好／淵源
MEMBERS = {
    "潘孟安": [("nl", 1)], "林飛帆": [("nl", 1)], "陳世凱": [("nl", 1)],
    "邱垂正": [("nl", 1)], "徐佳青": [("nl", 1)], "曾智勇": [("nl", 1)],
    "陳金德": [("nl", 1)], "周春米": [("nl", 1)],
    "劉世芳": [("nl", 1), ("ju", 1)], "曾文生": [("nl", 1), ("ju", 1)],
    "黃偉哲": [("nl", .5)], "葉菊蘭": [("nl", .5)],
    "董瑞斌": [("xie", .5), ("nl", .5)],
    "何志偉": [("lsyy", 1)],
    "張惇涵": [("ing", 1)], "邱泰源": [("ing", 1)], "陳其邁": [("ing", 1), ("ju", .5)],
    "翁章梁": [("ing", 1)],
    "林佳龍": [("zgh", 1)], "黃志芳": [("zgh", .5)], "陳光復": [("zgh", .5)],
    "卓榮泰": [("mzhs", 1)],
    "管碧玲": [("xie", 1)],
    "何佩珊": [("ke", 1)],
    "吳釗燮": [("trust", 1)], "顧立雄": [("trust", 1)], "鄭麗君": [("trust", 1)],
    "鄭英耀": [("ju", 1), ("south", .5)],
    "楊明州": [("ju", 1), ("south", 1)],
    "古秀妃": [("south", 1)],
    "吳豊山": [("tainan", 1)],
    "吳誠文": [("xpert", 1), ("tainan", .5)],
    "黃正弘": [("xpert", 1), ("tainan", .5)],
    "郭智輝": [("xpert", 1)], "彭啟明": [("xpert", 1)], "李遠（小野）": [("xpert", 1)],
    "黃彥男": [("xpert", 1)], "劉鏡清": [("xpert", 1)], "彭金隆": [("xpert", 1)],
    "賈永婕": [("xpert", 1)],
    "龔明鑫": [("civil", 1)], "莊翠雲": [("civil", 1)], "鄭銘謙": [("civil", 1)],
    "陳駿季": [("civil", 1)], "嚴德發": [("civil", 1)], "凌忠嫄": [("civil", 1)],
    "邱月琴": [("civil", 1)], "林衍茂": [("civil", 1)], "胡光華": [("civil", 1)],
    "劉佩真": [("civil", 1)], "方振仁": [("civil", 1)], "黃建智": [("civil", 1)],
    "簡志誠": [("civil", 1)], "李嘉榮": [("civil", 1)], "李賢義": [("civil", 1)],
    "江耀宗": [("civil", 1)], "胡開宏": [("civil", 1)],
    "蔣萬安": [("kmtmetro", 1)], "侯友宜": [("kmtmetro", 1)],
    "張善政": [("kmtmetro", 1)], "盧秀燕": [("kmtmetro", 1), ("local", .5)],
    "謝國樑": [("local", 1)], "楊文科": [("local", 1)], "鍾東錦": [("local", 1)],
    "王惠美": [("local", 1)], "許淑華": [("local", 1)], "張麗善": [("local", 1)],
    "黃敏惠": [("local", 1)], "林姿妙": [("local", 1)], "徐榛蔚": [("local", 1)],
    "饒慶鈴": [("local", 1)], "王忠銘": [("local", 1)],
    "陳福海": [("tpp", 1), ("local", 1)], "高虹安": [("tpp", 1)],
}

# 名單內人物之間的直接淵源（取自說明文字）
EDGES = [
    ("潘孟安", "周春米", "屏東縣長交棒接班"),
    ("潘孟安", "曾智勇", "屏東縣府原民政務班底"),
    ("陳其邁", "楊明州", "高雄市府團隊"),
    ("林佳龍", "黃志芳", "正國會友好"),
    ("林佳龍", "陳光復", "正國會長期友好結盟"),
]


def party_group(p: str) -> str:
    if p.startswith("民主進步黨") and "友好" not in p:
        return "dpp"
    if p.startswith("中國國民黨"):
        return "kmt"
    if p.startswith("台灣民眾黨"):
        return "tpp"
    return "ind"


def main():
    with SRC.open(encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    people = []
    for i, r in enumerate(rows):
        name = r["姓名"].strip()
        if name not in MEMBERS:
            raise SystemExit(f"未歸類的人物：{name}")
        people.append({
            "id": f"p{i:02d}",
            "category": r["類別"].strip(),
            "org": r["機關或機構"].strip(),
            "title": r["職稱"].strip(),
            "name": name,
            "party": r["所屬政黨"].strip(),
            "partyGroup": party_group(r["所屬政黨"].strip()),
            "faction": r["所屬派系或政治背景"].strip(),
            "bio": r["派系淵源與背景說明"].strip(),
            "clusters": [{"id": c, "w": w} for c, w in MEMBERS[name]],
        })

    by_name = {p["name"]: p["id"] for p in people}
    edges = [{"source": by_name[a], "target": by_name[b], "note": n} for a, b, n in EDGES]
    missing = set(MEMBERS) - set(by_name)
    if missing:
        raise SystemExit(f"MEMBERS 中有 CSV 不存在的人：{missing}")

    OUT.write_text(json.dumps(
        {"clusters": CLUSTERS, "people": people, "edges": edges},
        ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"寫入 {len(people)} 人、{len(edges)} 條關聯 → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
