const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Faltan email o contraseña' });
    }

    const usuario = await Usuario.findByEmail(email);
    if (!usuario) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const hashedPassword = usuario.password_hash || usuario.password || usuario.pass || usuario.contraseña;
    if (!hashedPassword) {
      console.error('No se encontró campo de contraseña válido para el usuario:', usuario);
      return res.status(500).json({ message: 'Error en el servidor' });
    }

    // T1.2: comparar contraseña con bcrypt
    const passwordValida = await bcrypt.compare(password, hashedPassword);
    if (!passwordValida) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const rolUsuario = usuario.rol || usuario.role;
    const emailUsuario = usuario.email || usuario.correo;

    // T1.1: generar token JWT
    const token = generateToken(usuario.id, rolUsuario);

    res.json({
      id: usuario.id,
      nombre: usuario.nombre,
      email: emailUsuario,
      rol: rolUsuario,
      token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

module.exports = { login };