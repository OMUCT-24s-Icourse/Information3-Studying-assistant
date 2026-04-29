# Informatioon3-Studying-Assistant
docsフォルダには講義資料を放り込んでます。
下記のURLでは定着確認の問題を出題するシステムを構築してます。自由に利用してください。

https://omuct-24s-icourse.github.io/Information3-Studying-assistant/

## 定着確認データについて
〇〇(講義ノートの番号).jsonというファイルに、下記の形式で記してください。

```json
{
  "meta": {
    "id": "01",
    "title": "情報基礎",
    "description": "",
    "version": 2
  },
  "questions": [
    {
      "id": "01-001",
      "prompt": "問題文",
      "type": "short",
      "choices": [
        { "id": "A", "text": "選択肢1" },
        { "id": "B", "text": "選択肢2" }
      ],
      "answer": {
        "text": "記述答案",
        "choices": ["A"]
      },
      "note": "補足（任意）"
    }
  ]
}
```

- 記述問題は `type: "short"` とし、`answer.text` を使います。
- 選択式は `type: "single"` / `"multi"` とし、`choices` と `answer.choices` を使います。
- `note` は文字数指定などの補足に使えます（任意）。