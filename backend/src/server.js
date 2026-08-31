const app = require('./app');
const config = require('./config/env');

let server;

if (require.main === module) {
  server = app.listen(config.port, () => {
    console.log(`=========================================`);
    console.log(` Student Election System API running`);
    console.log(` Port:        ${config.port}`);
    console.log(` Environment: ${config.env}`);
    console.log(` Client URL:  ${config.clientUrl}`);
    console.log(` Health:      http://localhost:${config.port}/api/health`);
    console.log(`=========================================`);
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\nReceived ${signal}. Gracefully shutting down...`);
    if (server) {
      server.close(() => {
        console.log('HTTP server closed. Exiting process.');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
