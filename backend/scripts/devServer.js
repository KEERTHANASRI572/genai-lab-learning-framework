/**
 * Dev Server Process Lifecycle Manager for genai-lab-learning-framework
 *
 * Solves Windows child-process orphaning and duplicate backend instances:
 * 1. Inspects port 5000 and running processes before starting.
 * 2. If port 5000 is occupied:
 *    - Verifies whether the process belongs to this project.
 *    - If project-owned, safely terminates the orphaned process tree and reclaims port 5000.
 *    - If unrelated, reports the foreign process and aborts without touching it.
 * 3. Cleans up any stale tsx watch processes belonging to this repository.
 * 4. Directly spawns tsx watch with Node (avoiding cmd.exe wrapper signal losses).
 * 5. Handles SIGINT, SIGTERM, SIGHUP, SIGBREAK, and exit cleanly:
 *    - On Ctrl+C or terminal shutdown, terminates the entire child process tree (including tsx workers).
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 5000;
const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER_ENTRY = path.resolve(REPO_ROOT, 'src/server.ts');
const TSX_CLI = path.resolve(REPO_ROOT, 'node_modules/tsx/dist/cli.mjs');

function log(msg) {
  console.log(`[dev-server] ${msg}`);
}

function warn(msg) {
  console.warn(`[dev-server] ${msg}`);
}

function error(msg) {
  console.error(`[dev-server] ${msg}`);
}

/**
 * Get process command line and details using PowerShell CIM
 */
function getProcessDetails(pid) {
  if (!pid || pid <= 0) return null;
  try {
    const ps = `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`;
    const cmdLine = execSync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000
    }).trim();
    return { pid, cmdLine };
  } catch {
    return { pid, cmdLine: '' };
  }
}

/**
 * Check if a command line belongs to this project backend
 */
function isProjectProcess(cmdLine) {
  if (!cmdLine) return false;
  const normalized = cmdLine.toLowerCase().replace(/\\/g, '/');
  const projectRootNorm = REPO_ROOT.toLowerCase().replace(/\\/g, '/');
  return (
    normalized.includes(projectRootNorm) ||
    normalized.includes('genai-lab-learning-framework') ||
    (normalized.includes('tsx') && normalized.includes('src/server.ts'))
  );
}

/**
 * Get PIDs currently listening on a TCP port
 */
function getPortListeners(port) {
  try {
    const ps = `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue).OwningProcess`;
    const out = execSync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000
    }).trim();
    if (!out) return [];
    return out
      .split(/\r?\n/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n > 0);
  } catch {
    return [];
  }
}

/**
 * Terminate a process and its entire child process tree
 */
function killProcessTree(pid) {
  if (!pid || pid <= 0) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch {
    // Process may have already exited
  }
}

/**
 * Wait until port is free, up to timeoutMs
 */
function waitForPortToBeFree(port, timeoutMs = 5000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const listeners = getPortListeners(port);
    if (listeners.length === 0) {
      return true;
    }
    // Sleep 200ms
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
  }
  return getPortListeners(port).length === 0;
}

/**
 * Reclaim port 5000 if held by an orphaned project process
 */
function ensurePortFree() {
  const listeners = getPortListeners(PORT);
  if (listeners.length === 0) {
    log(`Port ${PORT} is free.`);
    return;
  }

  log(`Port ${PORT} is occupied by PID(s): ${listeners.join(', ')}. Inspecting owner...`);
  for (const pid of listeners) {
    const details = getProcessDetails(pid);
    if (details && isProjectProcess(details.cmdLine)) {
      log(`PID ${pid} belongs to an existing/orphaned instance of this project backend.`);
      log(`Command line: ${details.cmdLine}`);
      log(`Terminating orphaned project process tree (PID: ${pid})...`);
      killProcessTree(pid);
    } else {
      error(`Port ${PORT} is in use by an unrelated application (PID: ${pid}).`);
      if (details && details.cmdLine) {
        error(`Command line: ${details.cmdLine}`);
      }
      error(`Refusing to terminate unrelated application. Please free port ${PORT} manually.`);
      process.exit(1);
    }
  }

  const free = waitForPortToBeFree(PORT, 5000);
  if (free) {
    log(`Port ${PORT} successfully reclaimed.`);
  } else {
    error(`Failed to release port ${PORT} within timeout.`);
    process.exit(1);
  }
}

