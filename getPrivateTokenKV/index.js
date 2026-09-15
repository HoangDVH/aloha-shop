const auth = require('./auth');
const generateQr = require('./generateQr');
const config = require('./config');

module.exports = {
  ...auth,
  ...generateQr,
  config
};
