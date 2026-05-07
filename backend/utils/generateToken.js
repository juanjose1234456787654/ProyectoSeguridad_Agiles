const jwt = require('jsonwebtoken');

const generateToken = (id, rol) => {
  return jwt.sign(
    { id, rol },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
};

module.exports = generateToken;