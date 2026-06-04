const sources = [
  { id: "01", label: "01.json", file: "data/01.json" },
  { id: "02", label: "02.json", file: "data/02.json" },
  { id: "03", label: "03.json", file: "data/03.json" },
  { id: "04", label: "04.json", file: "data/04.json" },
  { id: "05", label: "05.json", file: "data/05.json" },
  { id: "06", label: "06.json", file: "data/06.json" },
  { id: "07", label: "07.json", file: "data/07.json" }
];

const state = {
  data: new Map(),
  enabled: new Set(),
  current: null,
  warnings: new Map(),
  meta: new Map()
};

const elements = {
  sourceList: document.getElementById("sourceList"),
  summary: document.getElementById("summary"),
  drawButton: document.getElementById("drawButton"),
  answerButton: document.getElementById("answerButton"),
  questionTag: document.getElementById("questionTag"),
  questionSource: document.getElementById("questionSource"),
  questionText: document.getElementById("questionText"),
  choicesBlock: document.getElementById("choicesBlock"),
  choicesList: document.getElementById("choicesList"),
  answerBlock: document.getElementById("answerBlock"),
  answerText: document.getElementById("answerText"),
  statusMessage: document.getElementById("statusMessage"),
  questionMeta: document.getElementById("questionMeta")
};

function normalizeText(value) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function normalizeStringArray(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  const text = normalizeText(value);
  return text ? [text] : [];
}

function choiceIdFromIndex(index) {
  return String.fromCharCode(65 + index);
}

function normalizeChoiceList(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map((entry, index) => {
        if (entry && typeof entry === "object" && !Array.isArray(entry)) {
          const id = normalizeText(entry.id) || choiceIdFromIndex(index);
          const text = normalizeText(entry.text ?? entry.label ?? "");
          return text ? { id, text } : null;
        }
        const text = normalizeText(entry);
        return text ? { id: choiceIdFromIndex(index), text } : null;
      })
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((text, index) => ({ id: choiceIdFromIndex(index), text }));
  }
  const text = normalizeText(value);
  return text ? [{ id: "A", text }] : [];
}

function normalizeAnswer(value) {
  if (!value) {
    return {};
  }
  if (typeof value === "string") {
    return { text: normalizeText(value) };
  }
  if (Array.isArray(value)) {
    const choices = value.map(normalizeText).filter(Boolean);
    return choices.length ? { choices } : {};
  }
  if (typeof value === "object") {
    const text = normalizeText(value.text);
    const choices = Array.isArray(value.choices)
      ? value.choices.map(normalizeText).filter(Boolean)
      : [];
    const result = {};
    if (text) {
      result.text = text;
    }
    if (choices.length > 0) {
      result.choices = choices;
    }
    return result;
  }
  return {};
}

function formatTypeLabel(type) {
  const map = {
    short: "記述",
    single: "1つ選択",
    multi: "複数選択",
    matrix: "○/×"
  };
  return map[type] || type;
}

function buildItem(entry, index, source, meta) {
  const prompt = normalizeText(entry?.prompt ?? entry?.question);
  if (!prompt) {
    return null;
  }
  const choices = normalizeChoiceList(entry?.choices ?? entry?.options);
  const answer = normalizeAnswer(entry?.answer);
  const type = normalizeText(entry?.type) || (choices.length > 0 ? "single" : "short");
  const note = normalizeText(entry?.note);
  const tags = normalizeStringArray(entry?.tags);
  const idBase = meta?.id || source.id;
  const id = normalizeText(entry?.id) || `${idBase}-${String(index + 1).padStart(3, "0")}`;
  return {
    id,
    sourceId: source.id,
    sourceLabel: source.label,
    sourceTitle: meta?.title || source.label,
    no: index + 1,
    prompt,
    choices,
    answer,
    type,
    note,
    tags
  };
}

