const Contacto = require('../models/Contacto');
const { MAX_INTEGRANTES } = require('../models/Grupo');

// GET /api/contactos/buscar?q=termino
const buscar = async (req, res) => {
  try {
    const termino = String(req.query.q || '').trim();

    if (termino.length < 2) {
      return res.status(400).json({ message: 'El término de búsqueda debe tener al menos 2 caracteres' });
    }

    const emailUsuario = req.usuario?.email || '';
    const personas = await Contacto.buscarPersonas(termino, emailUsuario);
    res.json(personas);
  } catch (error) {
    console.error('[buscar]', error.message);
    res.status(500).json({ message: 'Error al buscar personas' });
  }
};

// GET /api/contactos
const getContactos = async (req, res) => {
  try {
    const idUsuario = String(req.usuario?.id || '').trim();
    const contactos = await Contacto.findContactosByUsuario(idUsuario);
    res.json(contactos);
  } catch (error) {
    console.error('[getContactos]', error.message);
    res.status(500).json({ message: 'Error al obtener contactos de confianza' });
  }
};

// POST /api/contactos
const addContacto = async (req, res) => {
  try {
    const idUsuario = String(req.usuario?.id || '').trim();
    const { correo, alias } = req.body;

    if (!correo) {
      return res.status(400).json({ message: 'El correo del contacto es obligatorio' });
    }

    // Validar formato de correo
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({ message: 'Formato de correo inválido' });
    }

    // Verificar que la persona exista en BD_UTA
    const existe = await Contacto.existePersona(correo);
    if (!existe) {
      return res.status(404).json({ message: 'No se encontró ninguna persona con ese correo en el sistema institucional' });
    }

    // Verificar límite de 5 contactos individuales
    const total = await Contacto.countContactosByUsuario(idUsuario);
    if (total >= MAX_INTEGRANTES) {
      return res.status(422).json({
        message: `Has alcanzado el límite de ${MAX_INTEGRANTES} contactos individuales`
      });
    }

    await Contacto.createContacto({ idUsuario, correo, alias });
    res.status(201).json({ message: 'Contacto de confianza agregado correctamente' });
  } catch (error) {
    console.error('[addContacto]', error.message);
    res.status(500).json({ message: 'Error al agregar el contacto' });
  }
};

// DELETE /api/contactos/:id
const removeContacto = async (req, res) => {
  try {
    const idUsuario = String(req.usuario?.id || '').trim();
    const idContacto = Number(req.params.id);

    if (!idContacto) {
      return res.status(400).json({ message: 'ID de contacto inválido' });
    }

    const contacto = await Contacto.findContactoById(idContacto, idUsuario);
    if (!contacto) {
      return res.status(404).json({ message: 'Contacto no encontrado o no te pertenece' });
    }

    await Contacto.deleteContacto(idContacto, idUsuario);
    res.json({ message: 'Contacto eliminado correctamente' });
  } catch (error) {
    console.error('[removeContacto]', error.message);
    res.status(500).json({ message: 'Error al eliminar el contacto' });
  }
};

module.exports = { buscar, getContactos, addContacto, removeContacto };
