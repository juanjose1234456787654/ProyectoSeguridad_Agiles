/**
 * T3.5 – Tests de notificaciones: payload enriquecido y emisión WebSocket
 * Verifica que incidente:creado incluya emailUsuario, nombreUsuario, nombreZona
 */

jest.mock('../models/Incidente');
const Incidente = require('../models/Incidente');
const incidenteController = require('../controllers/incidenteController');

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeReq = (body = {}, usuario = { id: 'USR-001', rol: 'Guardia', email: 'guardia@uta.edu.ec' }) => ({
  body,
  params: {},
  usuario,
  app: {
    get: jest.fn(() => mockIo)
  }
});

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

let mockIo;

beforeEach(() => {
  jest.clearAllMocks();
  mockIo = { emit: jest.fn() };
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('T3.5 – incidente:creado payload enriquecido', () => {
  const payloadBase = {
    id: 'INC-001',
    motivo: 'Robo',
    estado: 'Activo',
    idZona: 'ZONA-A',
    idUsuario: 'USR-001'
  };

  const payloadEnriquecido = {
    ...payloadBase,
    emailUsuario: 'docente@uta.edu.ec',
    nombreUsuario: 'Juan Pérez',
    nombreZona: 'Bloque A – Aulas'
  };

  test('emite incidente:creado con emailUsuario y nombreUsuario cuando findById tiene éxito', async () => {
    Incidente.create.mockResolvedValue(payloadBase);
    Incidente.findById.mockResolvedValue(payloadEnriquecido);

    const req = makeReq({ motivo: 'Robo', idZona: 'ZONA-A', idUsuario: 'USR-001' });
    const res = makeRes();

    await incidenteController.create(req, res);

    expect(Incidente.create).toHaveBeenCalledTimes(1);
    expect(Incidente.findById).toHaveBeenCalledWith('INC-001');

    const [evento, payload] = mockIo.emit.mock.calls[0];
    expect(evento).toBe('incidente:creado');
    expect(payload.emailUsuario).toBe('docente@uta.edu.ec');
    expect(payload.nombreUsuario).toBe('Juan Pérez');
    expect(payload.nombreZona).toBe('Bloque A – Aulas');
  });

  test('emite incidente:creado con payload base si findById falla (fallback gracioso)', async () => {
    Incidente.create.mockResolvedValue(payloadBase);
    Incidente.findById.mockRejectedValue(new Error('DB error'));

    const req = makeReq({ motivo: 'Robo', idZona: 'ZONA-A', idUsuario: 'USR-001' });
    const res = makeRes();

    await incidenteController.create(req, res);

    expect(mockIo.emit).toHaveBeenCalledTimes(1);
    const [evento, payload] = mockIo.emit.mock.calls[0];
    expect(evento).toBe('incidente:creado');
    // Debe emitir al menos los campos base
    expect(payload.id).toBe('INC-001');
    expect(payload.motivo).toBe('Robo');
    // No debe romper el servidor
  });

  test('emite incidente:creado con payload base si findById devuelve null', async () => {
    Incidente.create.mockResolvedValue(payloadBase);
    Incidente.findById.mockResolvedValue(null);

    const req = makeReq({ motivo: 'Robo', idZona: 'ZONA-A', idUsuario: 'USR-001' });
    const res = makeRes();

    await incidenteController.create(req, res);

    const [evento, payload] = mockIo.emit.mock.calls[0];
    expect(evento).toBe('incidente:creado');
    expect(payload.id).toBe('INC-001');
  });

  test('responde 201 independientemente de si findById enriquece el payload', async () => {
    Incidente.create.mockResolvedValue(payloadBase);
    Incidente.findById.mockResolvedValue(payloadEnriquecido);

    const req = makeReq({ motivo: 'Robo', idZona: 'ZONA-A', idUsuario: 'USR-001' });
    const res = makeRes();

    await incidenteController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(payloadBase);
  });

  test('responde 400 si motivo está vacío', async () => {
    const req = makeReq({ motivo: '', idZona: 'ZONA-A', idUsuario: 'USR-001' });
    const res = makeRes();

    await incidenteController.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Incidente.create).not.toHaveBeenCalled();
    expect(mockIo.emit).not.toHaveBeenCalled();
  });

  test('no emite el evento si Incidente.create lanza un error', async () => {
    Incidente.create.mockRejectedValue(new Error('DB error'));

    const req = makeReq({ motivo: 'Robo', idZona: 'ZONA-A', idUsuario: 'USR-001' });
    const res = makeRes();

    await incidenteController.create(req, res);

    expect(mockIo.emit).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
