// ─── HUMBE SCRAPER · script.js ────────────────────────────────────────────────

"use strict";

// ── State ─────────────────────────────────────────────────────────────────────
let currentCategory = "student"; // "student" | "teacher"
let studentCache    = null;       // cached student array
let teacherCache    = null;       // cached teacher list array

// ── DOM refs ──────────────────────────────────────────────────────────────────
const searchInput    = document.getElementById("search-input");
const resultsWrap    = document.getElementById("results");
const statusMsg      = document.getElementById("status-msg");
const tabBtns        = document.querySelectorAll(".tab-btn");
const searchBtn      = document.getElementById("search-btn");
const clearBtn       = document.getElementById("clear-btn");

// ── Category tabs ─────────────────────────────────────────────────────────────
tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    currentCategory = btn.dataset.cat;
    tabBtns.forEach((b) => b.classList.toggle("active", b === btn));
    clearResults();
    searchInput.value = "";
    searchInput.focus();
  });
});

// ── Fuzzy search (Levenshtein + substring) ────────────────────────────────────
function fuzzyScore(needle, haystack) {
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();

  // Exact substring → highest priority
  if (h.includes(n)) return 1000 - h.indexOf(n);

  // Token match: all needle words appear somewhere in haystack
  const nTokens = n.split(/\s+/);
  const allTokens = nTokens.every((tok) => h.includes(tok));
  if (allTokens) return 900;

  // Levenshtein distance on shortened strings
  const dist = levenshtein(n, h.slice(0, Math.max(n.length + 4, h.length)));
  const threshold = Math.floor(n.length * 0.45);
  if (dist <= threshold) return 500 - dist * 10;

  return -1; // no match
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function fuzzySearch(query, items, keyFn) {
  return items
    .map((item) => ({ item, score: fuzzyScore(query, keyFn(item)) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

// ── API calls ─────────────────────────────────────────────────────────────────
async function fetchStudents() {
  if (studentCache) return studentCache;
  setStatus("Memuat data siswa…", true);
  const res  = await fetch("/api/students");
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Gagal memuat data siswa");
  studentCache = json.data;
  return studentCache;
}

async function fetchTeacherList() {
  if (teacherCache) return teacherCache;
  const res  = await fetch("/api/teachers/list");
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Gagal memuat daftar guru");
  teacherCache = json.data;
  return teacherCache;
}

async function fetchTeacherDetail(id) {
  const res  = await fetch(`/api/teachers/${encodeURIComponent(id)}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Gagal memuat data guru");
  return json.data;
}

// ── Search handler ────────────────────────────────────────────────────────────
async function doSearch() {
  const query = searchInput.value.trim();
  if (!query) { setStatus("Masukkan nama untuk mencari.", false); return; }

  clearResults();

  try {
    if (currentCategory === "student") {
      await searchStudents(query);
    } else {
      await searchTeachers(query);
    }
  } catch (err) {
    setStatus(`⚠ ${err.message}`, false);
  }
}

async function searchStudents(query) {
  const all     = await fetchStudents();
  const matches = fuzzySearch(query, all, (s) => s.name);
  clearStatus();

  if (!matches.length) {
    setStatus(`Tidak ada siswa yang cocok dengan "${query}".`, false);
    return;
  }

  setStatus(`${matches.length} hasil ditemukan`, false);
  matches.forEach((s) => resultsWrap.appendChild(buildStudentCard(s)));
}

async function searchTeachers(query) {
  setStatus("Mencari guru…", true);
  const list    = await fetchTeacherList();
  const matches = fuzzySearch(query, list, (t) => t.name);
  clearStatus();

  if (!matches.length) {
    setStatus(`Tidak ada guru yang cocok dengan "${query}".`, false);
    return;
  }

  setStatus(`Memuat detail ${matches.length} guru…`, true);

  const details = await Promise.allSettled(
    matches.map((t) => fetchTeacherDetail(t.id).then((d) => ({ ...d, _matchName: t.name })))
  );

  clearStatus();
  let rendered = 0;
  details.forEach((r) => {
    if (r.status === "fulfilled") {
      resultsWrap.appendChild(buildTeacherCard(r.value));
      rendered++;
    }
  });

  setStatus(`${rendered} hasil ditemukan`, false);
}

// ── Card builders ─────────────────────────────────────────────────────────────
function buildStudentCard(s) {
  return buildCard("Siswa", [
    // Identitas
    { label: "Nama",          value: s.name                                          },
    { label: "Foto",          value: s.profile_image, isImage: true, kelas: s.kelas },
    { label: "Gender",        value: s.gender                                        },
    { label: "Tempat Lahir",  value: s.birthplace                                   },
    { label: "Tanggal Lahir", value: s.birthdate                                    },
    // Kontak & akun
    { label: "Username",      value: s.username,  copyable: true },
    { label: "Email",         value: s.email,     copyable: true },
    { label: "Telepon",       value: s.phone,     copyable: true },
    // Data lainnya
    { label: "Alamat",        value: s.address  },
    { label: "NIK",           value: s.nik      },
    { label: "NIS",           value: s.nis      },
    { label: "NISN",          value: s.nisn     },
  ]);
}

function buildTeacherCard(t) {
  const rows = [
    // Identitas
    { label: "Nama",          value: t.name                                    },
    { label: "Foto",          value: t.profile_image, isImage: true            },
    { label: "Gender",        value: t.gender                                  },
    { label: "Tempat Lahir",  value: t.birthplace                              },
    { label: "Tanggal Lahir", value: t.birthdate                               },
    // Kontak & akun
    { label: "Username",      value: t.username, copyable: true                },
    { label: "Password",      value: t.password, copyable: true                },
    { label: "Telepon",       value: t.phone,    copyable: true                },
    // Data lainnya
    { label: "Alamat",        value: t.address                                 },
  ];

  return buildCard("Guru", rows);
}

function buildCard(type, rows) {
  const card = document.createElement("div");
  card.className = "card";

  // ── Copy whole card button ────────────────────────────────────────────────
  const cardText = rows
    .filter((r) => !r.isImage && r.value && r.value !== "-")
    .map((r) => `${r.label}: ${r.value}`)
    .join("\n");

  const copyCardBtn = document.createElement("button");
  copyCardBtn.className = "copy-card-btn";
  copyCardBtn.title     = "Salin semua";
  copyCardBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  copyCardBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    copyToClipboard(cardText, copyCardBtn);
  });
  card.appendChild(copyCardBtn);

  // ── Badge ─────────────────────────────────────────────────────────────────
  const badge = document.createElement("span");
  badge.className = "card-badge";
  badge.textContent = type;
  card.appendChild(badge);

  const grid = document.createElement("div");
  grid.className = "card-grid";

  rows.forEach((entry) => {
    const { label, value, isImage, kelas, copyable } = entry;

    // ── Foto: buat header baris foto+nama+kelas ───────────────────────────
    if (isImage) {
      const nameRow = rows.find((r) => r.label === "Nama");

      const header = document.createElement("div");
      header.className = "card-header-row";

      // Foto
      if (value && value !== "-") {
        const img = document.createElement("img");
        img.className = "card-photo";
        img.src = value;
        img.alt = "Foto";
        img.onerror = () => img.remove();
        header.appendChild(img);
      }

      // Nama + kelas di sebelah kanan foto
      const nameBlock = document.createElement("div");
      nameBlock.className = "card-name-block";

      if (nameRow) {
        const nameEl = document.createElement("div");
        nameEl.className = "card-name";
        nameEl.textContent = nameRow.value || "—";
        nameBlock.appendChild(nameEl);
      }

      if (kelas && kelas !== "-") {
        const kelasEl = document.createElement("span");
        kelasEl.className = "card-kelas";
        kelasEl.textContent = kelas;
        nameBlock.appendChild(kelasEl);
      }

      header.appendChild(nameBlock);
      grid.appendChild(header);
      return;
    }

    // Nama sudah ditangani di blok isImage, skip
    if (label === "Nama") return;

    const rowEl = document.createElement("div");
    rowEl.className = "card-row";

    const lbl = document.createElement("span");
    lbl.className = "card-label";
    lbl.textContent = label;

    const valText = value && value !== "-" ? value : "—";
    const val = document.createElement("span");
    val.className = "card-value";
    val.textContent = valText;

    rowEl.appendChild(lbl);
    rowEl.appendChild(val);

    if (copyable && value && value !== "-") {
      rowEl.appendChild(makeCopyIcon(value, `Salin ${label}`));
    }

    grid.appendChild(rowEl);
  });

  card.appendChild(grid);
  return card;
}


// ── Copy helpers ──────────────────────────────────────────────────────────────
function copyToClipboard(text, el) {
  navigator.clipboard.writeText(text).then(() => {
    showCopyToast(el);
  }).catch(() => {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity  = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showCopyToast(el);
  });
}

function showCopyToast(anchorEl) {
  const toast = document.createElement("div");
  toast.className = "copy-toast";
  toast.textContent = "Tersalin!";
  document.body.appendChild(toast);

  const rect = anchorEl.getBoundingClientRect();
  toast.style.top  = (rect.top + window.scrollY - 32) + "px";
  toast.style.left = (rect.left + rect.width / 2)     + "px";

  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 200);
  }, 1200);
}

function makeCopyIcon(text, title) {
  const btn = document.createElement("button");
  btn.className   = "copy-icon-btn";
  btn.title       = title || "Salin";
  btn.innerHTML   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    copyToClipboard(text, btn);
  });
  return btn;
}

// ── Status helpers ────────────────────────────────────────────────────────────
function setStatus(msg, loading = false) {
  statusMsg.textContent = msg;
  statusMsg.dataset.loading = loading ? "true" : "false";
  statusMsg.style.display = "block";
}
function clearStatus() {
  statusMsg.style.display = "none";
}
function clearResults() {
  resultsWrap.innerHTML = "";
  clearStatus();
}

// ── Event listeners ───────────────────────────────────────────────────────────
searchBtn.addEventListener("click", doSearch);
clearBtn.addEventListener("click", () => {
  searchInput.value = "";
  clearResults();
  searchInput.focus();
});
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch();
});
