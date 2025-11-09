const puppeteer = require('puppeteer');

(async () => {
  console.log('Chemin Chromium détecté :', puppeteer.executablePath());
})();
