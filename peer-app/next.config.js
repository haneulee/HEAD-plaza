const { createServer } = require("https");
const { readFileSync } = require("fs");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// 사용 가능한 포트 찾기 함수
const findAvailablePort = (startPort) => {
  const net = require("net");
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      server.close(() => {
        resolve(startPort);
      });
    });

    server.on("error", () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
};

// HTTP 서버 시작
const startServer = async () => {
  try {
    const { createServer } = require("http");
    const port = await findAvailablePort(3000);

    createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(port, (err) => {
      if (err) throw err;
      console.log(`> Ready on http://localhost:${port}`);
    });
  } catch (err) {
    console.error("서버 시작 오류:", err);
  }
};

app.prepare().then(startServer);
