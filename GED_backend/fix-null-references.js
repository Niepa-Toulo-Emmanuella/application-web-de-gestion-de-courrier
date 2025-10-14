const pool = require('./src/config/database');

(async () => {
  try {
    const result = await pool.query(`
      UPDATE courriers
      SET reference = numero_enregistrement
      WHERE reference IS NULL OR reference = ''
      RETURNING id, reference, numero_enregistrement
    `);

    console.log(`✅ ${result.rowCount} courrier(s) mis à jour avec une référence.`);
    result.rows.forEach(row => {
      console.log(`- ID ${row.id} : référence = ${row.reference}`);
    });

    process.exit(0);
  } catch (err) {
    console.error("❌ Erreur lors de la mise à jour :", err);
    process.exit(1);
  }
})();
