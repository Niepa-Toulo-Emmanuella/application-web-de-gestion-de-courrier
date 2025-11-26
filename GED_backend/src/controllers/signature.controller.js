// controllers/signature.controller.js
const db = require('../models/db'); // pg pool
const { generateOtp, hashOtp } = require('../utils/otp');
const { sendOtpEmail } = require('../utils/mail');
const crypto = require('crypto');
const path = require('path');
const { generateImputationPDFWithSignature } = require('../helpers/pdf.helpers'); // on va créer

// /api/signatures/request-otp
exports.requestOtp = async (req, res) => {
  const userId = req.user.id;
  const { bordereau_id } = req.body;

  // 1. vérifier que user a bien une signature_file
  const userRes = await db.query('SELECT email, signature_file FROM users WHERE id = $1', [userId]);
  const user = userRes.rows[0];
  if (!user) return res.status(404).json({ success:false, message:'Utilisateur introuvable' });
  if (!user.signature_file) return res.status(400).json({ success:false, message:'Aucune signature configurée pour cet utilisateur' });

  // 2. générer OTP, stocker hash
  const otp = generateOtp(6);
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + 10*60*1000); // 10 min

  await db.query(
    `INSERT INTO signature_otps (user_id, bordereau_id, otp_hash, expires_at) VALUES ($1,$2,$3,$4)`,
    [userId, bordereau_id, otpHash, expiresAt]
  );

  // 3. envoyer email
  await sendOtpEmail(user.email, otp, { expiresMinutes: 10 });

  // 4. log audit
  await db.query(`INSERT INTO signature_events (user_id, bordereau_id, event_type, ip, user_agent) VALUES ($1,$2,$3,$4,$5)`,
    [userId, bordereau_id, 'otp_sent', req.ip, req.get('User-Agent')]);

  res.json({ success: true, message: 'OTP envoyé par email.' });
};

// /api/signatures/verify-otp
exports.verifyOtp = async (req, res) => {
  const userId = req.user.id;
  const { bordereau_id, otp } = req.body;

  if (!otp) return res.status(400).json({ success:false, message:'OTP requis' });

  // 1. récupérer le dernier otp non used pour cet user + bordereau
  const q = `SELECT * FROM signature_otps WHERE user_id = $1 AND bordereau_id = $2 ORDER BY created_at DESC LIMIT 1`;
  const r = await db.query(q, [userId, bordereau_id]);
  const row = r.rows[0];
  if (!row) return res.status(400).json({ success:false, message:'Aucun OTP trouvé. Demandez-en un nouveau.' });

  if (row.used) return res.status(400).json({ success:false, message:'OTP déjà utilisé' });
  if (new Date() > new Date(row.expires_at)) return res.status(400).json({ success:false, message:'OTP expiré' });
  if (row.attempts >= 5) return res.status(429).json({ success:false, message:'Trop de tentatives' });

  const otpHash = hashOtp(otp);
  if (otpHash !== row.otp_hash) {
    // incrémenter attempts
    await db.query('UPDATE signature_otps SET attempts = attempts + 1 WHERE id = $1', [row.id]);
    return res.status(400).json({ success:false, message:'OTP incorrect' });
  }

  // OTP valide : marquer used
  await db.query('UPDATE signature_otps SET used = true WHERE id = $1', [row.id]);

  // Audit: otp_verified
  await db.query(`INSERT INTO signature_events (user_id, bordereau_id, event_type, ip, user_agent) VALUES ($1,$2,$3,$4,$5)`,
    [userId, bordereau_id, 'otp_verified', req.ip, req.get('User-Agent')]);

  // Récupérer le fichier de signature de l'utilisateur
  const userRes = await db.query('SELECT signature_file FROM users WHERE id = $1', [userId]);
  const signatureFile = userRes.rows[0]?.signature_file;
  if (!signatureFile) return res.status(400).json({ success:false, message:'Aucun fichier de signature configuré' });

  // Générer le PDF signé : tu dois implémenter generateImputationPDFWithSignature
  const imputationPdfKey = await generateImputationPDFWithSignature({
    bordereau_id,
    userId,
    signatureFile
  });

  // Mettre à jour la table imputations (si tu veux stocker la key)
  await db.query('UPDATE imputations SET fichier_imputation = $1 WHERE bordereau_id = $2', [imputationPdfKey, bordereau_id]);

  // Audit: signed
  await db.query(`INSERT INTO signature_events (user_id, bordereau_id, event_type, details) VALUES ($1,$2,$3,$4)`,
    [userId, bordereau_id, 'signed', JSON.stringify({ fichier_imputation: imputationPdfKey })]);

  res.json({ success: true, message: 'Bordereau signé', fichier_imputation: imputationPdfKey });
};
