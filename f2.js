// ---------------------------------------------------------------
// Config
// ---------------------------------------------------------------
// If the page is served by the Flask app itself (recommended), use a relative
// path. If opened directly as a file (file://) or from a different static
// server, fall back to the local API port.
const API_BASE = window.location.protocol === "http:" || window.location.protocol === "https:"
  ? ""
  : "http://127.0.0.1:5000";

// ---------------------------------------------------------------
// Ambient particle background
// ---------------------------------------------------------------
(function initParticles() {
  const canvas = document.getElementById("bg-canvas");
  const ctx = canvas.getContext("2d");
  let particles = [];
  const colors = ["#00C6FF", "#7B2FF7", "#00F5FF", "#FF4ECD", "#00FFB2"];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  function makeParticles() {
    const count = Math.min(70, Math.floor((canvas.width * canvas.height) / 22000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.8 + 0.6,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: Math.random() * 0.5 + 0.15,
    }));
  }
  makeParticles();
  window.addEventListener("resize", makeParticles);

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(tick);
  }
  tick();
})();

// Mouse glow
const mouseGlow = document.getElementById("mouseGlow");
window.addEventListener("mousemove", (e) => {
  mouseGlow.style.left = e.clientX + "px";
  mouseGlow.style.top = e.clientY + "px";
});

// ---------------------------------------------------------------
// Upload flow
// ---------------------------------------------------------------
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const fileChip = document.getElementById("fileChip");
const fileChipName = document.getElementById("fileChipName");
const fileChipRemove = document.getElementById("fileChipRemove");
const analyzeBtn = document.getElementById("analyzeBtn");
const scanState = document.getElementById("scanState");
const scanBarFill = document.getElementById("scanBarFill");
const scanStatus = document.getElementById("scanStatus");
const errorBanner = document.getElementById("errorBanner");
const dashboard = document.getElementById("dashboard");
const jobTitleSelect = document.getElementById("jobTitle");

let selectedFile = null;

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});
fileChipRemove.addEventListener("click", () => {
  selectedFile = null;
  fileChip.hidden = true;
  analyzeBtn.disabled = true;
  fileInput.value = "";
});

