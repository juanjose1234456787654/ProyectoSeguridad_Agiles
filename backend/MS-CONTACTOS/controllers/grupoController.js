const Grupo = require('../models/Grupo');
const Contacto = require('../models/Contacto');

// GET /api/contactos/grupos
const getGrupos = async (req, res) => {
  try {
    const idUsuario = String(req.usuario?.id || '').trim();
    const grupos = await Grupo.findGruposByUsuario(idUsuario);
    res.json(grupos);
  } catch (error) {
    console.error('[getGrupos]', error.message);
    res.status(500).json({ message: 'Error al obtener grupos de confianza' });
  }
};

// POST /api/contactos/grupos
const createGrupo = async (req, res) => {
  try {
    const idUsuario = String(req.usuario?.id || '').trim();
    const { nombre, correos } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ message: 'El nombre del grupo es obligatorio' });
    }

    if (!Array.isArray(correos) || correos.length === 0) {
      return res.status(400).json({ message: 'Debes incluir al menos un integrante en el grupo' });
    }

    if (correos.length > Grupo.MAX_INTEGRANTES) {
      return res.status(422).json({
        message: `Un grupo puede tener un máximo de ${Grupo.MAX_INTEGRANTES} integrantes`
      });
    }

    // Validar formato de correos
    const correoInvalido = correos.find((c) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c));
    if (correoInvalido) {
      return res.status(400).json({ message: `Formato de correo inválido: ${correoInvalido}` });
    }

    // Verificar que todos los correos existan en BD_UTA
    const verificaciones = await Promise.all(correos.map((c) => Contacto.existePersona(c)));
    const noExiste = correos.find((_, i) => !verificaciones[i]);
    if (noExiste) {
      return res.status(404).json({
        message: `El correo "${noExiste}" no pertenece a ninguna persona registrada en el sistema institucional`
      });
    }

    const idGrupo = await Grupo.createGrupo({
      idUsuario,
      nombre: nombre.trim(),
      correos
    });

    res.status(201).json({ message: 'Grupo de confianza creado correctamente', id: idGrupo });
  } catch (error) {
    console.error('[createGrupo]', error.message);
    res.status(500).json({ message: 'Error al crear el grupo' });
  }
};

// PUT /api/contactos/grupos/:id
const updateGrupo = async (req, res) => {
  try {
    const idUsuario = String(req.usuario?.id || '').trim();
    const idGrupo = req.params.id;
    const { nombre, correos } = req.body;

    if (!nombre && !correos) {
      return res.status(400).json({ message: 'Debes enviar al menos nombre o lista de correos para actualizar' });
    }

    if (correos !== undefined) {
      if (!Array.isArray(correos) || correos.length === 0) {
        return res.status(400).json({ message: 'La lista de integrantes no puede estar vacía' });
      }

      if (correos.length > Grupo.MAX_INTEGRANTES) {
        return res.status(422).json({
          message: `Un grupo puede tener un máximo de ${Grupo.MAX_INTEGRANTES} integrantes`
        });
      }

      // Verificar correos en BD_UTA
      const verificaciones = await Promise.all(correos.map((c) => Contacto.existePersona(c)));
      const noExiste = correos.find((_, i) => !verificaciones[i]);
      if (noExiste) {
        return res.status(404).json({
          message: `El correo "${noExiste}" no pertenece a ninguna persona registrada en el sistema institucional`
        });
      }
    }

    const actualizado = await Grupo.updateGrupo({ idGrupo, idUsuario, nombre, correos });
    if (!actualizado) {
      return res.status(404).json({ message: 'Grupo no encontrado o no te pertenece' });
    }

    res.json({ message: 'Grupo actualizado correctamente' });
  } catch (error) {
    console.error('[updateGrupo]', error.message);
    res.status(500).json({ message: 'Error al actualizar el grupo' });
  }
};

// DELETE /api/contactos/grupos/:id
const deleteGrupo = async (req, res) => {
  try {
    const idUsuario = String(req.usuario?.id || '').trim();
    const idGrupo = req.params.id;

    const eliminado = await Grupo.deleteGrupo(idGrupo, idUsuario);
    if (!eliminado) {
      return res.status(404).json({ message: 'Grupo no encontrado o no te pertenece' });
    }

    res.json({ message: 'Grupo eliminado correctamente' });
  } catch (error) {
    console.error('[deleteGrupo]', error.message);
    res.status(500).json({ message: 'Error al eliminar el grupo' });
  }
};

module.exports = { getGrupos, createGrupo, updateGrupo, deleteGrupo };
