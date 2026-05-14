import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../../Styles/Styles.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
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

  // ==================== LIMPIAR ERRORES AL ESCRIBIR ====================
  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (emailError) setEmailError('');
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (passwordError) setPasswordError('');
  };

  // ==================== LOGIN REAL CON BACKEND ====================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setEmailError('');
    setPasswordError('');

    // Validar que los campos no estén vacíos
    if (!email.trim()) {
      setEmailError('Rellena este campo');
      return;
    }
    if (!password.trim()) {
      setPasswordError('Rellena este campo');
      return;
    }

    setLoading(true);
    try {
      const userData = await login(email, password);
      showToast(`Bienvenido ${userData.nombre || email} al sistema de seguridad UTA`, 'success');

      // Redirigir según rol
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
          navigate('/alertas');
          break;
        default:
          navigate('/alertas');
      }
    } catch (err) {
      let errorMsg = 'Credenciales inválidas';
      
      if (!err.response) {
        errorMsg = 'No se pudo conectar con el servidor. Verifica que el API Gateway este encendido (puerto 4000).';
        showToast(errorMsg, 'error');
      } else if (err.response?.status >= 500) {
        errorMsg = 'Error interno del servidor. Intenta nuevamente en unos segundos.';
        showToast(errorMsg, 'error');
      } else if (err.response?.status === 401) {
        // Error de autenticación - mostrar errores específicos según errorType
        const errorType = err.response?.data?.errorType;
        
        if (errorType === 'invalid_email') {
          setEmailError('Correo Institucional Incorrecto');
          showToast('Correo Institucional Incorrecto', 'error');
        } else if (errorType === 'invalid_password') {
          setPasswordError('Contraseña Incorrecta');
          showToast('Contraseña Incorrecta', 'error');
        } else {
          // Fallback si no viene errorType definido
          errorMsg = err.response?.data?.message || errorMsg;
          showToast(errorMsg, 'error');
        }
      } else {
        errorMsg = err.response?.data?.message || errorMsg;
        showToast(errorMsg, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

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
                  onChange={handleEmailChange}
                  className={emailError ? 'input-error' : ''}
                  required
                  autoComplete="username"
                />
                {emailError && <span className="error-message">{emailError}</span>}
              </div>
              <div className="input-field">
                <i className="fas fa-lock"></i>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Contraseña"
                  value={password}
                  onChange={handlePasswordChange}
                  className={passwordError ? 'input-error' : ''}
                  required
                  autoComplete="current-password"
                />
                <button type="button" className="toggle-pwd" onClick={() => setShowPassword(!showPassword)}>
                  <i className={`far ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                </button>
                {passwordError && <span className="error-message">{passwordError}</span>}
              </div>
              <button type="submit" className="btn-login" disabled={loading}>
                {loading ? <i className="fas fa-circle-notch fa-spin"></i> : <span>Ingresar al sistema</span>}
                {!loading && <i className="fas fa-arrow-right"></i>}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="footer-uta">
        © 2025 UTA Seguridad – Protegiendo tu identidad digital
      </div>
    </>
  );
};

export default Login;