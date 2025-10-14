// const multer = require('multer');
// const storage = multer.memoryStorage();
// const upload = multer({ storage });

// module.exports = upload;

// <!DOCTYPE html>
// <html lang="fr">

// <head>
//     <meta charset="UTF-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <title>Transmission de Bordereau</title>
//     <style>
//         body {
//             font-family: Arial, sans-serif;
//             margin: 20px;
//             background: #f9f9f9;
//         }

//         .container {
//             max-width: 900px;
//             margin: auto;
//             background: #fff;
//             padding: 20px;
//             border-radius: 10px;
//             box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
//         }

//         h1,
//         h2 {
//             text-align: center;
//         }

//         .row {
//             margin-bottom: 10px;
//         }

//         .row label {
//             display: inline-block;
//             width: 180px;
//             font-weight: bold;
//         }

//         select,
//         button {
//             padding: 5px;
//             width: 250px;
//         }

//         button {
//             cursor: pointer;
//             margin-top: 10px;
//         }

//         #messageNotif {
//             margin-top: 15px;
//             font-weight: bold;
//             text-align: center;
//         }

//         #messageNotif.success {
//             color: green;
//         }

//         #messageNotif.error {
//             color: red;
//         }

//         table {
//             width: 100%;
//             border-collapse: collapse;
//             margin-top: 20px;
//         }

//         table,
//         th,
//         td {
//             border: 1px solid #ccc;
//         }

//         th,
//         td {
//             padding: 8px;
//             text-align: left;
//         }

//         th {
//             background-color: #f0f0f0;
//         }
//     </style>
// </head>

// <body>
//     <div class="container">
//         <h1>TRANSMISSION DE BORDEREAU</h1>

//         <form id="form-transmission">
//             <div class="row">
//                 <label for="bordereau_id">Sélectionner un bordereau :</label>
//                 <select id="bordereau_id" name="bordereau_id" required>
//                     <option value="">-- Choisir --</option>
//                 </select>
//             </div>

//             <div class="row">
//                 <label for="destinataire_id">Sélectionner le destinataire :</label>
//                 <select id="destinataire_id" name="destinataire_id" required>
//                     <option value="">-- Choisir --</option>
//                 </select>
//             </div>

//             <button type="submit">📤 Transmettre</button>
//             <div id="messageNotif"></div>
//         </form>

//         <h2>Bordereaux en attente</h2>
//         <table id="bordereaux-en-attente">
//             <thead>
//                 <tr>
//                     <th>Numéro</th>
//                     <th>Objet</th>
//                     <th>Date arrivée</th>
//                 </tr>
//             </thead>
//             <tbody></tbody>
//         </table>
//     </div>

//     <script>
//         const API_BASE = "http://localhost:3000/api";
//         const form = document.getElementById("form-transmission");
//         const bordereauSelect = document.getElementById("bordereau_id");
//         const destinataireSelect = document.getElementById("destinataire_id");
//         const notif = document.getElementById("messageNotif");

//         // Décode le JWT pour récupérer l'utilisateur connecté
//         function parseJwt(token) {
//             try {
//                 if (!token) return {};
//                 const base64Url = token.split('.')[1];
//                 const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
//                 return JSON.parse(window.atob(base64));
//             } catch (e) {
//                 return {};
//             }
//         }

//         // Afficher message
//         function showNotif(msg, type = "error") {
//             notif.textContent = msg;
//             notif.className = type;
//         }

//         // Charger les bordereaux en attente
//         async function loadBordereaux() {
//             const token = localStorage.getItem("jwt") || localStorage.getItem("token");
//             if (!token) return showNotif("⚠️ Vous devez vous connecter", "error");

