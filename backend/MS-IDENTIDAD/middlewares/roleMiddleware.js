const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ message: 'No autenticado' });
    }
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ message: 'No tienes permiso para acceder' });
    }
    next();
  };
};

module.exports = { authorize };
