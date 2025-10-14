const bcrypt = require("bcrypt");

const hashPassword = async () => {
  const plainPassword = "12345678";
  const hash = await bcrypt.hash(plainPassword, 10);
  console.log("Mot de passe hashé :", hash);
};

hashPassword();
