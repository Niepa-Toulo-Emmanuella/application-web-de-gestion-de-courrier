CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -- UPDATE users
-- -- SET password = '$2b$10$JJz/rXyyAq6HkMrTWOWIn.1nWqE2ayplyCIrO.Trw2kWsYSogW2FO'
-- -- WHERE email = 'niepemmanuella29@gmail.com';


-- -- INSERT INTO users (name, email, password, role)
-- -- VALUES ('Emma', 'niepemmanuella29@gmail.com', '12345678', 'admin');



-- -- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";



-- CREATE TABLE expediteur (
--   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   nom VARCHAR(255) NOT NULL
-- );
-- INSERT INTO expediteurs (nom) VALUES ('Ministère de la Santé');
-- INSERT INTO expediteurs (nom) VALUES ('Direction Générale');

-- DROP TABLE expediteur;


-- CREATE TABLE IF NOT EXISTS courriers (
--     id SERIAL PRIMARY KEY,
--     numero_reference VARCHAR(100) NOT NULL,
--     objet TEXT NOT NULL,
--     expediteur_id UUID NOT NULL,             -- Clé étrangère vers users
--     date_courrier DATE NOT NULL,
--     date_arrivee DATE NOT NULL,
--     numero_enregistrement VARCHAR(100) NOT NULL,
--     heure TIME NOT NULL,
--     archive BOOLEAN DEFAULT FALSE,
--     created_by UUID NOT NULL,                -- L'utilisateur qui crée le courrier
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

--     CONSTRAINT courrier_unique UNIQUE (numero_reference, date_courrier),
--     CONSTRAINT fk_expediteur FOREIGN KEY (expediteur_id) REFERENCES users(id),
--     CONSTRAINT fk_createur FOREIGN KEY (created_by) REFERENCES users(id)
-- );

-- -- ALTER TABLE courriers DROP COLUMN expediteur_id;
-- -- ALTER TABLE courriers ADD COLUMN expediteur VARCHAR(255);


-- CREATE TABLE IF NOT EXISTS registre_transcription (
--     id SERIAL PRIMARY KEY,
--     courrier_id INT NOT NULL,
--     numero_reference VARCHAR(100),
--     date_courrier DATE,
--     date_arrivee DATE,
--     numero_enregistrement VARCHAR(100),
--     heure TIME,
--     objet TEXT,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

--     CONSTRAINT fk_courrier FOREIGN KEY (courrier_id) REFERENCES courriers(id) ON DELETE CASCADE
-- );

-- -- -- SELECT * FROM courriers;

-- -- CREATE TABLE pieces_jointes (
-- --   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
-- --   courrier_id UUID REFERENCES courriers(id) ON DELETE CASCADE,
-- --   nom_fichier TEXT NOT NULL,
-- --   url TEXT NOT NULL,
-- --   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- -- );
-- -- SELECT * FROM pieces_jointes;

-- ALTER TABLE registre_transcription DROP CONSTRAINT fk_courrier;
-- ALTER TABLE courriers DROP CONSTRAINT courriers_pkey;
-- ALTER TABLE courriers DROP COLUMN id;

-- ALTER TABLE courriers ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
-- ALTER TABLE registre_transcription ALTER COLUMN courrier_id TYPE UUID USING courrier_id::uuid;
-- ALTER TABLE registre_transcription
-- ADD CONSTRAINT fk_courrier FOREIGN KEY (courrier_id) REFERENCES courriers(id) ON DELETE CASCADE;



-- SELECT conname
-- FROM pg_constraint
-- WHERE conrelid = 'registre_transcription'::regclass;

-- -- 1. Supprimer la clé primaire actuelle de la table courriers
-- ALTER TABLE courriers DROP CONSTRAINT courriers_pkey;

-- -- 2. Supprimer l’ancienne colonne id (de type SERIAL / INTEGER)
-- ALTER TABLE courriers DROP COLUMN id;

-- -- 3. Ajouter une nouvelle colonne id de type UUID avec une valeur par défaut
-- ALTER TABLE courriers ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();

-- -- 4. Modifier le type de la colonne courrier_id dans registre_transcription en UUID
-- ALTER TABLE registre_transcription 
-- ALTER COLUMN courrier_id TYPE UUID USING courrier_id::uuid;

-- -- 5. Ajouter une nouvelle contrainte de clé étrangère correctement
-- ALTER TABLE registre_transcription
-- ADD CONSTRAINT fk_courrier FOREIGN KEY (courrier_id) REFERENCES courriers(id) ON DELETE CASCADE;

-- DROP TABLE registre_transcription;

-- -- Puis recrée la table avec courrier_id en UUID :
-- CREATE TABLE registre_transcription (
--     id SERIAL PRIMARY KEY,
--     courrier_id UUID NOT NULL,
--     numero_reference VARCHAR(100),
--     date_courrier DATE,
--     date_arrivee DATE,
--     numero_enregistrement VARCHAR(100),
--     heure TIME,
--     objet TEXT,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

--     CONSTRAINT fk_courrier FOREIGN KEY (courrier_id) REFERENCES courriers(id) ON DELETE CASCADE
-- );
-- Vérifie d'abord si la contrainte existe
-- ALTER TABLE registre_transcription DROP CONSTRAINT IF EXISTS fk_courrier;

CREATE TABLE IF NOT EXISTS registre_transcription (
    id SERIAL PRIMARY KEY,
    courrier_id UUID NOT NULL,
    numero_reference VARCHAR(100),
    date_courrier DATE,
    date_arrivee DATE,
    numero_enregistrement VARCHAR(100),
    heure TIME,
    objet TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_courrier FOREIGN KEY (courrier_id) REFERENCES courriers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pieces_jointes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courrier_id UUID REFERENCES courriers(id) ON DELETE CASCADE,
  nom_fichier TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


SELECT * FROM courriers;



