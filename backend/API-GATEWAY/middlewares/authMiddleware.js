const jwt = require('jsonwebtoken');

// Rutas públicas que NO requieren token (solo login)
const PUBLIC_PATHS = ['/api/auth/login'];

const protect = (req, res, next) => {
  if (PUBLIC_PATHS.includes(req.path) || req.path.startsWith('/socket.io')) {
    return next();
  }

  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'No autorizado, token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
};

module.exports = { protect };
