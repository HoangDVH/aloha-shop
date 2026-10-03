const auth = require('./auth');
const generateQr = require('./generateQr');
const campaign = require('./campaign');
const config = require('./config');

module.exports = {
  ...auth,
  ...generateQr,
  ...campaign,
  config
};

