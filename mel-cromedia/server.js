// MelCromedia HTTP Web Server
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8082;
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.swf': 'application/x-shockwave-flash',
  '.fla': 'application/octet-stream',
  '.png': 'image/png'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/src/index.html';

  let filePath = path.join(__dirname, reqPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'src', reqPath);
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`MelCromedia server running at http://localhost:${PORT}`);
});
