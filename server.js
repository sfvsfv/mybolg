/**
 * ======================================================
 * 技术博客 Server
 * ======================================================
 * ✔ 文章 CRUD
 * ✔ 图片 / 文件上传
 * ✔ 管理员登录（简单 JWT）
 * ✔ 静态前端托管
 * ✔ 粘贴图片 / markdown 图片支持
 * ======================================================
 */

const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const jwt = require("jsonwebtoken");

/* ================== 基础配置 ================== */

const app = express();
const PORT = 3000;

/** ⚠️ 生产环境请改 */
const ADMIN_PASSWORD = "666";
const JWT_SECRET = "blog-secret-key";

/* ================== 路径定义 ================== */

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const POST_FILE = path.join(DATA_DIR, "posts.json");
const UPLOAD_DIR = path.join(ROOT, "uploads");

/* ================== 初始化目录 ================== */

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(POST_FILE)) fs.writeFileSync(POST_FILE, "[]");

/* ================== 中间件 ================== */

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* 前端静态资源 */
app.use(express.static(path.join(ROOT, "public")));

/* 图片 / 文件访问 */
app.use("/uploads", express.static(UPLOAD_DIR));

/* ================== 工具函数 ================== */

function readPosts() {
  return JSON.parse(fs.readFileSync(POST_FILE, "utf-8"));
}

function savePosts(data) {
  fs.writeFileSync(POST_FILE, JSON.stringify(data, null, 2));
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ msg: "未登录" });

  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ msg: "登录失效" });
  }
}

/* ================== 登录 ================== */

app.post("/api/login", (req, res) => {
  const { password } = req.body;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ msg: "密码错误" });
  }

  const token = jwt.sign({ role: "admin" }, JWT_SECRET, {
    expiresIn: "24h",
  });

  res.json({ token });
});

/* ================== 文章接口 ================== */

/** 获取文章列表 */
app.get("/api/posts", (req, res) => {
  const posts = readPosts().sort((a, b) => b.id - a.id);
  res.json(posts);
});

/** 单篇文章 */
app.get("/api/posts/:id", (req, res) => {
  const post = readPosts().find(p => p.id == req.params.id);
  if (!post) return res.status(404).end();
  res.json(post);
});

/** 新建文章 */
app.post("/api/posts", authMiddleware, (req, res) => {
  const { title, content } = req.body;
  if (!title) return res.status(400).json({ msg: "缺少标题" });

  const posts = readPosts();

  const post = {
    id: Date.now(),
    title,
    content,
    createdAt: new Date().toISOString(),
  };

  posts.unshift(post);
  savePosts(posts);

  res.json(post);
});

/** 更新文章 */
app.put("/api/posts/:id", authMiddleware, (req, res) => {
  const posts = readPosts();
  const index = posts.findIndex(p => p.id == req.params.id);
  if (index === -1) return res.status(404).end();

  posts[index].title = req.body.title;
  posts[index].content = req.body.content;
  posts[index].updatedAt = new Date().toISOString();

  savePosts(posts);
  res.json(posts[index]);
});

/** 删除文章 */
app.delete("/api/posts/:id", authMiddleware, (req, res) => {
  const posts = readPosts().filter(p => p.id != req.params.id);
  savePosts(posts);
  res.json({ ok: true });
});

/* ================== 上传系统 ================== */

/** 文件名控制 */
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + "-" + Math.random().toString(16).slice(2) + ext;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

/** 上传图片 / 文件（编辑器 & 粘贴用） */
app.post(
  "/api/upload",
  authMiddleware,
  upload.single("file"),
  (req, res) => {
    if (!req.file) return res.status(400).end();
    res.json({
      url: "/uploads/" + req.file.filename,
      filename: req.file.originalname,
    });
  }
);

/* ================== 安全兜底 ================== */

app.use((_, res) => res.status(404).json({ msg: "API Not Found" }));

/* ================== 启动 ================== */

app.listen(PORT, () => {
  console.log("====================================");
  console.log("✅ Blog Server 启动成功");
  console.log(`🌍 http://localhost:${PORT}`);
  console.log("📂 uploads/ 可直接访问");
  console.log("====================================");
});
