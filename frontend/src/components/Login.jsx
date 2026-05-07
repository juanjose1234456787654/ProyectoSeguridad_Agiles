import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  // ==================== CANVAS DE PARTÍCULAS ====================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    const BLUE = '#0B2A5D';
    const GOLD = '#F4B41A';
    let animationId;

    class Particle {
      constructor(x, y, r, c, sx, sy, op) {
        this.x = x; this.y = y; this.r = r; this.c = c; this.sx = sx; this.sy = sy; this.op = op;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = this.c;
        ctx.globalAlpha = this.op;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      update() {
        this.x += this.sx;
        this.y += this.sy;
        if (this.x + this.r < 0) this.x = width + this.r;
        if (this.x - this.r > width) this.x = -this.r;
        if (this.y + this.r < 0) this.y = height + this.r;
        if (this.y - this.r > height) this.y = -this.r;
        this.draw();
      }
    }

    function initParticles() {
      particles = [];
      for (let i = 0; i < 80; i++) {
        let rad = Math.random() * 4 + 1.5;
        let col = Math.random() > 0.7 ? GOLD : BLUE;
        let op = Math.random() * 0.5 + 0.2;
        let x = Math.random() * width, y = Math.random() * height;
        let sx = (Math.random() - 0.5) * 0.4, sy = (Math.random() - 0.5) * 0.3;
        particles.push(new Particle(x, y, rad, col, sx, sy, op));
      }
      for (let i = 0; i < 30; i++) {
        let rad = Math.random() * 3 + 1;
        let col = `rgba(255, 215, 120, ${Math.random() * 0.6 + 0.2})`;
        let x = Math.random() * width, y = Math.random() * height;
        let sx = (Math.random() - 0.5) * 0.25, sy = (Math.random() - 0.5) * 0.2;
        particles.push(new Particle(x, y, rad, col, sx, sy, 0.7));
      }
    }

    function animateBg() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => p.update());
      animationId = requestAnimationFrame(animateBg);
    }

    function resizeCanvas() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      initParticles();
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    animateBg();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, []);

  // ==================== TOAST Y MODAL ====================
  const showToast = (message, type = 'info') => {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  };

  const openModal = (title, bodyHtml, onConfirm) => {
    const modal = document.getElementById('customModal');
    if (!modal) return;
    document.getElementById('modalTitle').innerHTML = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    modal.classList.add('active');
    const confirmBtn = document.getElementById('modalConfirm');
    const cancelBtn = document.getElementById('modalCancel');
    const handleConfirm = () => {
      modal.classList.remove('active');
      onConfirm();
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    };
    const handleCancel = () => {
      modal.classList.remove('active');
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    };
    confirmBtn.onclick = handleConfirm;
    cancelBtn.onclick = handleCancel;
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
  };

  // ==================== LOGIN REAL CON BACKEND ====================
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      showToast('Por favor, complete todos los campos', 'error');
      return;
    }
    setLoading(true);
    try {
      const userData = await login(email, password);
      showToast(`✅ Bienvenido ${userData.nombre || email} al sistema de seguridad UTA`, 'success');

      if (remember) {
        localStorage.setItem('utaUser', email);
        localStorage.setItem('utaRemember', 'true');
      } else {
        localStorage.removeItem('utaUser');
        localStorage.removeItem('utaRemember');
      }

      // Redirigir según el rol
      switch (userData.rol) {
        case 'Administrador':
          navigate('/admin');
          break;
        case 'Guardia':
          navigate('/guardia');
          break;
        case 'Estudiante':
        case 'Docente':
        case 'Personal':
          navigate('/estudiante');
          break;
        default:
          navigate('/dashboard');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Credenciales inválidas';
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Restaurar usuario recordado
  useEffect(() => {
    const savedUser = localStorage.getItem('utaUser');
    if (savedUser) {
      setEmail(savedUser);
      setRemember(true);
    }
  }, []);

  // ==================== RENDER DEL DISEÑO COMPLETO ====================
  return (
    <>
      <canvas ref={canvasRef} id="canvas-bg"></canvas>
      <div className="security-dashboard">
        {/* GUARDIA ANIMADO */}
        <div className="guard-wrapper">
          <div className="guard-character">
            <div className="head">
              <div className="cap"><div className="visor"></div><div className="star-badge">★</div></div>
              <div className="eye left"></div><div className="eye right"></div>
              <div className="mouth"></div>
            </div>
            <div className="body"><div className="badge"><i className="fas fa-shield-alt"></i></div></div>
            <div className="arm left"><div className="hand"></div></div>
            <div className="arm right"><div className="hand"></div></div>
            <div className="leg left"><div className="boot"></div></div>
            <div className="leg right"><div className="boot"></div></div>
            <div className="bubble"><i className="fas fa-shield-alt"></i> Seguridad UTA activa</div>
            <div className="flashlight"><i className="fas fa-lightbulb"></i></div>
          </div>
        </div>

        {/* TARJETA DE LOGIN */}
        <div className="login-container">
          <div className="login-card">
            <div className="shield-header">
              <div className="icon-shield"><i className="fas fa-shield-alt"></i></div>
              <h1>Acceso Seguro</h1>
              <div className="gold-line"></div>
              <div className="sub"><i className="fas fa-university"></i> Universidad Técnica de Ambato</div>
              <div className="security-tag"><i className="fas fa-lock"></i> Plataforma de Seguridad Institucional</div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="input-field">
                <i className="fas fa-user-graduate"></i>
                <input
                  type="email"
                  placeholder="Correo institucional"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
              <div className="input-field">
                <i className="fas fa-lock"></i>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button type="button" className="toggle-pwd" onClick={() => setShowPassword(!showPassword)}>
                  <i className={`far ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                </button>
              </div>
              <div className="options">
                <label className="checkbox">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Recordarme
                </label>
                <a href="#" className="forgot" onClick={(e) => {
                  e.preventDefault();
                  openModal('Recuperar contraseña',
                    `<p>Ingresa tu correo institucional para recibir instrucciones.</p>
                     <input type="email" id="recoveryEmail" placeholder="correo@uta.edu.ec" style="width:100%;">`,
                    () => {
                      const emailRec = document.getElementById('recoveryEmail')?.value;
                      if (emailRec && emailRec.includes('@')) {
                        showToast(`📧 Se han enviado instrucciones a ${emailRec}`, 'success');
                      } else {
                        showToast('Correo inválido, intenta de nuevo', 'error');
                      }
                    });
                }}>
                  <i className="fas fa-key"></i> ¿Olvidaste tu contraseña?
                </a>
              </div>
              <button type="submit" className="btn-login" disabled={loading}>
                {loading ? <i className="fas fa-circle-notch fa-spin"></i> : <span>Ingresar al sistema</span>}
                {!loading && <i className="fas fa-arrow-right"></i>}
              </button>
              <div className="register">
                ¿No tienes cuenta? <a href="#" onClick={(e) => {
                  e.preventDefault();
                  openModal('Solicitar acceso seguro',
                    `<p>Completa tus datos para solicitar credenciales:</p>
                     <input type="text" id="regName" placeholder="Nombres completos" style="width:100%; margin-bottom:12px;">
                     <input type="email" id="regEmail" placeholder="Correo institucional" style="width:100%;">`,
                    () => {
                      const name = document.getElementById('regName')?.value;
                      const emailReg = document.getElementById('regEmail')?.value;
                      if (name && emailReg && emailReg.includes('@')) {
                        showToast(`📋 Solicitud enviada. Revisa tu correo ${emailReg}`, 'success');
                      } else {
                        showToast('Completa todos los campos correctamente', 'error');
                      }
                    });
                }}>Solicitar acceso seguro</a>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="footer-uta">
        © 2025 UTA Seguridad – Protegiendo tu identidad digital
      </div>

      {/* MODAL GENÉRICO */}
      <div id="customModal" className="modal">
        <div className="modal-content">
          <h3 id="modalTitle"></h3>
          <div id="modalBody"></div>
          <div className="modal-buttons">
            <button className="cancel" id="modalCancel">Cancelar</button>
            <button className="confirm" id="modalConfirm">Aceptar</button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;