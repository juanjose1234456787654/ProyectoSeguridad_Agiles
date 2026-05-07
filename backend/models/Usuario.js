const db = require('../config/db');

const Usuario = {
  findByEmail: async (email) => {
    const [rows] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    return rows[0];
  }
};

module.exports = Usuario;