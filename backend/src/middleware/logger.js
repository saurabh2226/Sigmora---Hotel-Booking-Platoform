const morgan = require('morgan');

const logger = process.env.NODE_ENV === 'production'
  ? morgan('combined')
  : morgan('dev');

module.exports = logger;