function handleFile(file) {
  hideError();
  const okExt = /\.(pdf|docx|txt)$/i.test(file.name);
  if (!okExt) {
    showError("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    showError("File too large — please upload something under 8MB.");
    return;
  }
  selectedFile = file;
  fileChipName.textContent = `${file.name} · ${(file.size / 1024).toFixed(0)} KB`;
  fileChip.hidden = false;
  analyzeBtn.disabled = false;
}

function showError(msg) {
  errorBanner.textContent = msg;
  errorBanner.hidden = false;
}
function hideError() {
  errorBanner.hidden = true;
}

analyzeBtn.addEventListener("click", async () => {
  if (!selectedFile) return;
  hideError();
  await runAnalysis(selectedFile, jobTitleSelect.value);
});

document.getElementById("analyzeAnotherBtn").addEventListener("click", () => {
  dashboard.hidden = true;
  document.getElementById("upload").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("tryDemoBtn").addEventListener("click", async (e) => {
  e.preventDefault();
  document.getElementById("upload").scrollIntoView({ behavior: "smooth" });
  const demoText = buildDemoResumeText();
  const demoFile = new File([demoText], "demo-resume.txt", { type: "text/plain" });
  handleFile(demoFile);
});
document.getElementById("navSample").addEventListener("click", async (e) => {
  e.preventDefault();
  const demoText = buildDemoResumeText();
  const demoFile = new File([demoText], "sample-resume.txt", { type: "text/plain" });
  await runAnalysis(demoFile, "AI Engineer");
});

function buildDemoResumeText() {
  return `Jordan Lee
jordan.lee@email.com | (555) 987-6543

Summary
AI Engineer with 4 years of experience designing and deploying machine learning
systems at scale, specializing in NLP and LLM applications.

Skills
Python, PyTorch, TensorFlow, Machine Learning, Deep Learning, LLM, NLP, AWS, Docker, SQL, Kubernetes

Experience
AI Engineer, Vertex Labs (2022-2026)
- Led the development of a production LLM pipeline, reducing inference latency by 45%
- Built and deployed 3 machine learning models used by over 50,000 users
- Architected a scalable data pipeline on AWS, cutting infrastructure costs by 30%
- Mentored 2 junior engineers and improved model training workflow efficiency by 25%

Machine Learning Engineer, DataForge (2020-2022)
- Developed NLP models for sentiment classification with 92% accuracy
- Automated the model retraining pipeline using Docker and Kubernetes
- Collaborated cross-functionally with product and data science teams

Education
M.S. Computer Science, Artificial Intelligence Track — Tech University

Certifications
AWS Certified Machine Learning Specialty
`;
}

// ---------------------------------------------------------------
// Run analysis against backend
// ---------------------------------------------------------------
async function runAnalysis(file, jobTitle) {
  analyzeBtn.disabled = true;
  scanState.hidden = false;
  animateScanBar();

  const formData = new FormData();
  formData.append("resume", file);
  if (jobTitle) formData.append("job_title", jobTitle);

  try {
    const res = await fetch(`${API_BASE}/api/analyze`, { method: "POST", body: formData });
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || "Something went wrong analyzing this resume.");
      scanState.hidden = true;
      analyzeBtn.disabled = false;
      return;
    }

    renderDashboard(data);
    dashboard.hidden = false;
    scanState.hidden = true;
    analyzeBtn.disabled = false;
    setTimeout(() => dashboard.scrollIntoView({ behavior: "smooth" }), 100);
  } catch (err) {
    scanState.hidden = true;
    analyzeBtn.disabled = false;
    showError(
      "Couldn't reach the analysis engine at " + API_BASE +
      ". Make sure the backend is running (see README) — run `python app.py` in the backend folder."
    );
  }
}

function animateScanBar() {
  const stages = [
    "Reading document structure…",
    "Extracting skills and keywords…",
    "Scoring ATS compatibility…",
    "Matching against job profiles…",
  ];
  let i = 0;
  scanBarFill.style.width = "0%";
  scanStatus.textContent = stages[0];
  const interval = setInterval(() => {
    i++;
    if (i >= stages.length) {
      clearInterval(interval);
      return;
    }
    scanStatus.textContent = stages[i];
    scanBarFill.style.width = `${(i / (stages.length - 1)) * 90}%`;
  }, 450);
  setTimeout(() => { scanBarFill.style.width = "95%"; }, 100);
}

// ---------------------------------------------------------------
// Render dashboard
// ---------------------------------------------------------------
let radarChartInstance = null;

function renderDashboard(data) {
  // ATS score ring
  const scoreNum = document.getElementById("scoreNum");
  const ringFill = document.getElementById("ringFill");
  const scoreVerdict = document.getElementById("scoreVerdict");
  const circumference = 540;

  animateNumber(scoreNum, data.ats_score, 1200);
  const offset = circumference - (circumference * data.ats_score) / 100;
  requestAnimationFrame(() => { ringFill.style.strokeDashoffset = offset; });

  let color = "#FF5C7A", verdict = "Needs work — several structural gaps.";
  if (data.ats_score >= 80) { color = "#00FFB2"; verdict = "Excellent — strong ATS compatibility."; }
  else if (data.ats_score >= 60) { color = "#00C6FF"; verdict = "Good — a few improvements will help."; }
  else if (data.ats_score >= 40) { color = "#FFC15C"; verdict = "Fair — review the suggestions below."; }
  ringFill.style.stroke = color;
  scoreVerdict.textContent = verdict;

  document.getElementById("dashboardSub").textContent =
    `${data.word_count} words · ${data.action_verb_count} action verbs · ${data.quantified_achievement_count} quantified achievements detected.`;

  // Strength meters
  const meterList = document.getElementById("meterList");
  meterList.innerHTML = "";
  const meters = [
    ["Contact completeness", (data.has_email && data.has_phone) ? 100 : (data.has_email || data.has_phone) ? 55 : 10, "#00C6FF"],
    ["Section structure", Math.min(100, Object.keys(data.sections_detected).length * 20), "#7B2FF7"],
    ["Action-verb usage", Math.min(100, data.action_verb_count * 12), "#00F5FF"],
    ["Quantified impact", Math.min(100, data.quantified_achievement_count * 10), "#FF4ECD"],
    ["Overall length balance", data.word_count >= 300 && data.word_count <= 900 ? 100 : 55, "#00FFB2"],
  ];
  meters.forEach(([label, pct, col], idx) => {
    const row = document.createElement("div");
    row.className = "meter-row";
    row.innerHTML = `
      <div class="meter-row-top"><span>${label}</span><b>${pct}%</b></div>
      <div class="meter-track"><div class="meter-fill" style="background:${col}"></div></div>
    `;
    meterList.appendChild(row);
    const fill = row.querySelector(".meter-fill");
    setTimeout(() => { fill.style.width = pct + "%"; }, 100 + idx * 100);
  });

  // Skill radar chart
  const categories = Object.keys(data.skills);
  const values = categories.map((c) => data.skills[c].percent);
  const radarCtx = document.getElementById("radarChart").getContext("2d");
  if (radarChartInstance) radarChartInstance.destroy();
  radarChartInstance = new Chart(radarCtx, {
    type: "radar",
    data: {
      labels: categories,
      datasets: [{
        label: "Skill coverage",
        data: values,
        backgroundColor: "rgba(0,198,255,0.18)",
        borderColor: "#00C6FF",
        pointBackgroundColor: "#7B2FF7",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: { color: "rgba(255,255,255,0.08)" },
          grid: { color: "rgba(255,255,255,0.08)" },
          pointLabels: { color: "#8E9AC2", font: { size: 11, family: "Poppins" } },
          ticks: { display: false, backdropColor: "transparent" },
          suggestedMin: 0, suggestedMax: 100,
        },
      },
      plugins: { legend: { display: false } },
    },
  });

  // Suggestions
  const suggestionList = document.getElementById("suggestionList");
  suggestionList.innerHTML = "";
  data.suggestions.forEach((s, idx) => {
    const item = document.createElement("div");
    item.className = "suggestion-item";
    item.style.animationDelay = `${idx * 80}ms`;
    item.innerHTML = `<span class="check">✓</span><span>${escapeHtml(s)}</span>`;
    suggestionList.appendChild(item);
  });

  // Job match
  const jm = data.job_match;
  document.getElementById("jobMatchTitle").textContent = jm.job_title;
  document.getElementById("jmSalary").textContent = jm.salary_estimate;
  animateNumber(document.getElementById("jobMatchPct"), jm.match_percent, 1000);
  const jobRingCirc = 364;
  const jobOffset = jobRingCirc - (jobRingCirc * jm.match_percent) / 100;
  requestAnimationFrame(() => { document.getElementById("jobRingFill").style.strokeDashoffset = jobOffset; });

  fillPills("jmMatched", jm.matched_skills);
  fillPills("jmMissing", jm.missing_skills);
  fillPills("jmCourses", jm.recommended_learning);

  // Keyword optimizer
  fillPills("kwFound", data.top_keywords.slice(0, 12));
  fillPills("kwMissing", data.missing_keywords);
}

function fillPills(containerId, items) {
  const el = document.getElementById(containerId);
  el.innerHTML = "";
  if (!items || items.length === 0) {
    el.innerHTML = `<span style="color:var(--text-dim); font-size:12.5px;">None detected</span>`;
    return;
  }
  items.forEach((item) => {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = item;
    el.appendChild(pill);
  });
}

function animateNumber(el, target, duration) {
  const start = 0;
  const startTime = performance.now();
  function step(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}