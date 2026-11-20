import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ChevronRight } from 'lucide-react';
import './Login.css';
import IconSafeRide from '../../imgs/IconSafeRide.png';
import Swal from 'sweetalert2';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    // Seguridad: Limpiar campos siempre al entrar
    useEffect(() => {
        setEmail('');
        setPassword('');
    }, []);

    const iniciarSesion = async (e) => {
        e.preventDefault();
        
        if (!email.trim() || !password.trim()) {
            Swal.fire({
                icon: "warning",
                title: "Campos vacíos",
                text: "Por favor, ingresa tus credenciales.",
                confirmButtonText: "Entendido",
                confirmButtonColor: "#2563EB"
            });
            return;
        }

        try {
            const result = await login(email, password);

            if (result?.notAdmin) {
                // AuthContext ya cerró y descartó la sesión no-admin.
                Swal.fire({
                    icon: "error",
                    title: "Acceso Denegado",
                    text: "No tienes permisos de administrador, seras redirigido afuera del sistema.",
                    confirmButtonText: "Entendido",
                    confirmButtonColor: "#EF4444"
                }).then(() => {
                    window.history.back();
                });
                return;
            }

            if (result?.success) {
                Swal.fire({
                    icon: "success",
                    title: "¡Bienvenido!",
                    text: "Accediendo al panel administrativo...",
                    showConfirmButton: false,
                    timer: 1500,
                    timerProgressBar: true
                }).then(() => {
                    navigate('/inicio');
                });
            } else {
                Swal.fire({ icon: "error", title: "Error", text: result?.message || 'Error al iniciar sesión', confirmButtonColor: "#EF4444" });
            }
        } catch {
            Swal.fire({ icon: "error", title: "Error", text: "Problema de conexión con el servidor.", confirmButtonColor: "#EF4444" });
        }
    };



    // ===================================================================
    // LOGIN.JSX
    // ===================================================================
    return (
        <div className="pantallaLogin">

            <div className="ImagenLateral">

                <div className="capaSuperpuestaImagen">

                    <div className="marcaSeguridad">

                        <img src={IconSafeRide} alt="SafeRide Logo" />
                        <h1>SafeRide</h1>
                        <p>Plataforma inteligente para la gestión de transporte institucional.</p>
                    </div>
                </div>
            </div>

            <div className="seccionFormularioLateral">

                <div className="contenedorCajaLogin animacionEntradaSuave">

                    <div className="encabezadoLogin">
                        <h2>Acceso Admin</h2>
                        <p>Ingresa tus credenciales para continuar.</p>
                    </div>


                    {/* FORMULARIO */}
                    <section className="formularioLoginEstilo" >

                        <div className="grupoEntradaLogin">

                            <label>Email Institucional</label>
                            <div className="envolturaEntrada">
                                <Mail size={18} className="iconoEntrada" />
                                <input
                                    type="email"
                                    placeholder="Ejemplo@admin.cr"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>

                        <div className="grupoEntradaLogin">
                            
                            <label>Contraseña</label>
                            <div className="envolturaEntrada">
                                <Lock size={18} className="iconoEntrada" />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>

                        <button type="submit" onClick={iniciarSesion} className="botonEnviarLogin">
                            <span>Ingresar al Sistema</span>
                            <ChevronRight size={20} />
                        </button>

                        <div className="enlacesPieLogin">
                            <Link to="/recuperarPassword">¿Olvidaste tu contraseña?</Link>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default Login;
