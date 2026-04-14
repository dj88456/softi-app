module.exports = {
  apps: [{
    name: 'bts-softi',
    script: 'server.js',
    cwd: './backend',
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
  }],
};
