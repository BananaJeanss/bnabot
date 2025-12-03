import http from "http";
import { uptime } from "process";

const hostname = "0.0.0.0";

export default function startHealthServer() {
  const HEALTHSERVER_PORT = parseInt(process.env.HEALTHSERVER_PORT || "3000", 10);

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: "ok",
          uptime: uptime(),
          timestamp: Date.now(),
        })
      );
    } else {
      res.statusCode = 404;
      res.end("Not Found");
    }
  });

  server.listen(HEALTHSERVER_PORT, hostname, () => {
    console.log(
      `Healthcheck server running at http://${hostname}:${HEALTHSERVER_PORT}/`
    );
  });
}
