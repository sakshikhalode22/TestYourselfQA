// Load questions.json and initialize quiz (no static import to avoid module errors)
document.addEventListener("DOMContentLoaded", async () => {
  let QUESTIONS = [];
  // get all questions
  /*try {
    const res = await fetch("./data/questions.json");
    if (!res.ok)
      throw new Error(`Failed to load questions.json: ${res.status}`);
    QUESTIONS = await res.json();
  } catch (err) {
    console.error(err);
    document.getElementById("qText").textContent = "Failed to load questions.";
    return;
  }*/

  // get a random sample of up to 50 questions
  try {
    const res = await fetch("./data/questions.json");
    if (!res.ok)
      throw new Error(`Failed to load questions.json: ${res.status}`);
    QUESTIONS = await res.json();

    // --- pick a random sample of up to 50 questions ---
    function shuffleArray(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
    const SAMPLE_SIZE = 50;
    if (QUESTIONS.length > SAMPLE_SIZE) {
      QUESTIONS = shuffleArray(QUESTIONS).slice(0, SAMPLE_SIZE);
    }
    // ---------------------------------------------------
  } catch (err) {
    console.error(err);
    document.getElementById("qText").textContent = "Failed to load questions.";
    return;
  }

  const TOTAL = QUESTIONS.length;
  document.getElementById("qTotal").textContent = TOTAL;

  let current = 0;
  let graded = false;
  QUESTIONS.forEach((q) => (q.userAnswer = []));

  // Render helpers
  function escapeHtml(s) {
    if (!s) return "";
    return s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function renderQuestion(i) {
    const q = QUESTIONS[i];
    document.getElementById("qIndex").textContent = i + 1;
    const percent = Math.round(((i + 1) / TOTAL) * 100);
    document.getElementById("progBar").style.width = percent + "%";
    const qText = document.getElementById("qText");
    qText.innerHTML = `<strong>Q${i + 1}.</strong> ${escapeHtml(q.text)}`;

    const form = document.getElementById("optionsForm");
    form.innerHTML = "";
    const type = q.type === "single" ? "radio" : "checkbox";
    q.options.forEach((opt, idx) => {
      const id = `q${i}_opt${idx}`;
      const wrapper = document.createElement("label");
      wrapper.className = "option";
      wrapper.htmlFor = id;
      wrapper.innerHTML = `
  <input type="${type}" name="opt" id="${id}" value="${idx}" ${
        q.userAnswer.includes(idx) ? "checked" : ""
      } />
  <div>
    <div class="opt-title">${String.fromCharCode(65 + idx)}. ${escapeHtml(
        opt
      )}</div>
  </div>
`;
      form.appendChild(wrapper);
      const input = wrapper.querySelector("input");
      input.addEventListener("change", (e) => {
        if (q.type === "single") {
          q.userAnswer = [parseInt(e.target.value)];
        } else {
          const val = parseInt(e.target.value);
          if (e.target.checked) {
            if (!q.userAnswer.includes(val)) q.userAnswer.push(val);
          } else {
            q.userAnswer = q.userAnswer.filter((x) => x !== val);
          }
        }
        // Only update per-question UI when graded
        if (graded) showPerQuestionFeedback(i);
      });
    });

    // clear feedback/answer line unless graded
    document.getElementById("feedback").textContent = graded
      ? document.getElementById("feedback").textContent
      : "";
    document.getElementById("answerLine").textContent = graded
      ? document.getElementById("answerLine").textContent
      : "";
    if (graded) showPerQuestionFeedback(i);
  }

  // ...existing code...
  let submitted = false;

  // initial UI: hide Check until explicit submit; 
  document.getElementById("btnCheck").style.display = "none";
// ...existing code...

  document.getElementById("btnShow").addEventListener("click", (e) => {
    e.preventDefault();
    showAnswerFor(current);
  });
  document.getElementById("btnCheck").addEventListener("click", (e) => {
    e.preventDefault();
    gradeAll();
  });

  // Submit button: confirm, then enable checking and adjust UI
  document.getElementById("btnSubmit").addEventListener("click", (e) => {
    e.preventDefault();
    if (!confirm("Are you sure you want to submit the exam?")) return;
    submitted = true;
    // enable check answers and show the Show Answer button
    document.getElementById("btnCheck").style.display = "";
    document.getElementById("btnShow").style.display = "none";
    // hide navigation once submitted
    document.getElementById("btnPrev").style.display = "none";
    document.getElementById("btnNext").style.display = "none";
    document.getElementById("btnSubmit").style.display = "none";
  });

  // wire controls
  document.getElementById("btnNext").addEventListener("click", (e) => {
    e.preventDefault();
    if (current < TOTAL - 1) {
      current++;
      renderQuestion(current);
    }
  });
  document.getElementById("btnPrev").addEventListener("click", (e) => {
    e.preventDefault();
    if (current > 0) {
      current--;
      renderQuestion(current);
    }
  });
  // Show answer button will only display the answer text, not mark options as correct/wrong
  document.getElementById("btnShow").addEventListener("click", (e) => {
    e.preventDefault();
    showAnswerFor(current);
  });
  document.getElementById("btnCheck").addEventListener("click", (e) => {
    e.preventDefault();
    gradeAll();
  });
  document.getElementById("btnRestart").addEventListener("click", (e) => {
    e.preventDefault();
    if (!confirm("Restart and clear answers?")) return;
    QUESTIONS.forEach((q) => (q.userAnswer = []));
    graded = false;
    current = 0;
    document.getElementById("finalScore").textContent = "";
    document.getElementById("resultsPanel").style.display = "none";
    document.getElementById("quizCard").style.display = "block";
    renderQuestion(current);
  });

  document.getElementById("downloadBtn").addEventListener("click", (e) => {
    e.preventDefault();
    const payload = QUESTIONS.map((q) => ({
      id: q.id,
      text: q.text,
      userAnswer: q.userAnswer,
      correct: q.answers,
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "copilot-quiz-results.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  // grading helpers
  function arraysEq(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.every((v, i) => v === sb[i]);
  }

  // Do NOT apply .correct/.wrong classes unless graded === true
  function showAnswerFor(i) {
    const q = QUESTIONS[i];
    const ansLetters = q.answers
      .map((x) => String.fromCharCode(65 + x))
      .join(", ");
    const ua = q.userAnswer.length
      ? q.userAnswer.map((x) => String.fromCharCode(65 + x)).join(", ")
      : "No answer";
    // only show answer text; do not mark options
    document.getElementById(
      "answerLine"
    ).textContent = `Answer: ${ansLetters} · Your answer: ${ua}`;
    const ok = arraysEq(q.answers, q.userAnswer);
    document.getElementById("feedback").textContent = ok
      ? "Correct ✅"
      : "Incorrect ❌";
  }

  function showPerQuestionFeedback(i) {
    if (!graded) return; // safety: never show feedback unless graded
    const q = QUESTIONS[i];
    const form = document.getElementById("optionsForm");
    const labels = Array.from(form.querySelectorAll("label.option"));
    labels.forEach((lbl, idx) => {
      lbl.classList.remove("correct", "wrong");
      if (q.answers.includes(idx)) lbl.classList.add("correct");
      if (q.userAnswer.includes(idx) && !q.answers.includes(idx))
        lbl.classList.add("wrong");
    });
    // const ansLetters = q.answers
    //   .map((x) => String.fromCharCode(65 + x))
    //   .join(", ");
    // const ua = q.userAnswer.length
    //   ? q.userAnswer.map((x) => String.fromCharCode(65 + x)).join(", ")
    //   : "No answer";
    // const ok = arraysEq(q.answers, q.userAnswer);
    // document.getElementById("feedback").textContent = ok
    //   ? "Correct ✅"
    //   : "Incorrect ❌";
    // document.getElementById(
    //   "answerLine"
    // ).textContent = `Correct: ${ansLetters} · Your answer: ${ua}`;
  }

  function renderResults() {
    const container = document.getElementById("resultsSummary");
    container.innerHTML = "";
    let correctCount = 0;
    QUESTIONS.forEach((q, idx) => {
      const ok = arraysEq(q.answers, q.userAnswer);
      if (ok) correctCount++;
      const row = document.createElement("div");
      row.className = "result-row " + (ok ? "correct" : "wrong");
      const ua = q.userAnswer.length
        ? q.userAnswer.map((x) => String.fromCharCode(65 + x)).join(", ")
        : "No answer";
      const ca = q.answers.map((x) => String.fromCharCode(65 + x)).join(", ");
      row.innerHTML = `
                <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
                  <div style="flex:1">
                    <div><strong>Q${idx + 1}.</strong> ${escapeHtml(
        q.text
      )}</div>
                    <div class="meta-line">Correct: ${ca} · Your answer: ${escapeHtml(
        ua
      )}</div>
                  </div>
                  <div style="margin-left:12px; font-weight:700; color:${
                    ok ? "var(--success)" : "var(--danger)"
                  }">${ok ? "Correct" : "Incorrect"}</div>
                </div>
            `;
      container.appendChild(row);
    });
    const percent = Math.round((correctCount / TOTAL) * 100);
    document.getElementById(
      "finalScore"
    ).textContent = `Score: ${correctCount} / ${TOTAL} (${percent}%)`;
    document.getElementById("resultsPanel").style.display = "block";
    if (current >= 0 && current < TOTAL) showPerQuestionFeedback(current);
    window.scrollTo({
      top: document.getElementById("resultsPanel").offsetTop - 10,
      behavior: "smooth",
    });
  }

  function gradeAll() {
    // display none quiztion panels
    document.getElementById("quizCard").style.display = "none";
    graded = true;
    QUESTIONS.forEach((q) => {
      if (!Array.isArray(q.userAnswer)) q.userAnswer = [];
    });
    renderResults();
  }

  // keyboard support
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const q = QUESTIONS[current];
      if (q.type === "single" && q.userAnswer.length === 0) return;
      if (current < TOTAL - 1) {
        current++;
        renderQuestion(current);
      } else gradeAll();
    }
  });

  // init
  renderQuestion(current);
});
