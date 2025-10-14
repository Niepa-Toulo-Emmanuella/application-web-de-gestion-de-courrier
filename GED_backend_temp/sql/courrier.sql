-- Création de la table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL DEFAULT 'agent',
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour optimiser les recherches par email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Supprimer l'ancien trigger s'il existe, puis le recréer
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Ajouter une colonne remember_token si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'remember_token'
    ) THEN
        ALTER TABLE users ADD COLUMN remember_token VARCHAR(255);
    END IF;
END;
$$;

-- Insertion d'un utilisateur admin par défaut (mot de passe chiffré : 'admin123')
INSERT INTO users (email, password, role, first_name, last_name) 
VALUES (
    'niepemmanuella29@gmail.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'admin',
    'Admin',
    'Système'
) ON CONFLICT (email) DO NOTHING;

-- Mise à jour de son rôle au cas où
UPDATE users SET role = 'admin' WHERE email = 'niepemmanuella29@gmail.com';

-- Supprimer un utilisateur incorrect
-- DELETE FROM users WHERE email = 'niepaemmanuella@gmail.com';

-- Affichage
SELECT * FROM users;
SELECT id, email, password FROM users WHERE email = 'niepaemmanuella@gmail.com';



-- ===================== COURRIERS =========================
-- Création de la table courriers
CREATE TABLE IF NOT EXISTS courriers (
  id              SERIAL PRIMARY KEY,
  reference       VARCHAR(100) UNIQUE NOT NULL,
  objet           TEXT NOT NULL,
  expediteur      VARCHAR(255),
  destinataire    VARCHAR(255),
  date_reception  DATE NOT NULL,
  fichier_scan    VARCHAR(255),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fonction pour MAJ updated_at
CREATE OR REPLACE FUNCTION trg_courriers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Supprimer le trigger s’il existe AVANT de le recréer
DROP TRIGGER IF EXISTS tgr_courriers_updated ON courriers;

CREATE TRIGGER tgr_courriers_updated
BEFORE UPDATE ON courriers
FOR EACH ROW
EXECUTE FUNCTION trg_courriers_updated_at();

-- Colonnes supplémentaires
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'courriers' AND column_name = 'date_arrivee'
  ) THEN
    ALTER TABLE courriers ADD COLUMN date_arrivee DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'courriers' AND column_name = 'numero_enregistrement'
  ) THEN
    ALTER TABLE courriers ADD COLUMN numero_enregistrement VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'courriers' AND column_name = 'heure'
  ) THEN
    ALTER TABLE courriers ADD COLUMN heure TIME;
  END IF;
END;
$$;



-- ===================== BORDEREAUX =========================
-- Création de la table bordereaux
CREATE TABLE IF NOT EXISTS bordereaux (
  id SERIAL PRIMARY KEY,
  courrier_id INTEGER REFERENCES courriers(id),
  expediteur TEXT,
  numero_reference TEXT,
  date_courrier DATE,
  date_arrivee DATE,
  numero_enregistrement TEXT,
  heure TIME,
  objet TEXT,
  premiere_transmission TEXT[],
  imputation TEXT[],
  instructions TEXT[],
  date_depart DATE,
  duree_traitement TEXT,
  date_retour DATE,
  observations TEXT,
  statut TEXT DEFAULT 'en attente',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ajouter la colonne 'numero' si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bordereaux' AND column_name = 'numero'
  ) THEN
    ALTER TABLE bordereaux ADD COLUMN numero VARCHAR(50) UNIQUE;
  END IF;
END;
$$;





CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  message TEXT NOT NULL,
  bordereau_id INTEGER REFERENCES bordereaux(id),
  lu BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS envois (
  id SERIAL PRIMARY KEY,
  courrier_id INTEGER REFERENCES courriers(id) ON DELETE CASCADE,
  bordereau_id INTEGER REFERENCES bordereaux(id) ON DELETE SET NULL,
  expediteur_id INTEGER, -- l'agent qui envoie
  destinataire_id INTEGER, -- ex: id de la hiérarchie
  statut VARCHAR(50) DEFAULT 'envoyé',
  date_envoi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- SELECT id, numero, numero_reference, objet 
-- FROM bordereaux 
-- WHERE id IN (SELECT DISTINCT bordereau_id FROM envois);

-- SELECT * FROM bordereaux;

-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'envois';

-- ALTER TABLE users
-- ADD COLUMN last_login TIMESTAMP;

-- SELECT * FROM users;

SELECT column_name
FROM information_schema.columns
WHERE table_name = 'bordereaux'; -- remplace 'users' par le nom de ta table

-- ALTER TABLE users
-- ADD CONSTRAINT check_role
-- CHECK (role IN (
--   'admin', 'agent', 'directeur_cabinet', 'directeur_cabinet_adjoint', 
--   'igsjp', 'chef_cabinet', 'conseiller_technique',
--   'chef_secretariat_particulier', 'charge_detude', 'les_directeurs'
-- ));


-- SELECT DISTINCT role FROM users;
-- SELECT id, email, role FROM users;

-- Ajouter une colonne si elle n'existe pas encore
-- ALTER TABLE bordereaux ADD COLUMN IF NOT EXISTS numero_reference VARCHAR(255);
-- ALTER TABLE bordereaux ADD COLUMN IF NOT EXISTS date_courrier DATE;
-- ALTER TABLE bordereaux ADD COLUMN IF NOT EXISTS observations TEXT;
-- ALTER TABLE bordereaux ADD COLUMN IF NOT EXISTS statut VARCHAR(50) DEFAULT 'en_attente';
-- ALTER TABLE bordereaux ADD COLUMN IF NOT EXISTS numero VARCHAR(100) UNIQUE;

-- -- Renommer une colonne si nécessaire
-- ALTER TABLE bordereaux RENAME COLUMN reference TO numero_reference;

-- -- Supprimer une colonne obsolète
-- ALTER TABLE bordereaux DROP COLUMN IF EXISTS imputation;
-- ALTER TABLE bordereaux DROP COLUMN IF EXISTS instructions;
-- ALTER TABLE bordereaux DROP COLUMN IF EXISTS date_depart;
-- ALTER TABLE bordereaux DROP COLUMN IF EXISTS duree_traitement;
-- ALTER TABLE bordereaux DROP COLUMN IF EXISTS date_retour;
-- ALTER TABLE bordereaux DROP COLUMN IF EXISTS premiere_transmission;

-- ALTER TABLE bordereaux
-- ADD COLUMN destinataire_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE;

-- ALTER TABLE bordereaux
-- ADD COLUMN expediteur_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE;

-- ALTER TABLE bordereaux
-- DROP COLUMN expediteur;

-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'bordereaux';

-- ALTER TABLE bordereaux
-- ALTER COLUMN destinataire_id DROP NOT NULL;



-- SELECT id, email, role FROM users;

-- SELECT DISTINCT role 
-- FROM users;

-- ALTER TABLE users DROP CONSTRAINT check_role;

-- ALTER TABLE users 
-- ADD CONSTRAINT check_role 
-- CHECK (role IN (
--   'admin',
--   'agent',
--   'directeur de cabinet',
--   'directeur de cabinet adjoint',
--   'IGSJP',
--   'chef de cabinet',
--   'conseiller technique',
--   'chef de secretariat particulier',
--   'chargé d''etude',
--   'les directeurs'
-- ));

-- SELECT pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname = 'check_role';

-- SELECT unnest(
--     regexp_matches(
--         pg_get_constraintdef(oid),
--         '''([^'']+)''',
--         'g'
--     )
-- ) AS role
-- FROM pg_constraint
-- WHERE conname = 'check_role';




-- Ajout de la colonne pour stocker le fichier du bordereau
-- ALTER TABLE bordereaux
-- ADD COLUMN fichier_bordereau VARCHAR(255);

-- -- Ajout de la colonne pour stocker le fichier scanné du courrier
-- ALTER TABLE courriers
-- ADD COLUMN fichier_scan VARCHAR(255);

-- DROP TABLE IF EXISTS bordereaux_imputation CASCADE;



-- CREATE TABLE IF NOT EXISTS imputations (
--     id SERIAL PRIMARY KEY,
--     bordereau_id INT NOT NULL,
--     premiere_transmission TEXT[],
--     imputations TEXT[],
--     instructions TEXT[],
--     date_depart DATE,
--     duree_traitement VARCHAR(100),
--     date_retour DATE,
--     traitement_actions TEXT[],
--     observations TEXT,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );


-- Nouvelle table pour les transmissions
-- CREATE TABLE IF NOT EXISTS transmissions_imputation (
--     id SERIAL PRIMARY KEY,
--     imputation_id INT NOT NULL REFERENCES imputations(id) ON DELETE CASCADE,
--     destinataire_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     expediteur_id INT REFERENCES users(id),
--     instructions TEXT,
--     duree_traitement VARCHAR(100),
--     observations TEXT,
--     date_depart TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     statut VARCHAR(50) DEFAULT 'en_attente'
-- );

-- -- Ajouter destinataire_id
-- ALTER TABLE imputations
-- ADD COLUMN IF NOT EXISTS destinataire_id INT;

-- -- Ajouter expediteur_id
-- ALTER TABLE imputations
-- ADD COLUMN IF NOT EXISTS expediteur_id INT;

-- -- Ajouter courrier_id pour le lien vers le courrier
-- ALTER TABLE imputations
-- ADD COLUMN IF NOT EXISTS courrier_id INT;

-- -- Ajouter les clés étrangères (optionnel mais recommandé)
-- ALTER TABLE imputations
-- ADD CONSTRAINT fk_destinataire
-- FOREIGN KEY (destinataire_id) REFERENCES users(id);

-- ALTER TABLE imputations
-- ADD CONSTRAINT fk_expediteur
-- FOREIGN KEY (expediteur_id) REFERENCES users(id);

-- ALTER TABLE imputations
-- ADD CONSTRAINT fk_courrier
-- FOREIGN KEY (courrier_id) REFERENCES courriers(id);

-- Ajouter une colonne pour stocker le fichier du bordereau
-- ALTER TABLE imputations
-- ADD COLUMN IF NOT EXISTS file TEXT;

-- DELETE FROM courriers WHERE id = 18;


-- SELECT * FROM bordereaux;
-- SELECT id, fichier_scan FROM courrier;

-- Ajout de la colonne pour stocker le fichier du bordereau imputation
-- ALTER TABLE imputations
-- ADD COLUMN fichier_imputation VARCHAR(255);

-- SELECT * FROM transmissions_imputation;
-- SELECT * FROM courriers;
SELECT * FROM imputations;
-- SELECT * FROM bordereaux;





 