const http = require('node:http');

class ApiServer {
  constructor({ config, fanController, logger = console }) {
    this.config = config;
    this.fanController = fanController;
    this.logger = logger;
    this.server = null;
  }

  isAuthValid(headers) {
    const authHeader = headers.authorization || headers.Authorization;
    if (!authHeader) {
      return false;
    }

    const [scheme, token] = String(authHeader).split(' ');
    return scheme?.toLowerCase() === 'bearer' && token === this.config.authToken;
  }

  writeJson(response, statusCode, payload) {
    const body = JSON.stringify(payload);
    response.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body)
    });
    response.end(body);
  }

  async readJsonBody(request) {
    const chunks = [];

    for await (const chunk of request) {
      chunks.push(chunk);
    }

    const bodyText = Buffer.concat(chunks).toString('utf8').trim();
    if (!bodyText) {
      return {};
    }

    try {
      return JSON.parse(bodyText);
    } catch (error) {
      throw new Error('Invalid JSON body.');
    }
  }

  async handleRequest(request, response) {
    if (!this.isAuthValid(request.headers)) {
      this.writeJson(response, 401, { error: 'Unauthorized' });
      return;
    }

    const url = new URL(request.url || '/', 'http://localhost');

    if (request.method === 'GET' && url.pathname === '/api/v1/status') {
      this.writeJson(response, 200, {
        status: this.fanController.getStatus()
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/mode') {
      const body = await this.readJsonBody(request);
      if (!['auto', 'manual'].includes(String(body.mode || '').toLowerCase())) {
        this.writeJson(response, 400, { error: 'Body must include mode: "auto" or "manual".' });
        return;
      }

      const status = await this.fanController.setControlMode(body.mode);
      this.writeJson(response, 200, { status });
      return;
    }

    this.writeJson(response, 404, { error: 'Not found' });
  }

  async start() {
    if (!this.config.enabled) {
      return;
    }

    if (this.server) {
      return;
    }

    this.server = http.createServer((request, response) => {
      this.handleRequest(request, response).catch((error) => {
        this.logger.error(`API request failed: ${error.message}`);
        if (!response.headersSent) {
          this.writeJson(response, 500, { error: 'Internal server error' });
        }
      });
    });

    await new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.config.port, this.config.host, resolve);
    });

    this.logger.info(`API server listening on http://${this.config.host}:${this.config.port}`);
  }

  async stop() {
    if (!this.server) {
      return;
    }

    const activeServer = this.server;
    this.server = null;

    await new Promise((resolve, reject) => {
      activeServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

module.exports = {
  ApiServer
};
