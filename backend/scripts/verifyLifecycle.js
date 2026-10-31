/**
 * Process Lifecycle Verification Script
 * Validates startup, port binding, child process tree termination, and re-startup without EADDRINUSE.
 */
const { spawn, execSync } = require('child_process');
const http = require('http');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

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

function getProcessDetails(pid) {
  try {
    const ps = `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`;
    const cmdLine = execSync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000
    }).trim();
    return cmdLine;
  } catch {
    return '';
  }
}

function checkHealth() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:5000/api/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function runTest() {
  console.log('=== STEP 1: INITIAL PORT 5000 STATUS ===');
  const initialListeners = getPortListeners(5000);
  console.log(`Initial listeners on port 5000: [${initialListeners.join(', ')}]`);

  console.log('\n=== STEP 2: STARTING BACKEND (RUN 1) ===');
  // Start backend using npm --prefix backend run dev
  const devProcess = spawn('npm', ['--prefix', 'backend', 'run', 'dev'], {
    shell: true,
    stdio: 'pipe'
  });

  devProcess.stdout.on('data', d => process.stdout.write(`[Run1 stdout] ${d.toString()}`));
  devProcess.stderr.on('data', d => process.stderr.write(`[Run1 stderr] ${d.toString()}`));

  console.log(`Spawned npm run dev with PID: ${devProcess.pid}. Waiting for port 5000 to listen...`);

  let listening = false;
  let activePid = null;
  for (let i = 0; i < 30; i++) {
    await delay(1000);
    const listeners = getPortListeners(5000);
    if (listeners.length > 0) {
      listening = true;
      activePid = listeners[0];
      console.log(`Port 5000 is now active! Listeners: [${listeners.join(', ')}]`);
      break;
    }
  }

  if (!listening) {
    console.error('FAILED: Backend did not start listening on port 5000 within 30 seconds.');
    execSync(`taskkill /F /T /PID ${devProcess.pid}`, { stdio: 'ignore' });
    process.exit(1);
  }

  console.log('\n=== STEP 3: VERIFY EXACTLY ONE LISTENER ON PORT 5000 ===');
  const listeners = getPortListeners(5000);
  console.log(`Active listeners count: ${listeners.length}`);
  if (listeners.length !== 1) {
    console.error(`FAILED: Expected exactly 1 listener, found ${listeners.length}`);
    process.exit(1);
  }
  const cmdLine = getProcessDetails(listeners[0]);
  console.log(`Owning PID: ${listeners[0]}, CommandLine: ${cmdLine}`);

  console.log('\n=== STEP 4: VERIFY /api/health ENDPOINT ===');
  try {
    const health = await checkHealth();
    console.log('Health check response:', JSON.stringify(health, null, 2));
    if (health.statusCode !== 200 || health.body?.status !== 'healthy') {
      console.error('FAILED: Health check returned unexpected response');
      process.exit(1);
    }
    console.log('Health check PASSED!');
  } catch (err) {
    console.error('FAILED: Health check request failed:', err.message);
    process.exit(1);
  }

  console.log('\n=== STEP 5: SIMULATE CTRL+C / PROCESS TERMINATION ===');
  console.log(`Terminating devProcess tree (PID: ${devProcess.pid})...`);
  execSync(`taskkill /F /T /PID ${devProcess.pid}`, { stdio: 'ignore' });

  console.log('Waiting for port 5000 to be freed...');
  let portFreed = false;
  for (let i = 0; i < 15; i++) {
    await delay(500);
    const postListeners = getPortListeners(5000);
    if (postListeners.length === 0) {
      portFreed = true;
      break;
    }
  }

  if (!portFreed) {
    console.error('FAILED: Port 5000 was NOT released after termination!');
    process.exit(1);
  }
  console.log('Port 5000 is confirmed FREE!');

  // Check if listener process is dead
  try {
    const checkPidCmd = `Get-Process -Id ${activePid} -ErrorAction Stop`;
    execSync(`powershell -NoProfile -NonInteractive -Command "${checkPidCmd}"`, { stdio: 'ignore' });
    console.error(`FAILED: Worker process ${activePid} is still alive!`);
    process.exit(1);
  } catch {
    console.log(`Worker process ${activePid} is confirmed DEAD.`);
  }

  console.log('\n=== STEP 6: STARTING BACKEND (RUN 2) TO VERIFY NO EADDRINUSE ===');
  const devProcess2 = spawn('npm', ['--prefix', 'backend', 'run', 'dev'], {
    shell: true,
    stdio: 'pipe'
  });

  let run2Output = '';
  devProcess2.stdout.on('data', d => {
    const s = d.toString();
    run2Output += s;
    process.stdout.write(`[Run2 stdout] ${s}`);
  });
  devProcess2.stderr.on('data', d => {
    const s = d.toString();
    run2Output += s;
    process.stderr.write(`[Run2 stderr] ${s}`);
  });

  console.log(`Spawned second npm run dev with PID: ${devProcess2.pid}. Waiting for port 5000 to listen...`);

  let listening2 = false;
  let activePid2 = null;
  for (let i = 0; i < 30; i++) {
    await delay(1000);
    const listeners2 = getPortListeners(5000);
    if (listeners2.length > 0) {
      listening2 = true;
      activePid2 = listeners2[0];
      console.log(`Run 2: Port 5000 is active! Listeners: [${listeners2.join(', ')}]`);
      break;
    }
    if (run2Output.includes('EADDRINUSE')) {
      console.error('FAILED: Run 2 hit EADDRINUSE!');
      break;
    }
  }

  if (!listening2) {
    console.error('FAILED: Second startup did not start listening on port 5000.');
    execSync(`taskkill /F /T /PID ${devProcess2.pid}`, { stdio: 'ignore' });
    process.exit(1);
  }

  const health2 = await checkHealth();
  console.log('Run 2 Health check response:', JSON.stringify(health2, null, 2));

  console.log('\n=== STEP 7: CLEANUP RUN 2 ===');
  execSync(`taskkill /F /T /PID ${devProcess2.pid}`, { stdio: 'ignore' });
  await delay(1500);
  const finalListeners = getPortListeners(5000);
  console.log('Port 5000 post-cleanup listeners:', finalListeners);

  console.log('\n========================================');
  console.log('ALL LIFECYCLE TESTS COMPLETED SUCCESSFULLY!');
  console.log('========================================');
}

runTest().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
