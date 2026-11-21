import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ChevronRight, ArrowLeft } from 'lucide-react';
import api from '../../services/api';
import Swal from 'sweetalert2';
import './Login.css';

const RecuperarPassword = () => {
    const [email, setEmail] = useState('');
    const [cargando, setCargando] = useState(false);
    const navigate = useNavigate();

    const manejarSolicitud = async (e) => {
        e.preventDefault();
        setCargando(true);

        try {
            await api.post('/auth/send-verification-code', { email });
            await Swal.fire({
                icon: 'success',
                title: 'Código enviado',
                text: `Si el correo está registrado, recibirás un código de 6 dígitos en breve. Revisa también tu carpeta de spam.`,
                confirmButtonText: 'Continuar',
                confirmButtonColor: '#2563EB',
            });
            navigate('/nuevoPassword', { state: { email } });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.response?.data?.message || 'No se pudo procesar la solicitud.',
                confirmButtonColor: '#EF4444',
            });
        } finally {
            setCargando(false);
        }
    };


    //========================================================
    // BLOQUE DE RETORNO
    //========================================================
    return (
        <div className="pantallaLogin">

            <div className="seccionFormularioLateral">

                <div className="contenedorCajaLogin animacionEntradaSuave">

                    <div className="encabezadoLogin">

                        <Link to="/login" className="botonRegresar">
                            <ArrowLeft size={18} />
                            <span>Volver al Login</span>
                        </Link>
                        <h2>Recuperar Acceso</h2>
                        <p>Te enviaremos un código de 6 dígitos a tu correo.</p>
                    </div>

                    <form className="formularioLoginEstilo" onSubmit={manejarSolicitud}>
                        <div className="grupoEntradaLogin">
                            <label>Tu Email Institucional</label>
                            <div className="envolturaEntrada">
                                <Mail size={18} className="iconoEntrada" />
                                <input
                                    type="email"
                                    placeholder="admin@saferide.cr"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" className="botonEnviarLogin" disabled={cargando}>
                            <span>{cargando ? 'Enviando...' : 'Enviar Código'}</span>
                            {!cargando && <ChevronRight size={20} />}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RecuperarPassword;