function createSourceRow(source) {
  const row = document.createElement("div");
  row.className = "source-row";

  const name = document.createElement("div");
  name.className = "source-name";
  name.id = `name-${source.id}`;
  name.textContent = source.label;

  const meta = document.createElement("div");
  meta.className = "source-meta";
  meta.id = `meta-${source.id}`;
  meta.textContent = "読み込み中...";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "toggle";
  toggle.dataset.source = source.id;
  toggle.setAttribute("aria-pressed", "true");
  toggle.textContent = "ON";

  row.append(name, meta, toggle);
  elements.sourceList.append(row);
}

function updateSourceMeta(sourceId, count, warning) {
  const meta = document.getElementById(`meta-${sourceId}`);
  if (!meta) {
    return;
  }
  const source = sources.find((item) => item.id === sourceId);
  const info = state.meta.get(sourceId);
  const label = info?.fileLabel || source?.label || sourceId;
  const base = `${label} ・ ${count}問`;
  meta.textContent = warning ? `${base} (${warning})` : base;

  const name = document.getElementById(`name-${sourceId}`);
  if (name && info?.title) {
    name.textContent = info.title;
  }
}

function getEnabledQuestions() {
  const pool = [];
  state.enabled.forEach((sourceId) => {
    const items = state.data.get(sourceId) || [];
    pool.push(...items);
  });
  return pool;
}

function updateSummary() {
  const total = Array.from(state.data.values()).reduce(
    (sum, items) => sum + items.length,
    0
  );
  const active = getEnabledQuestions().length;
  elements.summary.textContent = `出題対象: ${active}問 / 全${total}問`;
  elements.drawButton.disabled = active === 0;
}

function renderStatus() {
  const messages = [];
  state.warnings.forEach((warning, sourceId) => {
    if (warning) {
      const source = sources.find((item) => item.id === sourceId);
      messages.push(`${source?.label ?? sourceId}: ${warning}`);
    }
  });
  elements.statusMessage.textContent = messages.length
    ? `注意: ${messages.join(" / ")}`
    : "";
}

function setSourceEnabled(sourceId, enabled) {
  if (enabled) {
    state.enabled.add(sourceId);
  } else {
    state.enabled.delete(sourceId);
  }
  const button = elements.sourceList.querySelector(
    `button[data-source="${sourceId}"]`
  );
  if (button) {
    button.setAttribute("aria-pressed", enabled ? "true" : "false");
    button.textContent = enabled ? "ON" : "OFF";
  }
  updateSummary();
}

function renderQuestionMeta(item) {
  elements.questionMeta.innerHTML = "";
  const chips = [];

  if (item.type) {
    chips.push({ text: formatTypeLabel(item.type), className: "meta-chip" });
  }
  if (item.note) {
    chips.push({ text: item.note, className: "meta-chip meta-note" });
  }
  if (item.tags && item.tags.length > 0) {
    item.tags.forEach((tag) => {
      chips.push({ text: tag, className: "meta-chip meta-tag" });
    });
  }

  if (chips.length === 0) {
    elements.questionMeta.classList.add("hidden");
    return;
  }

  chips.forEach((chip) => {
    const span = document.createElement("span");
    span.className = chip.className;
    span.textContent = chip.text;
    elements.questionMeta.append(span);
  });
  elements.questionMeta.classList.remove("hidden");
}

function formatAnswer(item) {
  if (item.answer) {
    if (Array.isArray(item.answer.choices) && item.answer.choices.length > 0) {
      const parts = item.answer.choices.map((choiceId) => {
        const choice = item.choices.find((itemChoice) => itemChoice.id === choiceId);
        return choice ? `${choice.id}. ${choice.text}` : choiceId;
      });
      return parts.join(" / ");
    }
    if (item.answer.text) {
      return item.answer.text;
    }
  }
  return "（回答が未登録）";
}