/**
 * Clean up any stale tsx watch processes from previous abandoned runs of this repository
 */
function cleanupStaleWatchers() {
  try {
    const currentPid = process.pid;
    const parentPid = process.ppid;
    const ps = `Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'node|tsx' } | Select-Object ProcessId, CommandLine | ConvertTo-Json`;
    const out = execSync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000
    }).trim();
    if (!out) return;

    const procs = JSON.parse(out);
    const list = Array.isArray(procs) ? procs : [procs];

    for (const p of list) {
      const pid = p.ProcessId;
      const cmd = p.CommandLine || '';
      if (pid === currentPid || pid === parentPid) continue;
      if (isProjectProcess(cmd) && (cmd.includes('tsx') || cmd.includes('src/server.ts') || cmd.includes('src\\server.ts'))) {
        log(`Found stale project watcher process (PID: ${pid}). Terminating...`);
        killProcessTree(pid);
      }
    }
  } catch (err) {
    // Non-critical, continue
  }
}

function main() {
  log(`Starting backend development manager...`);
  log(`Repository root: ${REPO_ROOT}`);

  // Step 1: Ensure port 5000 is free and no project orphans exist
  ensurePortFree();
  cleanupStaleWatchers();

  // Step 2: Validate entry files exist
  if (!fs.existsSync(SERVER_ENTRY)) {
    error(`Server entry point not found: ${SERVER_ENTRY}`);
    process.exit(1);
  }
  if (!fs.existsSync(TSX_CLI)) {
    error(`tsx CLI not found at ${TSX_CLI}. Run npm install first.`);
    process.exit(1);
  }

  // Step 3: Directly spawn tsx watch without cmd.exe shell wrapper
  log(`Spawning tsx watch with Node directly: ${SERVER_ENTRY}`);
  const child = spawn(process.execPath, [TSX_CLI, 'watch', SERVER_ENTRY], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, PORT: String(PORT) },
    windowsHide: false
  });

  log(`Backend process tree root started with PID: ${child.pid}`);

  let isTerminating = false;
  function handleTermination(signal) {
    if (isTerminating) return;
    isTerminating = true;
    log(`Received ${signal}. Terminating complete backend process tree (PID: ${child.pid})...`);
    killProcessTree(child.pid);
    waitForPortToBeFree(PORT, 3000);
    log(`Backend process tree terminated. Port ${PORT} released.`);
    process.exit(0);
  }

  // Clean shutdown handlers
  process.on('SIGINT', () => handleTermination('SIGINT'));
  process.on('SIGTERM', () => handleTermination('SIGTERM'));
  process.on('SIGHUP', () => handleTermination('SIGHUP'));
  process.on('SIGBREAK', () => handleTermination('SIGBREAK'));

  // On Windows, handle console SIGINT reliably via readline
  if (process.platform === 'win32' && process.stdin.isTTY) {
    try {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      rl.on('SIGINT', () => {
        handleTermination('SIGINT');
      });
    } catch {
      // Ignore if readline fails
    }
  }

  // Forward child exit or restart if unexpected
  child.on('exit', (code, signal) => {
    if (!isTerminating) {
      if (code !== 0 && code !== null) {
        warn(`Backend process exited with code: ${code}. Re-checking status...`);
      }
      // If port 5000 is still active and healthy, the server child was restarted by tsx worker
      const listeners = getPortListeners(PORT);
      if (listeners.length > 0) {
        log(`Backend listener active on port ${PORT} (PID: ${listeners.join(', ')}). Supervision continuing.`);
        return;
      }
      process.exit(code ?? (signal ? 1 : 0));
    }
  });

  child.on('error', (err) => {
    error(`Failed to spawn backend process: ${err.message}`);
    process.exit(1);
  });
}

main();

