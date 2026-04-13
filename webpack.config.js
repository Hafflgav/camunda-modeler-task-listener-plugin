const path = require('path');

module.exports = {
  mode: 'development',

  // Root-level client.js is the entry point (requires TaskListenerSyncPlugin.js)
  entry: './client.js',

  output: {
    path: path.resolve(__dirname, 'client'),
    filename: 'client.js'
  },

  module: {
    rules: []
  },

  resolve: {
    modules: [ 'node_modules', '.' ]
  },

  devtool: false
};