//             try {
//                 const res = await fetch(`${API_BASE}/bordereaux`, {
//                     headers: { Authorization: "Bearer " + token }
//                 });
//                 if (!res.ok) throw new Error("Erreur HTTP " + res.status);
//                 const result = await res.json();
//                 const tbody = document.querySelector("#bordereaux-en-attente tbody");
//                 tbody.innerHTML = "";
//                 bordereauSelect.innerHTML = '<option value="">-- Choisir --</option>';
//                 if (result.success) {
//                     const enAttente = result.data.filter(b => b.statut === "en_attente");
//                     enAttente.forEach(b => {
//                         const tr = document.createElement("tr");
//                         tr.innerHTML = `<td>${b.numero}</td><td>${b.objet}</td><td>${b.date_arrivee.split("T")[0]}</td>`;
//                         tbody.appendChild(tr);
//                         const option = document.createElement("option");
//                         option.value = b.id;
//                         option.textContent = `${b.numero} - ${b.objet}`;
//                         bordereauSelect.appendChild(option);
//                     });
//                 }
//             } catch (err) {
//                 console.error("Erreur chargement bordereaux:", err);
//                 showNotif("❌ Impossible de charger les bordereaux", "error");
//             }
//         }

//         // Charger les destinataires
//         async function loadDestinataires() {
//             const token = localStorage.getItem("jwt") || localStorage.getItem("token");
//             if (!token) return showNotif("⚠️ Vous devez vous connecter", "error");

//             const currentUser = parseJwt(token);
//             // Vérifie plusieurs noms possibles pour l'ID
//             const currentUserId = currentUser.id || currentUser.userId || currentUser.sub;
//             if (!currentUserId) return showNotif("⚠️ Impossible de récupérer votre ID, reconnectez-vous", "error");

//             try {
//                 const res = await fetch(`${API_BASE}/users`, {
//                     headers: { Authorization: "Bearer " + token }
//                 });
//                 if (!res.ok) throw new Error("Erreur HTTP " + res.status);
//                 const result = await res.json();
//                 destinataireSelect.innerHTML = '<option value="">-- Choisir --</option>';
//                 if (result.success) {
//                     const users = result.data.filter(u => u.id !== currentUserId);
//                     users.forEach(u => {
//                         const option = document.createElement("option");
//                         option.value = u.id;
//                         option.textContent = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
//                         destinataireSelect.appendChild(option);
//                     });
//                 }
//             } catch (err) {
//                 console.error("Erreur chargement destinataires:", err);
//                 showNotif("❌ Impossible de charger les destinataires", "error");
//             }
//         }

//         // Gestion du formulaire
//         form.addEventListener("submit", async (e) => {
//             e.preventDefault();

//             const bordereauId = bordereauSelect.value;
//             const destinataireId = destinataireSelect.value;

//             const token = localStorage.getItem("jwt") || localStorage.getItem("token");
//             if (!token) return showNotif("⚠️ Vous devez vous connecter", "error");

//             const currentUser = parseJwt(token);
//             const currentUserId = currentUser.id || currentUser.userId || currentUser.sub;
//             if (!currentUserId) return showNotif("⚠️ Impossible de récupérer votre ID, reconnectez-vous", "error");

//             if (!bordereauId || !destinataireId) {
//                 showNotif("⚠️ Tous les champs sont obligatoires", "error");
//                 return;
//             }

//             try {
//                 console.log("📤 Données envoyées :", {
//                     bordereau_id: bordereauId,
//                     destinataire_id: destinataireId,
//                     expediteur_id: currentUserId,
//                     courrier_id: bordereauId
//                 });

//                 const res = await fetch(`${API_BASE}/bordereaux/transmettreBordereau`, {
//                     method: "POST",
//                     headers: {
//                         "Authorization": "Bearer " + token,
//                         "Content-Type": "application/json"
//                     },
//                     body: JSON.stringify({
//                         bordereau_id: bordereauId,
//                         destinataire_id: destinataireId,
//                         expediteur_id: currentUserId,
//                         courrier_id: bordereauId
//                     })
//                 });

//                 const result = await res.json();
//                 if (res.ok && (result.success || result.message)) {
//                     showNotif(result.message || "✅ Transmission réussie", "success");
//                     loadBordereaux();
//                 } else {
//                     showNotif(result.message || "❌ Erreur lors de la transmission", "error");
//                 }
//             } catch (err) {
//                 console.error("Erreur transmission:", err);
//                 showNotif("❌ Erreur serveur", "error");
//             }
//         });

//         // Charger au démarrage
//         window.addEventListener("DOMContentLoaded", () => {
//             loadBordereaux();
//             loadDestinataires();
//         });
//     </script>
// </body>

// </html>
