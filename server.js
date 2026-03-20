const net = require('net');
const http = require('http');
const https = require('https');
const { createServer } = require('net');

const PORT = process.env.PORT || 3000;

// ── Servidor HTTP CONNECT proxy ──────────────────────
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('NexTunnel Proxy Server Running');
});

// HTTP CONNECT — para HTTPS, SSL, WS, VLESS, VMESS
server.on('connect', (req, clientSocket, head) => {
  const [host, port] = req.url.split(':');
  const targetPort = parseInt(port) || 443;

  console.log(`[CONNECT] ${host}:${targetPort}`);

  const serverSocket = net.connect(targetPort, host, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head && head.length) serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  serverSocket.on('error', (err) => {
    console.error(`[CONNECT ERROR] ${err.message}`);
    clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
  });

  clientSocket.on('error', () => serverSocket.destroy());
  serverSocket.on('close', () => clientSocket.destroy());
  clientSocket.on('close', () => serverSocket.destroy());
});

// HTTP normal — para tweaks HTTP
server.on('request', (req, res) => {
  const urlObj = new URL(req.url.startsWith('http') ? req.url : `http://${req.headers.host}${req.url}`);
  const bugHost = req.headers['x-bug-host'] || req.headers['host'] || urlObj.hostname;

  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || 80,
    path: urlObj.pathname + urlObj.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: bugHost,
      'Host': bugHost,
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[HTTP ERROR] ${err.message}`);
    res.writeHead(502);
    res.end('Bad Gateway');
  });

  req.pipe(proxyReq);
});

// TCP raw — para SSH
const tcpServer = createServer((clientSocket) => {
  const targetHost = process.env.SSH_HOST || 'localhost';
  const targetPort = parseInt(process.env.SSH_PORT) || 22;

  const serverSocket = net.connect(targetPort, targetHost, () => {
    clientSocket.pipe(serverSocket);
    serverSocket.pipe(clientSocket);
  });

  serverSocket.on('error', () => clientSocket.destroy());
  clientSocket.on('error', () => serverSocket.destroy());
});

server.listen(PORT, () => {
  console.log(`[NexTunnel Proxy] HTTP/CONNECT/SSL/WS a correr na porta ${PORT}`);
});

tcpServer.listen(parseInt(PORT) + 1, () => {
  console.log(`[NexTunnel Proxy] SSH/TCP a correr na porta ${parseInt(PORT) + 1}`);
});
