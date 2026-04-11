const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const childProcesses = new Set();
let shuttingDown = false;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode || 0);
    });
    req.on('error', reject);
  });
}

async function waitForUrl(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const status = await httpGet(url);
      if (status >= 200 && status < 500) {
        return;
      }
    } catch (_error) {
      // Server is still starting.
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function spawnNodeProcess(scriptPath, options = {}) {
  const child = spawn(process.execPath, [scriptPath], {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...(options.env || {}),
    },
    windowsHide: true,
  });

  childProcesses.add(child);
  child.on('exit', () => {
    childProcesses.delete(child);
  });

  return child;
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.killed) return;

  await new Promise((resolve) => {
    const done = () => resolve();
    child.once('exit', done);
    child.once('error', done);

    if (isWindows) {
      child.kill();
    } else {
      child.kill('SIGTERM');
    }

    setTimeout(() => {
      if (child.exitCode === null && !child.killed) {
        child.kill('SIGKILL');
      }
      resolve();
    }, 2_000);
  });
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  await Promise.allSettled(Array.from(childProcesses, stopChild));
  process.exit(exitCode);
}

async function main() {
  const staticServer = spawnNodeProcess(path.join('scripts', 'static-server.js'));
  const backendServer = spawnNodeProcess(path.join('backend', 'src', 'server.js'), {
    env: {
      NODE_ENV: 'test',
      USE_SQLITE: 'true',
      PORT: '4100',
      FRONTEND_ORIGIN: 'http://localhost:4173,http://127.0.0.1:4173',
    },
  });

  const failFast = (name) => (code) => {
    if (!shuttingDown && code !== 0) {
      console.error(`${name} exited before Playwright completed (code ${code ?? 'unknown'}).`);
      shutdown(typeof code === 'number' ? code : 1);
    }
  };

  staticServer.once('exit', failFast('Static server'));
  backendServer.once('exit', failFast('Backend server'));

  await waitForUrl('http://127.0.0.1:4173', 15_000);
  await waitForUrl('http://127.0.0.1:4100/health', 20_000);

  const e2eArgs = [path.join('scripts', 'e2e-direct.js'), ...process.argv.slice(2)];
  const playwright = spawn(process.execPath, e2eArgs, {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
    windowsHide: true,
  });

  childProcesses.add(playwright);
  playwright.on('exit', async (code) => {
    childProcesses.delete(playwright);
    await shutdown(code ?? 1);
  });
  playwright.on('error', async (error) => {
    console.error('Failed to start Playwright:', error);
    await shutdown(1);
  });
}

process.on('SIGINT', () => {
  shutdown(130);
});

process.on('SIGTERM', () => {
  shutdown(143);
});

main().catch(async (error) => {
  console.error(error.stack || error.message || error);
  await shutdown(1);
});
