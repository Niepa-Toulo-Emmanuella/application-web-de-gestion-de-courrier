// helpers/pdf.helpers.js
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const AWS = require('aws-sdk');
const s3 = new AWS.S3({ /* config B2 */ });

async function generateImputationPDFWithSignature({ bordereau_id, userId, signatureFile }) {
  // 1. reconstruire le HTML (comme generateImputationPDF)
  const templatePath = path.join(__dirname, '../templates/imputation_template.html');
  let html = fs.readFileSync(templatePath, 'utf-8');

  // récupérer données bordereau / imputations si besoin
  // ... SELECT FROM DB pour remplacer placeholders ...

  // 2. préparer data URL de la signature
  const signaturePath = path.join(__dirname, '../uploads/signatures', signatureFile);
  const raw = fs.readFileSync(signaturePath);
  const signatureDataUrl = `data:image/png;base64,${raw.toString('base64')}`;

  // ajouter un placeholder <img id="injected-signature" src="...">
  // soit remplacer un {{SIGNATURE}} existant par signatureDataUrl
  html = html.replace(/{{SIGNATURE}}/g, signatureDataUrl);

  // 3. lancer puppeteer
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const tempPath = `/tmp/imputation_signed_${Date.now()}.pdf`;
  await page.pdf({ path: tempPath, format: 'A4', printBackground: true });
  await browser.close();

  // 4. upload to B2
  const fileContent = fs.readFileSync(tempPath);
  const key = `imputations/${Date.now()}_imputation_signed.pdf`;
  await s3.upload({ Bucket: process.env.B2_BUCKET_NAME, Key: key, Body: fileContent, ContentType: 'application/pdf' }).promise();
  fs.unlinkSync(tempPath);

  // 5. return key (ou full URL)
  return key;
}

module.exports = { generateImputationPDFWithSignature };
