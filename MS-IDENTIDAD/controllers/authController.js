const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');

const isBcryptHash = (value) => typeof value === 'string' && /^\$2[aby]\$/.test(value);

const verifyPassword = async (plainPassword, storedPassword) => {
  if (!storedPassword) return false;
  if (isBcryptHash(storedPassword)) {
    return bcrypt.compare(plainPassword, storedPassword);
  }
  return plainPassword === storedPassword;
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Faltan email o contraseña' });
    }

    let usuario = await Usuario.findByEmailInIdentity(email);

    if (!usuario) {
      const usuarioUta = await Usuario.findByEmailInUta(email);
      if (!usuarioUta) {
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }

      const passwordValidaUta = await verifyPassword(password, usuarioUta.password);
      if (!passwordValidaUta) {
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }

      usuario = await Usuario.ensureIdentityUserFromUta(usuarioUta);
    }

    let storedPassword = usuario.password_hash || usuario.password || usuario.pass || usuario.contraseña || usuario.CON_USU;

    if (!storedPassword) {
      const usuarioUta = await Usuario.findByEmailInUta(email);
      if (!usuarioUta) {
        console.error('No se encontró contraseña en BD_IDENTIDAD ni usuario en BD_UTA:', usuario);
        return res.status(500).json({ message: 'Error en el servidor' });
      }
      storedPassword = usuarioUta.password;
    }

    const passwordValida = await verifyPassword(password, storedPassword);
    if (!passwordValida) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const rolUsuario = usuario.rol || usuario.role || usuario.rolCodigo;
    const emailUsuario = usuario.email || usuario.correo || usuario.COR_INS_REF_USU;
    const idUsuario = usuario.id || usuario.ID_USU;

    const token = generateToken(idUsuario, rolUsuario);

    res.json({
      id: idUsuario,
      nombre: usuario.nombre,
      email: emailUsuario,
      rol: rolUsuario,
      token
    });
  } catch (error) {
    console.error(error);

    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      return res.status(500).json({ message: 'Error de conexión: revisa DB_USER y DB_PASSWORD en .env' });
    }

    if (error.code === 'ER_BAD_DB_ERROR') {
      return res.status(500).json({ message: 'Base de datos no encontrada: revisa DB_IDENTIDAD_NAME en .env' });
    }

    res.status(500).json({ message: 'Error en el servidor' });
  }
};

module.exports = { login };
