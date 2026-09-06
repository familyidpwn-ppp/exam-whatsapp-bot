module.exports = {
  apps: [
    {
      name: 'exam-whatsapp-bot',
      script: 'index.js',
      cwd: __dirname,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
