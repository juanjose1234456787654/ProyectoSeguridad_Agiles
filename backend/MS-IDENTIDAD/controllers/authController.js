const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');

const isBcryptHash = (value) => typeof value === 'string' && /^\$2[aby]\$/.test(value);

const verifyPassword = async (plainPassword, storedPassword) => {
  if (!storedPassword) return false;
  if (isBcryptHash(storedPassword)) {
    return bcrypt.compare(plainPassword, storedPassword);
  }
  // Comparacion tolerante para contraseñas en texto plano (evita fallos por espacios accidentales)
  return String(plainPassword).trim() === String(storedPassword).trim();
};

const login = async (req, res) => {
  try {
    const rawEmail = req.body?.email;
    const rawPassword = req.body?.password;
    const email = String(rawEmail || '').trim().toLowerCase();
    const password = String(rawPassword || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Faltan email o contraseña' });
    }

    let usuario = await Usuario.findByEmailInIdentity(email);
    let usuarioUta = null;

    // Si no existe en BD_IDENTIDAD, buscar en BD_UTA
    if (!usuario) {
      usuarioUta = await Usuario.findByEmailInUta(email);
      if (!usuarioUta) {
        // Email no existe en ninguna BD - error específico de email
        return res.status(401).json({ 
          message: 'Correo Institucional Incorrecto',
          errorType: 'invalid_email'
        });
      }

      // Email existe en BD_UTA, verificar contraseña
      const passwordValidaUta = await verifyPassword(password, usuarioUta.password);
      if (!passwordValidaUta) {
        // Contraseña incorrecta - error específico de contraseña
        return res.status(401).json({ 
          message: 'Contraseña Incorrecta',
          errorType: 'invalid_password'
        });
      }

      usuario = await Usuario.ensureIdentityUserFromUta(usuarioUta);
    } else {
      // Email existe en BD_IDENTIDAD, verificar contraseña
      let storedPassword = usuario.password_hash || usuario.password || usuario.pass || usuario.contraseña || usuario.CON_USU;
      
      if (!storedPassword) {
        // Si no hay contraseña, intentar obtenerla de BD_UTA
        usuarioUta = await Usuario.findByEmailInUta(email);
        if (!usuarioUta) {
          console.error('No se encontró contraseña en BD_IDENTIDAD ni usuario en BD_UTA:', usuario);
          return res.status(500).json({ message: 'Error en el servidor' });
        }
        storedPassword = usuarioUta.password;
      }

      // Comparacion tolerante para contraseñas en texto plano (evita fallos por espacios accidentales)
      const passwordValida = await verifyPassword(password, storedPassword);
      if (!passwordValida) {
        // Contraseña incorrecta - error específico de contraseña
        return res.status(401).json({ 
          message: 'Contraseña Incorrecta',
          errorType: 'invalid_password'
        });
      }
    }

    const rolUsuario = usuario.rol || usuario.role || usuario.rolCodigo;
    const emailUsuario = usuario.email || usuario.correo || usuario.COR_INS_REF_USU;
    let idUsuario = usuario.id || usuario.ID_USU;
    
    // Asegurar que el ID sea string
    idUsuario = String(idUsuario).trim();

    console.log(`[LOGIN] Usuario encontrado:`, {
      idUsuario,
      idUsuarioType: typeof idUsuario,
      idUsuarioLength: idUsuario.length,
      emailUsuario,
      rolUsuario
    });

    const token = generateToken(idUsuario, rolUsuario);

    const response = {
      id: idUsuario,
      nombre: usuario.nombre,
      email: emailUsuario,
      rol: rolUsuario,
      token
    };

    console.log(`[LOGIN] Respuesta a enviar:`, response);

    res.json(response);
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
