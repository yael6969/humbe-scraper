// ─── HUMBE SCRAPER · server.js ────────────────────────────────────────────────
// Local proxy server — keeps credentials out of the browser.

const http     = require("http");
const https    = require("https");
const fs       = require("fs");
const path     = require("path");
const url      = require("url");

// ── Load .env manually (no dependencies needed) ──────────────────────────────
function loadEnv(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    raw.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) return;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    });
  } catch {
    console.warn("[ENV] .env file not found — using system environment only.");
  }
}
loadEnv(path.join(__dirname, ".env"));

// ── Config from env ───────────────────────────────────────────────────────────
const PORT           = parseInt(process.env.PORT || "3000", 10);
const API_TOKEN      = process.env.API_TOKEN || "";
const TEACHER_FILE   = path.resolve(__dirname, process.env.TEACHER_FILE || "./teacher.json");
const STUDENT_BASE   = process.env.STUDENT_API_BASE || "https://api.kelashumabetang.id/api/v1";
const TEACHER_BASE   = process.env.TEACHER_API_BASE || "http://api.kelashumabetang.id/api/v1";
const STUDENT_LIMIT  = process.env.STUDENT_LIMIT || "1000";
const STUDENT_PAGE   = process.env.STUDENT_PAGE  || "1";

// ── MIME types for static files ───────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css" : "text/css; charset=utf-8",
  ".js"  : "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico" : "image/x-icon",
};

// ── Helper: fetch via http/https ──────────────────────────────────────────────
function apiFetch(rawUrl) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(rawUrl);
    const driver  = parsed.protocol === "https:" ? https : http;
    const options = {
      hostname: parsed.hostname,
      port    : parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path    : parsed.pathname + parsed.search,
      method  : "GET",
      headers : {
        "Authorization": `Bearer ${API_TOKEN}`,
        "Accept"       : "application/json",
      },
    };
    const req = driver.request(options, (res) => {
      let data = "";
      res.setEncoding("utf-8");
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

// ── Helper: send JSON ─────────────────────────────────────────────────────────
function sendJSON(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type"                : "application/json; charset=utf-8",
    "Access-Control-Allow-Origin" : "*",
    "Content-Length"              : Buffer.byteLength(body),
  });
  res.end(body);
}

// ── Route: /api/students ──────────────────────────────────────────────────────
async function handleStudents(res) {
  try {
    const endpoint = `${STUDENT_BASE}/students/students?limit=${STUDENT_LIMIT}&page=${STUDENT_PAGE}`;
    const { status, body } = await apiFetch(endpoint);
    if (status !== 200) return sendJSON(res, status, { error: "Upstream error", detail: body });

    // Flatten data — tolerate various response shapes
    const raw = body?.data?.data ?? body?.data ?? body?.students ?? [];

    const clean = raw.map((s) => ({
      name         : s.name          ?? s.full_name      ?? "-",
      username     : s.username      ?? "-",
      email        : s.email         ?? "-",
      phone        : s.phone         ?? s.phone_number   ?? "-",
      address      : s.address       ?? s.alamat         ?? "-",
      birthdate    : s.birthdate     ?? s.birth_date     ?? "-",
      birthplace   : s.birthplace    ?? s.birth_place    ?? "-",
      nik          : s.nik           ?? "-",
      nis          : s.nis           ?? "-",
      nisn         : s.nisn          ?? "-",
      gender       : s.gender        ?? s.sex            ?? s.jenis_kelamin ?? "-",
      profile_image: s.profile_image ?? s.avatar         ?? s.photo ?? s.foto ?? "-",
      kelas        : s.classroom_student?.[0]?.classroom?.name ?? "-",
    }));

    sendJSON(res, 200, { ok: true, count: clean.length, data: clean });
  } catch (err) {
    sendJSON(res, 500, { error: "Failed to fetch students", detail: err.message });
  }
}

// ── Route: /api/teachers ──────────────────────────────────────────────────────
async function handleTeacher(teacherId, res) {
  try {
    const endpoint = `${TEACHER_BASE}/employees/employees/${teacherId}`;
    const { status, body } = await apiFetch(endpoint);
    if (status !== 200) return sendJSON(res, status, { error: "Upstream error", detail: body });

    // Data guru ada di body.employee
    const t = body?.employee ?? body?.data ?? body;

    const v = (val) => (val !== undefined && val !== null && val !== "") ? val : "-";

    const result = {
      name         : v(t.name),
      username     : v(t.username),
      password     : v(t.password),
      address      : v(t.address),
      phone        : v(t.phone),
      gender       : v(t.gender),
      birthdate    : v(t.birthdate   ?? t.birth_date),
      birthplace   : v(t.birthplace  ?? t.birth_place),
      profile_image: v(t.profile_image ?? t.avatar ?? t.photo ?? t.foto),
    };

    sendJSON(res, 200, { ok: true, data: result });
  } catch (err) {
    sendJSON(res, 500, { error: "Failed to fetch teacher", detail: err.message });
  }
}

// ── Route: /api/teachers/list ─────────────────────────────────────────────────
function handleTeacherList(res) {
  try {
    const raw  = fs.readFileSync(TEACHER_FILE, "utf-8");
    const data = JSON.parse(raw);
    sendJSON(res, 200, { ok: true, data });
  } catch (err) {
    sendJSON(res, 500, { error: "Could not read teacher.json", detail: err.message });
  }
}

// ── Static file server ────────────────────────────────────────────────────────
function serveStatic(reqPath, res) {
  const safePath  = reqPath === "/" ? "index.html" : reqPath.replace(/^\//, "");
  const filePath  = path.join(__dirname, safePath);

  // Security: stay within __dirname
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    const ext  = path.extname(filePath);
    const mime = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
}

// ── Main request handler ──────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed  = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // CORS pre-flight
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET" });
    res.end(); return;
  }

  if (req.method !== "GET") { res.writeHead(405); res.end("Method Not Allowed"); return; }

  // API routes
  if (pathname === "/api/students")       return handleStudents(res);
  if (pathname === "/api/teachers/list")  return handleTeacherList(res);

  const teacherMatch = pathname.match(/^\/api\/teachers\/(.+)$/);
  if (teacherMatch) return handleTeacher(teacherMatch[1], res);

  // Static files
  serveStatic(pathname, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  ██╗  ██╗██╗   ██╗███╗   ███╗██████╗ ███████╗`);
  console.log(`  ██║  ██║██║   ██║████╗ ████║██╔══██╗██╔════╝`);
  console.log(`  ███████║██║   ██║██╔████╔██║██████╔╝█████╗  `);
  console.log(`  ██╔══██║██║   ██║██║╚██╔╝██║██╔══██╗██╔══╝  `);
  console.log(`  ██║  ██║╚██████╔╝██║ ╚═╝ ██║██████╔╝███████╗`);
  console.log(`  ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═════╝ ╚══════╝`);
  console.log(`\n  SCRAPER — running on http://localhost:${PORT}\n`);
});
