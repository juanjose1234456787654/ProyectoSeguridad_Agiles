const Usuario = require('../models/Usuario');

const emitRealtime = (req, eventName, payload) => {
  const io = req.app.get('io');
  if (io) io.emit(eventName, payload);
};

// GET /api/identidad/usuarios  – solo Administrador
const getUsuarios = async (req, res) => {
  try {
    console.log('[getUsuarios] Iniciando...');
    const usuarios = await Usuario.findAll();
    console.log(`[getUsuarios] Resultado: ${usuarios.length} usuarios`);
    res.json(usuarios);
  } catch (error) {
    console.error('[getUsuarios] ERROR:', error.message);
    res.status(500).json({ message: `Error al obtener usuarios: ${error.message}` });
  }
};

// PUT /api/identidad/usuarios/:id  – solo Administrador
const updateUsuario = async (req, res) => {
  try {
    const { email, rolCodigo } = req.body;
    const actualizado = await Usuario.update(req.params.id, { email, rolCodigo });
    if (!actualizado) return res.status(404).json({ message: 'Usuario no encontrado o sin cambios' });
    emitRealtime(req, 'usuario:actualizado', actualizado);
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
    emitRealtime(req, 'usuario:bloqueado', resultado);
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

// DELETE /api/identidad/usuarios/:id  – solo Administrador
const deleteUsuario = async (req, res) => {
  try {
    await Usuario.deleteById(req.params.id);
    emitRealtime(req, 'usuario:eliminado', { id: req.params.id });
    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('[deleteUsuario]', error);
    res.status(500).json({ message: `Error al eliminar usuario: ${error.message}` });
  }
};

module.exports = { getUsuarios, updateUsuario, bloquearUsuario, deleteUsuario };
