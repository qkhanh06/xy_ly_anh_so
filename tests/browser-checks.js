async (page) => {
  const failures = [],
    passed = [],
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const check = (ok, name) => {
    if (!ok) {
      failures.push(name);
      throw new Error(name);
    }
    passed.push(name);
  };
  const store = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("pixellab-study-v2")));
  const current = () =>
    page.evaluate(() => {
      const i = QUESTIONS.findIndex(
        (r) => r[0] === document.getElementById("questionTitle").textContent,
      );
      return { id: i, correct: QUESTIONS[i][2] };
    });
  await page.goto("http://localhost:8000");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  check(
    (await page.locator(".option").count()) === 4,
    "Initial quiz has four options",
  );
  let q = await current();
  await page.locator("#bookmarkBtn").click();
  await page.locator("#noteDetails summary").click();
  await page
    .locator("#noteInput")
    .fill("Ghi nhớ riêng: <script>alert(1)</script>");
  check((await store()).records[q.id].saved === true, "Bookmark persisted");
  check(
    (await store()).records[q.id].note.includes("<script>"),
    "Personal note persisted as text",
  );
  await page
    .locator(".option")
    .nth((q.correct + 1) % 4)
    .click();
  let data = await store();
  check(
    data.records[q.id].correct === false && data.records[q.id].needsWork,
    "Wrong answer enters weak-question list",
  );
  check(
    Math.abs(data.records[q.id].due - data.records[q.id].last - 600000) < 10,
    "Wrong answer scheduled in ten minutes",
  );
  check(
    (await page.locator(".option:disabled").count()) === 4,
    "Answers cannot be submitted twice",
  );
  check(
    await page.locator("#feedback").isVisible(),
    "Answer explanation visible",
  );
  await page.locator('[data-view="notebook"]').click();
  check(
    (await page.locator(".notebook-entry").count()) === 1,
    "Notebook lists saved question",
  );
  check(
    (await page.locator(".notebook-entry").textContent()).includes("<script>"),
    "Notebook safely renders literal markup",
  );
  await page.locator("#noteSearch").fill("not-found-xyz");
  check(
    (await page.locator(".notebook-entry").count()) === 0,
    "Notebook search filters entries",
  );
  await page.locator("#noteSearch").fill("");
  await page.locator(".entry-actions .secondary").click();
  await page.locator(".option").nth(q.correct).click();
  data = await store();
  check(
    !data.records[q.id].needsWork && data.records[q.id].stage === 1,
    "Correct answer resolves weak flag and advances interval",
  );
  check(
    data.records[q.id].due - data.records[q.id].last === 86400000,
    "First success scheduled in one day",
  );
  check(
    Object.values(data.daily)[0].length === 1,
    "Daily goal counts distinct questions only",
  );
  await page.locator("#nextBtn").click();
  check(
    await page.locator("#emptyArea").isVisible(),
    "Single-question session reaches summary",
  );
  await page.locator("#flashTab").click();
  q = await current();
  check(
    !(await page.locator("#flashAnswer").isVisible()),
    "Flashcard answer hidden before reveal",
  );
  await page.locator("#revealBtn").click();
  await page.locator('[data-rating="hard"]').click();
  data = await store();
  check(
    data.records[q.id].needsWork &&
      data.records[q.id].due - data.records[q.id].last === 86400000,
    "Hard flashcard scheduled tomorrow",
  );
  const reviewedId = q.id;
  await page.locator("#dailyGoal").selectOption("5");
  await page.locator("#themeBtn").click();
  await page.reload();
  check(
    (await page.locator("html").getAttribute("data-theme")) === "dark",
    "Theme survives reload",
  );
  check(
    (await page.locator("#dailyGoal").inputValue()) === "5",
    "Daily goal survives reload",
  );
  await page.evaluate((id) => {
    const s = JSON.parse(localStorage.getItem("pixellab-study-v2"));
    s.records[id].due = Date.now() - 1000;
    localStorage.setItem("pixellab-study-v2", JSON.stringify(s));
  }, reviewedId);
  await page.reload();
  await page.locator("#dueShortcut").click();
  check(
    (await current()).id === reviewedId,
    "Due filter returns scheduled question",
  );
  await page.locator("#flashTab").click();
  await page.locator("#revealBtn").click();
  await page.locator('[data-rating="good"]').click();
  data = await store();
  check(
    data.records[reviewedId].stage === 1,
    "Good flashcard advances scheduling",
  );
  await page.locator('[data-view="progress"]').click();
  check(
    (await page.locator(".topic-row").count()) === 12,
    "All twelve topics have progress",
  );
  check(
    (await page.locator(".activity-day").count()) === 7,
    "Seven-day activity chart renders",
  );
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#exportBtn").click();
  const download = await downloadPromise;
  check(
    download.suggestedFilename().endsWith(".json"),
    "Backup downloads JSON",
  );
  const backup = await store();
  const accept = (dialog) => dialog.accept();
  page.on("dialog", accept);
  await page.locator("#resetBtn").click();
  check(
    Object.keys((await store()).records).length === 0,
    "Reset removes study records",
  );
  await page
    .locator("#importFile")
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
  await page.waitForFunction(
    () =>
      Object.keys(JSON.parse(localStorage.getItem("pixellab-study-v2")).records)
        .length > 0,
  );
  check(
    Object.keys((await store()).records).length ===
      Object.keys(backup.records).length,
    "Backup restores records",
  );
  await page
    .locator("#importFile")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from("{broken"),
    });
  await page.waitForFunction(() =>
    document.getElementById("toast").textContent.includes("Không thể nhập"),
  );
  check(
    Object.keys((await store()).records).length ===
      Object.keys(backup.records).length,
    "Invalid backup does not overwrite progress",
  );
  page.off("dialog", accept);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      "pixellab-quiz-v1",
      JSON.stringify({
        0: { correct: false, last: 1000000 },
        1: { correct: true, last: 1000001 },
      }),
    );
  });
  await page.reload();
  check(
    (await page.locator("#attempted").textContent()).startsWith("2"),
    "Legacy history migrated",
  );
  await page.locator("#dueShortcut").click();
  check(
    (await page.locator("#counter").textContent()) === "Câu 1 / 2",
    "Legacy questions available for review",
  );

  await page.locator('[data-mode="all"]').click();
  await page.locator("#topicSelect").selectOption("Fourier");
  await page.locator("#sourceSelect").selectOption("PDF");
  check(
    (await page.locator("#topicTag").textContent()) === "Fourier" &&
      (await page.locator("#sourceTag").textContent()).includes("PDF"),
    "Topic and source filters combine",
  );
  await page.locator("#sessionSize").selectOption("all");
  let count = 0;
  while ((await page.locator("#questionArea").isVisible()) && count < 100) {
    await page.locator("#skipBtn").click();
    count++;
  }
  check(
    await page.locator("#emptyArea").isVisible(),
    "Skipping all questions finishes session",
  );
  check(
    (await page.locator("#sessionSummary").textContent()).includes(
      `${count} câu để sau`,
    ),
    "Skipped count accurate",
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `No horizontal overflow at ${width}px`,
    );
  }
  check(errors.length === 0, "No JavaScript runtime errors");
  await page.evaluate((result) => (window.__testResult = result), {
    passed: passed.length,
    checks: passed,
    failures,
    errors,
  });
}