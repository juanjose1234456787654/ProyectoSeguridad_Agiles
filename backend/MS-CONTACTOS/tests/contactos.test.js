/**
 * T4.4 – Pruebas unitarias y de integración de los endpoints de contactos/alertas
 * HU-2: Gestión de Contactos y Envío de Alertas de Confianza
 *
 * Ejecutar: npm test  (desde backend/MS-CONTACTOS/)
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

// Sobrescribir variables de entorno antes de importar la app
process.env.JWT_SECRET = 'test_secret_uta';
process.env.DB_CLIENT = 'mock'; // sin conexión real en CI

// Mock de los modelos para no requerir SQL Server en las pruebas
jest.mock('../models/Contacto', () => ({
  buscarPersonas: jest.fn(),
  existePersona: jest.fn(),
  findContactosByUsuario: jest.fn(),
  createContacto: jest.fn(),
  deleteContacto: jest.fn(),
  findContactoById: jest.fn(),
  countContactosByUsuario: jest.fn(),
  findCorreosIndividuales: jest.fn()
}));

jest.mock('../models/Grupo', () => ({
  MAX_INTEGRANTES: 5,
  findGruposByUsuario: jest.fn(),
  findGrupoById: jest.fn(),
  createGrupo: jest.fn(),
  updateGrupo: jest.fn(),
  deleteGrupo: jest.fn(),
  findCorreosGrupos: jest.fn()
}));

// Mock de nodemailer para no enviar correos reales en tests
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' })
  }))
}));

const Contacto = require('../models/Contacto');
const Grupo = require('../models/Grupo');

// Importar app DESPUÉS de los mocks
const app = require('../server');

// ─── Token de prueba ──────────────────────────────────────────────────────────

const makeToken = (overrides = {}) =>
  jwt.sign(
    { id: 'USR001', rol: 'Estudiante', email: 'test@uta.edu.ec', nombre: 'Test User', ...overrides },
    process.env.JWT_SECRET
  );

const AUTH = (token) => ({ Authorization: `Bearer ${token}` });

// ─── Helpers ──────────────────────────────────────────────────────────────────

beforeEach(() => jest.clearAllMocks());

// =============================================================================
// GET /api/contactos/buscar
// =============================================================================
describe('GET /api/contactos/buscar', () => {
  it('devuelve 400 si el término tiene menos de 2 caracteres', async () => {
    const token = makeToken();
    const res = await request(app).get('/api/contactos/buscar?q=a').set(AUTH(token));
    expect(res.status).toBe(400);
  });

  it('devuelve lista de personas cuando el término es válido', async () => {
    Contacto.buscarPersonas.mockResolvedValue([
      { cedula: '1800001', nombreCompleto: 'Ana García', correo: 'ana@uta.edu.ec', rol: 'Estudiante' }
    ]);
    const token = makeToken();
    const res = await request(app).get('/api/contactos/buscar?q=Ana').set(AUTH(token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].correo).toBe('ana@uta.edu.ec');
  });

  it('devuelve 401 sin token', async () => {
    const res = await request(app).get('/api/contactos/buscar?q=Test');
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// GET /api/contactos
// =============================================================================
describe('GET /api/contactos', () => {
  it('retorna los contactos individuales del usuario autenticado', async () => {
    Contacto.findContactosByUsuario.mockResolvedValue([
      { id: 1, correo: 'papá@uta.edu.ec', alias: 'Papá' }
    ]);
    const token = makeToken();
    const res = await request(app).get('/api/contactos').set(AUTH(token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

// =============================================================================
// POST /api/contactos
// =============================================================================
describe('POST /api/contactos', () => {
  it('devuelve 400 si falta el correo', async () => {
    const token = makeToken();
    const res = await request(app).post('/api/contactos').set(AUTH(token)).send({ alias: 'Mamá' });
    expect(res.status).toBe(400);
  });

  it('devuelve 400 si el correo tiene formato inválido', async () => {
    const token = makeToken();
    const res = await request(app)
      .post('/api/contactos')
      .set(AUTH(token))
      .send({ correo: 'no-es-un-correo', alias: 'X' });
    expect(res.status).toBe(400);
  });

  it('devuelve 404 si la persona no existe en BD_UTA', async () => {
    Contacto.existePersona.mockResolvedValue(false);
    const token = makeToken();
    const res = await request(app)
      .post('/api/contactos')
      .set(AUTH(token))
      .send({ correo: 'noexiste@uta.edu.ec', alias: 'X' });
    expect(res.status).toBe(404);
  });

  it('devuelve 422 si el usuario ya tiene 5 contactos', async () => {
    Contacto.existePersona.mockResolvedValue(true);
    Contacto.countContactosByUsuario.mockResolvedValue(5);
    const token = makeToken();
    const res = await request(app)
      .post('/api/contactos')
      .set(AUTH(token))
      .send({ correo: 'nuevo@uta.edu.ec' });
    expect(res.status).toBe(422);
  });

  it('crea el contacto correctamente', async () => {
    Contacto.existePersona.mockResolvedValue(true);
    Contacto.countContactosByUsuario.mockResolvedValue(2);
    Contacto.createContacto.mockResolvedValue();
    const token = makeToken();
    const res = await request(app)
      .post('/api/contactos')
      .set(AUTH(token))
      .send({ correo: 'nuevo@uta.edu.ec', alias: 'Hermano' });
    expect(res.status).toBe(201);
    expect(Contacto.createContacto).toHaveBeenCalledWith(
      expect.objectContaining({ correo: 'nuevo@uta.edu.ec', alias: 'Hermano' })
    );
  });
});

// =============================================================================
// DELETE /api/contactos/:id
// =============================================================================
describe('DELETE /api/contactos/:id', () => {
  it('devuelve 404 si el contacto no existe o no pertenece al usuario', async () => {
    Contacto.findContactoById.mockResolvedValue(null);
    const token = makeToken();
    const res = await request(app).delete('/api/contactos/99').set(AUTH(token));
    expect(res.status).toBe(404);
  });

  it('elimina el contacto correctamente', async () => {
    Contacto.findContactoById.mockResolvedValue({ id: 1, correo: 'c@uta.edu.ec', alias: null });
    Contacto.deleteContacto.mockResolvedValue();
    const token = makeToken();
    const res = await request(app).delete('/api/contactos/1').set(AUTH(token));
    expect(res.status).toBe(200);
  });
});

// =============================================================================
// POST /api/contactos/grupos
// =============================================================================
describe('POST /api/contactos/grupos', () => {
  it('devuelve 400 si falta el nombre del grupo', async () => {
    const token = makeToken();
    const res = await request(app)
      .post('/api/contactos/grupos')
      .set(AUTH(token))
      .send({ correos: ['a@uta.edu.ec'] });
    expect(res.status).toBe(400);
  });

  it('devuelve 422 si se envían más de 5 integrantes', async () => {
    const token = makeToken();
    const res = await request(app)
      .post('/api/contactos/grupos')
      .set(AUTH(token))
      .send({
        nombre: 'Familia',
        correos: ['a@uta.edu.ec', 'b@uta.edu.ec', 'c@uta.edu.ec', 'd@uta.edu.ec', 'e@uta.edu.ec', 'f@uta.edu.ec']
      });
    expect(res.status).toBe(422);
  });

  it('crea el grupo correctamente', async () => {
    Contacto.existePersona.mockResolvedValue(true);
    Grupo.createGrupo.mockResolvedValue('GRUABC1234');
    const token = makeToken();
    const res = await request(app)
      .post('/api/contactos/grupos')
      .set(AUTH(token))
      .send({ nombre: 'Mi Familia', correos: ['papa@uta.edu.ec', 'mama@uta.edu.ec'] });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('GRUABC1234');
  });
});

// =============================================================================
// POST /api/contactos/alertar  (T4.3)
// =============================================================================
describe('POST /api/contactos/alertar', () => {
  it('devuelve 422 si el usuario no tiene contactos configurados', async () => {
    Contacto.findCorreosIndividuales.mockResolvedValue([]);
    Grupo.findCorreosGrupos.mockResolvedValue([]);
    const token = makeToken();
    const res = await request(app).post('/api/contactos/alertar').set(AUTH(token)).send({});
    expect(res.status).toBe(422);
  });

  it('envía alerta simultánea a todos los contactos deduplicados', async () => {
    Contacto.findCorreosIndividuales.mockResolvedValue([
      { correo: 'papa@uta.edu.ec', alias: 'Papá' },
      { correo: 'mama@uta.edu.ec', alias: 'Mamá' }
    ]);
    Grupo.findCorreosGrupos.mockResolvedValue([
      { correo: 'papa@uta.edu.ec', grupo: 'Familia' }, // duplicado, se omite
      { correo: 'amigo@uta.edu.ec', grupo: 'Amigos' }
    ]);

    const token = makeToken();
    const res = await request(app)
      .post('/api/contactos/alertar')
      .set(AUTH(token))
      .send({ mensaje: 'Necesito ayuda urgente' });

    expect(res.status).toBe(200);
    // 3 destinatarios únicos: papa, mama, amigo
    expect(res.body.enviados).toBe(3);
    expect(res.body.resultados).toHaveLength(3);
  });

  it('devuelve 401 sin token', async () => {
    const res = await request(app).post('/api/contactos/alertar').send({});
    expect(res.status).toBe(401);
  });
});
