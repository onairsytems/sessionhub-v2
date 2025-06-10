/**
 * Sandbox Worker
 * 
 * Executes code in an isolated worker thread with restrictions
 */

const { parentPort, workerData } = require('worker_threads');
const vm = require('vm');

async function executeInSandbox() {
  try {
    const { code, context, config } = workerData;
    
    // Create sandbox with limited globals
    const sandbox = {
      console: {
// REMOVED: console statement
// REMOVED: console statement
// REMOVED: console statement
// REMOVED: console statement
      },
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
      Promise,
      Date,
      Math,
      JSON,
      Buffer,
      context
    };

    // Add allowed features based on config
    if (config.allowedHosts && config.allowedHosts.length > 0) {
      sandbox.fetch = createRestrictedFetch(config.allowedHosts);
    }

    // Create VM context
    const vmContext = vm.createContext(sandbox);
    
    // Set resource limits
    const options = {
      timeout: config.timeout || 30000,
      breakOnSigint: true
    };

    // Execute code
    const script = new vm.Script(`
      (async function() {
        ${code}
      })()
    `);
    
    const result = await script.runInContext(vmContext, options);
    
    // Send result back to main thread
    parentPort.postMessage({ data: result });
  } catch (error) {
    parentPort.postMessage({ error: error.message });
  }
}

function createRestrictedFetch(allowedHosts) {
  return async (url, options) => {
    try {
      const parsedUrl = new URL(url);
      
      // Check if host is allowed
      const isAllowed = allowedHosts.some(host => 
        parsedUrl.hostname === host || parsedUrl.hostname.endsWith(`.${host}`)
      );
      
      if (!isAllowed) {
        throw new Error(`Host ${parsedUrl.hostname} is not allowed`);
      }
      
      // Import fetch dynamically
      const fetch = (await import('node-fetch')).default;
      return fetch(url, options);
    } catch (error) {
      throw new Error(`Fetch error: ${error.message}`);
    }
  };
}

// Execute
executeInSandbox().catch(error => {
  parentPort.postMessage({ error: error.message });
  process.exit(1);
});