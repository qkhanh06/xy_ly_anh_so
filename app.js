(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const STORAGE = "pixellab-study-v2",
    LEGACY = "pixellab-quiz-v1";
  const DAY = 86400000,
    INTERVALS = [1, 3, 7, 14, 30];
  const bank = QUESTIONS.map((r, id) => ({
    id,
    q: r[0],
    a: r[1],
    correct: r[2],
    why: r[3],
    source: r[4],
    topic: r[5],
  }));
  const topics = [...new Set(bank.map((q) => q.topic))].sort((a, b) =>
    a.localeCompare(b, "vi"),
  );
  const fresh = () => ({
    version: 2,
    records: {},
    daily: {},
    goal: 10,
    theme: "light",
  });
  const object = (x) => x && typeof x === "object" && !Array.isArray(x);
  let state = fresh(),
    view = "learn",
    mode = "all",
    queue = [],
    index = 0,
    answered = false,
    revealed = false;
  let session = { answered: 0, correct: 0, skipped: 0 },
    toastTimer;
  function dateKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function normalize(raw) {
    if (
      !object(raw) ||
      raw.version !== 2 ||
      !object(raw.records) ||
      !object(raw.daily)
    )
      throw new Error("Bản sao lưu không hợp lệ.");
    const clean = fresh();
    clean.goal = [5, 10, 20].includes(raw.goal) ? raw.goal : 10;
    clean.theme = raw.theme === "dark" ? "dark" : "light";
    for (const q of bank) {
      const r = raw.records[q.id];
      if (!object(r)) continue;
      const out = {
        saved: r.saved === true,
        note: typeof r.note === "string" ? r.note.slice(0, 2000) : "",
        stage: Number.isInteger(r.stage)
          ? Math.max(0, Math.min(5, r.stage))
          : 0,
      };
      for (const key of ["last", "due"])
        if (
          Number.isFinite(r[key]) &&
          r[key] >= 0 &&
          r[key] <= 8640000000000000
        )
          out[key] = r[key];
      if (typeof r.correct === "boolean") out.correct = r.correct;
      if (typeof r.needsWork === "boolean") out.needsWork = r.needsWork;
      clean.records[q.id] = out;
    }
    for (const [date, ids] of Object.entries(raw.daily)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Array.isArray(ids))
        clean.daily[date] = [
          ...new Set(
            ids.filter(
              (id) => Number.isInteger(id) && id >= 0 && id < bank.length,
            ),
          ),
        ];
    }
    return clean;
  }
  function notify(text) {
    $("toast").textContent = text;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($("toast").hidden = true), 4500);
  }
  try {
    const saved = localStorage.getItem(STORAGE);
    if (saved) state = normalize(JSON.parse(saved));
    else {
      const old = JSON.parse(localStorage.getItem(LEGACY) || "{}");
      if (object(old))
        for (const q of bank) {
          const r = old[q.id];
          if (object(r) && typeof r.correct === "boolean")
            state.records[q.id] = {
              correct: r.correct,
              needsWork: !r.correct,
              last: Number.isFinite(r.last) ? r.last : Date.now(),
              due: Date.now(),
              stage: 0,
            };
        }
    }
  } catch {
    notify(
      "Không đọc được dữ liệu đã lưu. Bạn vẫn có thể học và xuất bản sao lưu.",
    );
  }
  function save() {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(state));
      return true;
    } catch {
      notify(
        "Trình duyệt không lưu được tiến độ. Hãy sao lưu ở mục Tiến độ học tập.",
      );
      return false;
    }
  }
  const record = (q) => state.records[q.id] || {};
  const studied = (q) => Number.isFinite(record(q).last);
  const due = (q) => studied(q) && (record(q).due || 0) <= Date.now();
  const weak = (q) => record(q).needsWork === true;
  function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function setMetric(id, value, suffix) {
    $(id).replaceChildren(
      document.createTextNode(String(value) + " "),
      el("small", "", suffix),
    );
  }
  function countStreak() {
    const d = new Date();
    let count = 0;
    if (!(state.daily[dateKey(d)] || []).length) d.setDate(d.getDate() - 1);
    while ((state.daily[dateKey(d)] || []).length) {
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }
  function baseEligible(q) {
    return (
      ($("topicSelect").value === "all" ||
        q.topic === $("topicSelect").value) &&
      ($("sourceSelect").value === "all" ||
        q.source === $("sourceSelect").value)
    );
  }
  function inMode(q, m = mode) {
    return m === "due"
      ? due(q)
      : m === "wrong"
        ? weak(q)
        : m === "saved"
          ? !!record(q).saved
          : m === "unseen"
            ? !studied(q)
            : true;
  }
  function stats() {
    const attempted = bank.filter(studied).length,
      tested = bank.filter((q) => typeof record(q).correct === "boolean");
    setMetric("attempted", attempted, `/ ${bank.length} câu`);
    $("accuracy").textContent = tested.length
      ? `${Math.round((100 * tested.filter((q) => record(q).correct).length) / tested.length)}%`
      : "—";
    setMetric("dueCount", bank.filter(due).length, "câu hỏi");
    setMetric("wrongCount", bank.filter(weak).length, "câu hỏi");
    $("savedCount").textContent = bank.filter((q) => record(q).saved).length;
    for (const m of ["all", "due", "wrong", "saved", "unseen"])
      $(m + "ModeCount").textContent = bank.filter(
        (q) => baseEligible(q) && inMode(q, m),
      ).length;
    const today = (state.daily[dateKey()] || []).length;
    setMetric("dailyCount", today, `/ ${state.goal} câu`);
    $("dailyBar").style.width = `${Math.min(100, (today / state.goal) * 100)}%`;
    $("dailyMessage").textContent =
      today >= state.goal
        ? "Hoàn thành mục tiêu. Bạn đã giữ nhịp hôm nay!"
        : today
          ? `Thêm ${state.goal - today} câu nữa để chạm mục tiêu.`
          : "Một câu đầu tiên là một khởi đầu tốt.";
    $("streak").textContent = `♨ ${countStreak()} ngày liên tiếp`;
    $("sessionScore").textContent =
      view === "flash"
        ? `Buổi này: ${session.answered} thẻ đã ôn`
        : `Buổi này: ${session.correct} / ${session.answered} đúng`;
  }
  function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function start(customQueue) {
    let eligible = shuffle(bank.filter((q) => baseEligible(q) && inMode(q)));
    if (mode === "due")
      eligible.sort((a, b) => (record(a).due || 0) - (record(b).due || 0));
    queue =
      customQueue ||
      eligible.slice(
        0,
        $("sessionSize").value === "all"
          ? eligible.length
          : Number($("sessionSize").value),
      );
    index = 0;
    session = { answered: 0, correct: 0, skipped: 0 };
    stats();
    render();
  }
  function updateBookmark() {
    const q = queue[index],
      saved = q && record(q).saved;
    $("bookmarkBtn").hidden = !q;
    $("bookmarkBtn").textContent = saved ? "★" : "☆";
    $("bookmarkBtn").setAttribute("aria-pressed", String(!!saved));
    $("bookmarkBtn").setAttribute(
      "aria-label",
      saved ? "Bỏ lưu câu hỏi" : "Lưu câu hỏi",
    );
    $("bookmarkBtn").title = saved ? "Bỏ lưu câu hỏi" : "Lưu câu hỏi";
  }
  function progress() {
    const value = queue.length
      ? Math.round(((index + (answered ? 1 : 0)) / queue.length) * 100)
      : 0;
    $("progressBar").style.width = `${value}%`;
    $("progressTrack").setAttribute("aria-valuenow", value);
  }
  function render() {
    const q = queue[index];
    answered = false;
    revealed = false;
    $("questionArea").hidden = !q;
    $("emptyArea").hidden = !!q;
    updateBookmark();
    if (!q) {
      $("emptyTitle").textContent = queue.length
        ? "Bạn đã hoàn thành buổi học!"
        : "Chưa có câu hỏi trong mục này";
      const messages = {
        due: "Chưa có câu đến lịch ôn phù hợp bộ lọc. Bạn có thể học câu mới trong lúc chờ.",
        wrong: "Chưa có câu cần luyện thêm phù hợp bộ lọc.",
        saved: "Nhấn ngôi sao bên cạnh câu hỏi để lưu vào sổ tay.",
        unseen: "Bạn đã khám phá hết các câu phù hợp bộ lọc.",
        all: "Hãy thử chọn chủ đề hoặc nguồn tài liệu khác.",
      };
      $("emptyText").textContent = queue.length
        ? "Dừng lại một chút, tự nhắc lại điều vừa học trước khi bắt đầu lượt tiếp theo."
        : messages[mode];
      $("sessionSummary").textContent = queue.length
        ? (view === "flash"
            ? `${session.answered} thẻ đã ôn`
            : `${session.correct}/${session.answered} câu trả lời đúng`) +
          ` · ${session.skipped} câu để sau`
        : "";
      return;
    }
    $("counter").textContent = `Câu ${index + 1} / ${queue.length}`;
    $("topicTag").textContent = q.topic;
    $("sourceTag").textContent = `Tài liệu ${q.source}`;
    $("questionTitle").textContent = q.q;
    $("questionHint").textContent =
      view === "flash"
        ? "Tự nhớ câu trả lời trước khi lật thẻ."
        : "Chọn một đáp án bạn cho là đúng.";
    $("options").hidden = view === "flash";
    $("flashArea").hidden = view !== "flash";
    $("feedback").hidden = true;
    $("nextBtn").hidden = true;
    $("skipBtn").hidden = false;
    $("revealBtn").hidden = false;
    $("recallPrompt").hidden = false;
    $("flashAnswer").hidden = true;
    document
      .querySelectorAll("[data-rating]")
      .forEach((b) => (b.disabled = false));
    $("goodInterval").textContent =
      `Ôn lại sau ${INTERVALS[Math.min(record(q).stage || 0, 4)]} ngày`;
    $("options").replaceChildren();
    q.a.forEach((text, i) => {
      const btn = el("button", "option");
      btn.append(el("span", "letter", "ABCD"[i]), el("span", "", text));
      btn.addEventListener("click", () => answer(i));
      $("options").append(btn);
    });
    $("noteInput").value = record(q).note || "";
    $("noteDetails").open = false;
    $("noteStatus").textContent = "Ghi chú được lưu tự động.";
    progress();
  }
  function schedule(q, rating, quizCorrect) {
    const previous = record(q),
      stage = previous.stage || 0;
    const days = rating === "good" ? INTERVALS[Math.min(stage, 4)] : 1;
    const now = Date.now();
    const r = {
      ...previous,
      last: now,
      due: now + (rating === "again" ? 600000 : days * DAY),
      stage: rating === "good" ? Math.min(5, stage + 1) : 0,
      needsWork: rating !== "good",
    };
    if (typeof quizCorrect === "boolean") r.correct = quizCorrect;
    state.records[q.id] = r;
    const key = dateKey();
    state.daily[key] = [...new Set([...(state.daily[key] || []), q.id])];
    session.answered++;
    if (quizCorrect) session.correct++;
    answered = true;
    save();
    stats();
    progress();
    return rating === "again"
      ? "Ôn lại sau 10 phút · Mục “Đến lịch ôn” sẽ nhắc bạn."
      : `Lần ôn tiếp theo: ${new Date(r.due).toLocaleDateString("vi-VN")} · Sau ${days} ngày.`;
  }
  function answer(choice) {
    const q = queue[index];
    if (!q || answered || view !== "learn") return;
    const ok = choice === q.correct,
      message = schedule(q, ok ? "good" : "again", ok);
    [...$("options").children].forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.correct) {
        btn.classList.add("correct");
        btn.append(el("span", "answer-status", "✓"));
      } else if (i === choice) {
        btn.classList.add("wrong");
        btn.append(el("span", "answer-status", "✕"));
      }
    });
    $("feedback").className = "feedback" + (ok ? "" : " bad");
    $("feedback").hidden = false;
    $("feedbackTitle").textContent = ok
      ? "✓ Chính xác! Bạn đã hiểu đúng."
      : "✕ Chưa đúng. Cùng hiểu lại một chút nhé.";
    $("feedbackAnswer").textContent =
      `Đáp án: ${"ABCD"[q.correct]}. ${q.a[q.correct]}`;
    $("feedbackExplain").textContent = q.why;
    $("reviewSchedule").textContent = message;
    $("skipBtn").hidden = true;
    $("nextBtn").hidden = false;
    $("nextBtn").focus({ preventScroll: true });
  }
  function reveal() {
    const q = queue[index];
    if (!q || view !== "flash" || revealed) return;
    revealed = true;
    $("recallPrompt").hidden = true;
    $("revealBtn").hidden = true;
    $("flashAnswer").hidden = false;
    $("flashAnswerText").textContent = q.a[q.correct];
    $("flashExplain").textContent = q.why;
  }
  function rate(rating) {
    const q = queue[index];
    if (!q || view !== "flash" || !revealed || answered) return;
    const msg = schedule(q, rating);
    document
      .querySelectorAll("[data-rating]")
      .forEach((b) => (b.disabled = true));
    $("skipBtn").hidden = true;
    $("nextBtn").hidden = false;
    $("nextBtn").focus({ preventScroll: true });
    notify(msg);
  }
  function next() {
    if (!queue[index]) return;
    if (!answered) session.skipped++;
    index++;
    render();
    $("questionTitle").focus({ preventScroll: true });
    if (matchMedia("(max-width:960px)").matches)
      document
        .querySelector(".study-card")
        .scrollIntoView({ block: "start", behavior: "auto" });
  }
  function setMode(value) {
    mode = value;
    document.querySelectorAll("[data-mode]").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === mode);
      b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
    });
    start();
  }
  function setView(value) {
    const previous = view;
    view = value;
    document.querySelectorAll("[data-view]").forEach((b) => {
      b.classList.toggle("active", b.dataset.view === view);
      if (b.dataset.view === view) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    $("pageName").textContent = {
      learn: "Luyện tập",
      flash: "Thẻ ghi nhớ",
      notebook: "Sổ tay của bạn",
      progress: "Tiến độ học tập",
    }[view];
    $("studyView").hidden = !["learn", "flash"].includes(view);
    $("notebookView").hidden = view !== "notebook";
    $("progressView").hidden = view !== "progress";
    $("quizTab").classList.toggle("active", view === "learn");
    $("flashTab").classList.toggle("active", view === "flash");
    $("quizTab").setAttribute("aria-pressed", String(view === "learn"));
    $("flashTab").setAttribute("aria-pressed", String(view === "flash"));
    $("studyTitle").textContent =
      view === "flash" ? "Tự nhớ trước, lật thẻ sau" : "Một buổi học nhỏ";
    $("studyBadge").textContent =
      view === "flash" ? "THẺ GHI NHỚ" : "LUYỆN TẬP";
    if (view === "notebook") renderNotebook();
    else if (view === "progress") renderProgress();
    else if (previous !== view) start();
    stats();
  }
  function toggleSaved(q) {
    state.records[q.id] = { ...record(q), saved: !record(q).saved };
    save();
    stats();
    updateBookmark();
  }
  function renderNotebook() {
    const term = $("noteSearch")
      .value.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const items = bank.filter(
      (q) =>
        (record(q).saved || record(q).note) &&
        `${q.q} ${q.topic} ${record(q).note || ""}`
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .includes(term),
    );
    const list = $("notebookList");
    list.replaceChildren();
    if (!items.length) {
      const empty = el("div", "empty-state");
      empty.append(
        el("span", "empty-symbol", "▤"),
        el(
          "h3",
          "",
          term ? "Chưa tìm thấy ghi chú phù hợp" : "Sổ tay đang chờ bạn",
        ),
        el(
          "p",
          "",
          "Lưu câu hỏi bằng ngôi sao hoặc viết cách nhớ của bạn khi luyện tập.",
        ),
      );
      list.append(empty);
      return;
    }
    for (const q of items) {
      const r = record(q),
        card = el("article", "card notebook-entry");
      card.append(
        el("span", "tag", q.topic),
        el("h3", "", q.q),
        el("p", "entry-answer", `Đáp án: ${q.a[q.correct]}`),
        el("p", "", q.why),
      );
      if (r.note) card.append(el("p", "", `✎ ${r.note}`));
      const actions = el("div", "entry-actions"),
        practice = el("button", "btn secondary", "Ôn câu này →"),
        bookmark = el(
          "button",
          "btn text-button",
          r.saved ? "★ Bỏ lưu" : "☆ Lưu câu",
        );
      practice.onclick = () => {
        setView("learn");
        start([q]);
      };
      bookmark.onclick = () => {
        toggleSaved(q);
        renderNotebook();
      };
      actions.append(practice, bookmark);
      card.append(actions);
      list.append(card);
    }
  }
  function renderProgress() {
    $("topicProgress").replaceChildren();
    for (const topic of topics) {
      const qs = bank.filter((q) => q.topic === topic),
        learned = qs.filter(studied).length,
        tested = qs.filter((q) => typeof record(q).correct === "boolean");
      const row = el("div", "topic-row"),
        head = el("div", "topic-row-head"),
        btn = el("button", "", topic);
      btn.onclick = () => {
        $("topicSelect").value = topic;
        setView("learn");
        setMode("all");
      };
      head.append(
        btn,
        el(
          "small",
          "",
          `${learned}/${qs.length} đã học · ${tested.length ? Math.round((tested.filter((q) => record(q).correct).length / tested.length) * 100) + "% đúng" : "Chưa làm trắc nghiệm"}`,
        ),
      );
      const track = el("div", "progress-track"),
        bar = el("div");
      bar.style.width = `${(learned / qs.length) * 100}%`;
      track.append(bar);
      row.append(head, track);
      $("topicProgress").append(row);
    }
    $("activityChart").replaceChildren();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - 6 + i);
      return { date: d, count: (state.daily[dateKey(d)] || []).length };
    });
    const max = Math.max(5, ...days.map((d) => d.count));
    for (const d of days) {
      const col = el("div", "activity-day"),
        bar = el("div", "bar");
      bar.style.height = `${(d.count / max) * 115}px`;
      col.append(
        el("span", "", d.count),
        bar,
        el("span", "", `${d.date.getDate()}/${d.date.getMonth() + 1}`),
      );
      col.setAttribute("aria-label", `${dateKey(d.date)}: ${d.count} câu`);
      $("activityChart").append(col);
    }
  }
  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    $("themeBtn").textContent = state.theme === "dark" ? "☀" : "☾";
    $("themeBtn").setAttribute(
      "aria-label",
      state.theme === "dark"
        ? "Chuyển sang giao diện sáng"
        : "Chuyển sang giao diện tối",
    );
  }
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => (b.onclick = () => setView(b.dataset.view)));
  document
    .querySelectorAll("[data-mode]")
    .forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
  document
    .querySelectorAll("[data-rating]")
    .forEach((b) => (b.onclick = () => rate(b.dataset.rating)));
  $("quizTab").onclick = () => setView("learn");
  $("flashTab").onclick = () => setView("flash");
  $("skipBtn").onclick = next;
  $("nextBtn").onclick = next;
  $("revealBtn").onclick = reveal;
  $("againBtn").onclick = () => start();
  $("restartBtn").onclick = () => {
    start();
    notify("Đã trộn câu hỏi và bắt đầu lượt mới.");
  };
  $("allQuestionsBtn").onclick = () => {
    $("topicSelect").value = "all";
    $("sourceSelect").value = "all";
    setMode("all");
  };
  ["topicSelect", "sourceSelect", "sessionSize"].forEach(
    (id) => ($(id).onchange = () => start()),
  );
  $("dueShortcut").onclick = () => {
    setView("learn");
    $("topicSelect").value = "all";
    $("sourceSelect").value = "all";
    setMode("due");
  };
  $("practiceSaved").onclick = () => {
    setView("learn");
    $("topicSelect").value = "all";
    $("sourceSelect").value = "all";
    setMode("saved");
  };
  $("bookmarkBtn").onclick = () => {
    if (queue[index]) toggleSaved(queue[index]);
  };
  $("noteInput").oninput = () => {
    const q = queue[index];
    if (!q) return;
    state.records[q.id] = { ...record(q), note: $("noteInput").value };
    $("noteStatus").textContent = save()
      ? "Đã lưu ghi chú."
      : "Chưa lưu được. Hãy sao lưu tiến độ.";
  };
  $("noteSearch").oninput = renderNotebook;
  $("dailyGoal").onchange = () => {
    state.goal = Number($("dailyGoal").value);
    save();
    stats();
  };
  $("themeBtn").onclick = () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme();
    save();
  };
  $("exportBtn").onclick = () => {
    const blob = new Blob(
        [
          JSON.stringify(
            { ...state, exportedAt: new Date().toISOString() },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      url = URL.createObjectURL(blob),
      a = el("a");
    a.href = url;
    a.download = `pixellab-tien-do-${dateKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Đã tạo bản sao lưu tiến độ.");
  };
  $("importFile").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 2000000) throw new Error("Tệp quá lớn (tối đa 2 MB).");
      const candidate = normalize(JSON.parse(await file.text()));
      if (!confirm("Thay thế tiến độ hiện tại bằng bản sao lưu này?")) return;
      state = candidate;
      save();
      applyTheme();
      $("dailyGoal").value = state.goal;
      start();
      renderProgress();
      notify("Đã khôi phục tiến độ.");
    } catch {
      notify("Không thể nhập: cần bản sao lưu PixelLab hợp lệ, tối đa 2 MB.");
    } finally {
      e.target.value = "";
    }
  };
  document.querySelector(".import-label").onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      $("importFile").click();
    }
  };
  $("resetBtn").onclick = () => {
    if (
      !confirm(
        "Xóa toàn bộ lịch sử, ghi chú, câu đã lưu và lịch ôn trên thiết bị này?",
      )
    )
      return;
    const theme = state.theme;
    state = fresh();
    state.theme = theme;
    save();
    try {
      localStorage.removeItem(LEGACY);
    } catch {}
    $("dailyGoal").value = state.goal;
    start();
    renderProgress();
    notify("Đã xóa tiến độ trên thiết bị này.");
  };
  document.addEventListener("keydown", (e) => {
    if (
      e.altKey ||
      e.ctrlKey ||
      e.metaKey ||
      e.repeat ||
      e.target.closest("input,textarea,select,summary,a,[contenteditable]") ||
      !["learn", "flash"].includes(view)
    )
      return;
    if (/^[1-4]$/.test(e.key) && view === "learn") {
      e.preventDefault();
      answer(Number(e.key) - 1);
    } else if (
      e.key === "Enter" &&
      !e.target.closest("button") &&
      queue[index]
    ) {
      e.preventDefault();
      if (answered) next();
      else if (view === "flash") reveal();
    }
  });
  for (const topic of topics) {
    const option = el("option", "", topic);
    option.value = topic;
    $("topicSelect").append(option);
  }
  $("bankCount").textContent = bank.length;
  $("dailyGoal").value = state.goal;
  applyTheme();
  setView("learn");
  start();
  setInterval(() => {
    stats();
    if (view === "progress") renderProgress();
  }, 60000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) stats();
  });
})();
