const Usuario = require('../models/Usuario');

// GET /api/identidad/usuarios  – solo Administrador
const getUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.findAll();
    res.json(usuarios);
  } catch (error) {
    console.error('[getUsuarios]', error);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
};

// PUT /api/identidad/usuarios/:id  – solo Administrador
const updateUsuario = async (req, res) => {
  try {
    const { email, rolCodigo } = req.body;
    const actualizado = await Usuario.update(req.params.id, { email, rolCodigo });
    if (!actualizado) return res.status(404).json({ message: 'Usuario no encontrado o sin cambios' });
    res.json(actualizado);
  } catch (error) {
    console.error('[updateUsuario]', error);
    res.status(500).json({ message: 'Error al actualizar usuario' });
  }
};

// PATCH /api/identidad/usuarios/:id/bloquear  – solo Administrador
const bloquearUsuario = async (req, res) => {
  try {
    const { bloqueado } = req.body;
    if (typeof bloqueado !== 'boolean') {
      return res.status(400).json({ message: 'El campo "bloqueado" debe ser true o false' });
    }
    const resultado = await Usuario.setBloqueado(req.params.id, bloqueado);
    res.json(resultado);
  } catch (error) {
    if (error.message === 'CAMPO_BLOQUEADO_NO_EXISTE') {
      return res.status(501).json({
        message: 'La columna BLOQUEADO no existe en la tabla USUARIOS. Ejecute: ALTER TABLE USUARIOS ADD BLOQUEADO BIT NOT NULL DEFAULT 0'
      });
    }
    console.error('[bloquearUsuario]', error);
    res.status(500).json({ message: 'Error al bloquear/desbloquear usuario' });
  }
};

module.exports = { getUsuarios, updateUsuario, bloquearUsuario };
