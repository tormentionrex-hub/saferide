import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, KeyRound, ChevronRight, CheckCircle } from 'lucide-react';
import api from '../../services/api';
import Swal from 'sweetalert2';
import './Login.css';

// Debe coincidir con la validación del backend en authRoutes.js:
//   minúscula + mayúscula + dígito + carácter especial (@$!%*?&), mínimo 8 caracteres.
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/;

const NuevoPassword = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const email = location.state?.email;

    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [cargando, setCargando] = useState(false);

    // Si el usuario llega directo a /nuevoPassword sin pasar por /recuperarPassword,
    // no tiene email en el state → redirigimos al primer paso.
    useEffect(() => {
        if (!email) {
            navigate('/recuperarPassword', { replace: true });
        }
    }, [email, navigate]);

    if (!email) return null;

    const manejarRestablecimiento = async (e) => {
        e.preventDefault();

        if (!/^\d{6}$/.test(code)) {
            Swal.fire({ icon: 'warning', title: 'Código inválido', text: 'El código debe ser de 6 dígitos numéricos.', confirmButtonColor: '#F59E0B' });
            return;
        }

        if (password !== confirmPassword) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Las contraseñas no coinciden.', confirmButtonColor: '#EF4444' });
            return;
        }

        if (!PASSWORD_REGEX.test(password)) {
            Swal.fire({
                icon: 'warning',
                title: 'Contraseña no segura',
                text: 'Debe tener mínimo 8 caracteres e incluir mayúscula, minúscula, número y carácter especial (@$!%*?&).',
                confirmButtonColor: '#F59E0B',
            });
            return;
        }

        setCargando(true);
        try {
            await api.post('/auth/reset-password', { email, code, newPassword: password });
            Swal.fire({
                icon: 'success',
                title: '¡Contraseña Actualizada!',
                text: 'Ya puedes acceder con tu nueva clave.',
                confirmButtonColor: '#2563EB',
            }).then(() => navigate('/login'));
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.response?.data?.message || 'El código es inválido o ha expirado.',
                confirmButtonColor: '#EF4444',
            });
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="pantallaLogin">
            <div className="seccionFormularioLateral">
                <div className="contenedorCajaLogin animacionEntradaSuave">
                    <div className="encabezadoLogin">
                        <CheckCircle size={40} color="#2563EB" style={{ marginBottom: '15px' }} />
                        <h2>Nueva Clave</h2>
                        <p>Ingresa el código que enviamos a <strong>{email}</strong> y tu nueva contraseña.</p>
                    </div>

                    <form className="formularioLoginEstilo" onSubmit={manejarRestablecimiento}>
                        <div className="grupoEntradaLogin">
                            <label>Código de Verificación</label>
                            <div className="envolturaEntrada">
                                <KeyRound size={18} className="iconoEntrada" />
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    maxLength={6}
                                    placeholder="6 dígitos"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grupoEntradaLogin">
                            <label>Nueva Contraseña</label>
                            <div className="envolturaEntrada">
                                <Lock size={18} className="iconoEntrada" />
                                <input
                                    type="password"
                                    placeholder="Mínimo 8 caracteres"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grupoEntradaLogin">
                            <label>Confirmar Contraseña</label>
                            <div className="envolturaEntrada">
                                <Lock size={18} className="iconoEntrada" />
                                <input
                                    type="password"
                                    placeholder="Repite tu contraseña"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" className="botonEnviarLogin" disabled={cargando}>
                            <span>{cargando ? 'Guardando...' : 'Cambiar Contraseña'}</span>
                            {!cargando && <ChevronRight size={20} />}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default NuevoPassword;