function renderQuestion(item) {
  elements.questionTag.textContent = item.id || `Q${item.no}`;
  elements.questionSource.textContent = item.sourceTitle || item.sourceLabel;
  elements.questionText.textContent = item.prompt;
  renderQuestionMeta(item);

  elements.choicesList.innerHTML = "";
  if (item.choices.length > 0) {
    item.choices.forEach((choice) => {
      const li = document.createElement("li");
      li.textContent = `${choice.id}. ${choice.text}`;
      elements.choicesList.append(li);
    });
    elements.choicesBlock.classList.remove("hidden");
  } else {
    elements.choicesBlock.classList.add("hidden");
  }

  elements.answerText.textContent = formatAnswer(item);
  elements.answerBlock.classList.add("hidden");
  elements.answerButton.disabled = false;
  elements.statusMessage.textContent = "";
}

function pickRandomQuestion() {
  const pool = getEnabledQuestions();
  if (pool.length === 0) {
    return null;
  }
  if (pool.length === 1) {
    return pool[0];
  }
  let next = null;
  while (!next || (state.current && next.id === state.current.id)) {
    next = pool[Math.floor(Math.random() * pool.length)];
  }
  return next;
}

async function loadSource(source) {
  const result = { source, items: [], warning: "", meta: null };
  try {
    const response = await fetch(source.file, { cache: "no-store" });
    if (!response.ok) {
      result.warning = `読み込み失敗(${response.status})`;
      return result;
    }
    const text = await response.text();
    if (!text.trim()) {
      result.warning = "空のデータ";
      return result;
    }
    let json;
    try {
      json = JSON.parse(text);
    } catch (error) {
      result.warning = "JSON形式が不正";
      return result;
    }
    const parsed = parseSourceJson(json, source);
    result.items = parsed.items;
    result.warning = parsed.warning;
    result.meta = parsed.meta;
    return result;
  } catch (error) {
    result.warning = "読み込み失敗";
    return result;
  }
}

function parseSourceJson(json, source) {
  const result = {
    meta: {
      id: source.id,
      title: source.label,
      description: "",
      version: null,
      fileLabel: source.label
    },
    items: [],
    warning: ""
  };

  if (Array.isArray(json)) {
    result.warning = "旧形式";
    result.items = json
      .map((entry, index) => buildItem(entry, index, source, result.meta))
      .filter(Boolean);
    if (result.items.length === 0) {
      result.warning = "有効な問題がありません";
    }
    return result;
  }

  if (!json || typeof json !== "object") {
    result.warning = "JSON形式が不正";
    return result;
  }

  if (json.meta && typeof json.meta === "object") {
    result.meta = {
      id: normalizeText(json.meta.id) || source.id,
      title: normalizeText(json.meta.title) || source.label,
      description: normalizeText(json.meta.description),
      version: json.meta.version ?? null,
      fileLabel: source.label
    };
  }

  if (!Array.isArray(json.questions)) {
    result.warning = "questionsがありません";
    return result;
  }

  result.items = json.questions
    .map((entry, index) => buildItem(entry, index, source, result.meta))
    .filter(Boolean);

  if (result.items.length === 0) {
    result.warning = "有効な問題がありません";
  }
  return result;
}

async function loadAllSources() {
  const results = await Promise.all(sources.map(loadSource));
  results.forEach((result) => {
    state.data.set(result.source.id, result.items);
    state.warnings.set(result.source.id, result.warning);
    if (result.meta) {
      state.meta.set(result.source.id, result.meta);
    }
    updateSourceMeta(result.source.id, result.items.length, result.warning);
  });
  updateSummary();
  renderStatus();
}

function initialize() {
  sources.forEach((source) => {
    createSourceRow(source);
    state.enabled.add(source.id);
  });

  elements.sourceList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-source]");
    if (!button) {
      return;
    }
    const sourceId = button.dataset.source;
    const enabled = !state.enabled.has(sourceId);
    setSourceEnabled(sourceId, enabled);
  });

  elements.drawButton.addEventListener("click", () => {
    const next = pickRandomQuestion();
    if (!next) {
      elements.statusMessage.textContent = "出題できる問題がありません。";
      return;
    }
    state.current = next;
    renderQuestion(next);
  });

  elements.answerButton.addEventListener("click", () => {
    if (!state.current) {
      return;
    }
    elements.answerBlock.classList.remove("hidden");
    elements.answerButton.disabled = true;
  });

  loadAllSources();
}

initialize();
