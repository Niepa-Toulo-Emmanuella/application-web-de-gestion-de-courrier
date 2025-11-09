require('dotenv').config();
const fetch = require('node-fetch'); // ✅ obligatoire avec Node <18

(async () => {
  try {
    const email = "TON_EMAIL_DE_TEST"; // remplace par un email existant dans ta DB

    const response = await fetch("https://application-web-de-gestion-de-courrier.onrender.com/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const data = await response.json();
    console.log("✅ Réponse API :", data);

  } catch (err) {
    console.error("❌ Erreur réseau :", err);
  }
})();
