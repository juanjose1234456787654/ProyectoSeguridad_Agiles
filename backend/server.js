require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const dbRoutes = require('./routes/dbRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/db', dbRoutes);

// Ruta de ejemplo para probar middleware de auth y roles
app.get('/api/perfil', require('./middlewares/authMiddleware').protect, (req, res) => {
  res.json({ message: 'Acceso concedido', usuario: req.usuario });
});

// Ruta solo para administradores (ejemplo)
app.get('/api/admin-only', 
  require('./middlewares/authMiddleware').protect,
  require('./middlewares/roleMiddleware').authorize('Administrador'),
  (req, res) => {
    res.json({ message: 'Solo administradores ven esto' });
  }
);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor backend en http://localhost:${PORT}`);
});