const path = require('path');
require('ts-node').register({
  project: path.resolve(__dirname, 'ts/tsconfig.json'),
  transpileOnly: true
});
