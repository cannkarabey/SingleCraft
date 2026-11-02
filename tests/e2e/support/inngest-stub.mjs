// Accepts Inngest events during e2e runs (the app sends to http://localhost:8288 in dev
// mode). Nothing executes them: tests simulate the job's result with the service role.
import { createServer } from "node:http";

let n = 0;
createServer((req, res) => {
  req.resume();
  req.on("end", () => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ids: [`e2e-${++n}`], status: 200 }));
  });
}).listen(8288, () => console.log("inngest stub on :8288"));
