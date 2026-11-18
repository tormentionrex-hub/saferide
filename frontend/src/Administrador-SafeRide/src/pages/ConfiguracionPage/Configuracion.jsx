import { useState, useEffect, useCallback } from 'react';
import {
    ShieldCheck, Palette, Mail, Phone,
    RefreshCcw, Wrench, Bell, BellOff, Trash2, Globe,
    Server, Cpu, Clock, Activity, Check
} from 'lucide-react';
import Swal from 'sweetalert2';

import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import SupportImage from '../../imgs/SupportConfig.png';
import './Configuracion.css';

// ── Detección de navegador desde el userAgent ──
const detectBrowser = () => {
    const ua = navigator.userAgent;
    if (/Edg\//.test(ua))      return 'Microsoft Edge';
    if (/Chrome\//.test(ua))   return 'Google Chrome';
    if (/Firefox\//.test(ua))  return 'Mozilla Firefox';
    if (/Safari\//.test(ua))   return 'Safari';
    return 'Desconocido';
};

const detectOS = () => {
    const ua = navigator.userAgent;
    if (/Windows/.test(ua))       return 'Windows';
    if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
    if (/Android/.test(ua))       return 'Android';
    if (/iPhone|iPad/.test(ua))   return 'iOS';
    if (/Linux/.test(ua))         return 'Linux';
    return 'Desconocido';
};

// ── Tema: opciones con descripción ──
const TEMAS = [
    { id: 'estandar', label: 'Estándar', desc: 'Claro corporativo' },
    { id: 'gris',     label: 'Gris',     desc: 'Neutro profesional' },
    { id: 'oscuro',   label: 'Oscuro',   desc: 'Bajo en luz azul' },
    { id: 'salvia',   label: 'Salvia',   desc: 'Verde calmo' },
];

const Configuracion = () => {
    const { theme, setTheme } = useTheme();

    // ── Estado del sistema (real, vía /health) ──
    const [healthState, setHealthState] = useState({
        status: 'checking',     // 'checking' | 'online' | 'offline'
        responseMs: null,
        environment: null,
        lastChecked: null,
    });

    const checkHealth = useCallback(async () => {
        setHealthState((s) => ({ ...s, status: 'checking' }));
        const t0 = performance.now();
        try {
            const res = await api.get('/health');
            const t1 = performance.now();
            setHealthState({
                status: 'online',
                responseMs: Math.round(t1 - t0),
                environment: res.data?.environment || null,
                lastChecked: new Date(),
            });
        } catch {
            const t1 = performance.now();
            setHealthState({
                status: 'offline',
                responseMs: Math.round(t1 - t0),
                environment: null,
                lastChecked: new Date(),
            });
        }
    }, []);

    useEffect(() => { checkHealth(); }, [checkHealth]);

    // ── Permiso de notificaciones del navegador ──
    const [notifPerm, setNotifPerm] = useState(
        typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
    );

    const requestNotifications = async () => {
        if (typeof Notification === 'undefined') {
            Swal.fire({ icon: 'error', title: 'No soportado', text: 'Este navegador no soporta notificaciones.' });
            return;
        }
        const perm = await Notification.requestPermission();
        setNotifPerm(perm);
        if (perm === 'granted') {
            new Notification('SafeRide', {
                body: 'Las notificaciones están activadas en este navegador.',
                icon: '/favicon.ico',
            });
        }
    };

    // ── Mantenimiento ──
    const handleClearCache = async () => {
        const r = await Swal.fire({
            icon: 'warning',
            title: '¿Limpiar caché local?',
            html: `Se eliminarán <strong>preferencias del navegador</strong> guardadas localmente
                   (tema, ajustes de monitoreo, marcadores de quejas leídas). <br/><br/>
                   <em>No afecta tu cuenta ni datos del servidor.</em>`,
            showCancelButton: true,
            confirmButtonText: 'Sí, limpiar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#EF4444',
            cancelButtonColor: '#64748B',
        });
        if (!r.isConfirmed) return;
        try {
            localStorage.clear();
            sessionStorage.clear();
            await Swal.fire({
                icon: 'success',
                title: 'Caché limpio',
                text: 'Se recargará la página para aplicar los cambios.',
                timer: 2000, showConfirmButton: false,
            });
            window.location.reload();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'No se pudo limpiar', text: err.message });
        }
    };

    const handleReload = () => window.location.reload();

    // ── Render ──
    const envBadge = import.meta.env?.PROD ? 'Producción' : 'Desarrollo';
    const appVersion = import.meta.env?.VITE_APP_VERSION || '1.0.0';
    const apiBaseUrl = import.meta.env?.VITE_API_URL || '/api/v1';
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return (
        <div className="contenedorConfiguracion">
            <div className="cabeceraConfiguracion">
                <h1>Configuración del Sistema</h1>
                <p>Gestiona la red de transporte de tu organización y la identidad del sistema. Usa estos controles para asegurar una experiencia segura y fluida para todo el equipo.</p>
            </div>

            <div className="cuerpoConfiguracion">

                {/* ── Estado del Sistema (real) ── */}
                <div className="tarjetaConfiguracion">
                    <div className="tarjetaTitulo">
                        <div className="iconoTituloWrap bg-verdeClaro">
                            <ShieldCheck size={20} className="iconoVerde" />
                        </div>
                        <h3>Estado del Sistema</h3>
                        <button
                            type="button"
                            className="btnIconoAccion"
                            onClick={checkHealth}
                            disabled={healthState.status === 'checking'}
                            title="Volver a verificar"
                        >
                            <RefreshCcw size={14} className={healthState.status === 'checking' ? 'rotating' : ''} />
                        </button>
                    </div>
                    <div className="tarjetaCuerpo flexCol">
                        <div className="listaEstado">
                            <div className="itemEstado">
                                <div className="estadoIzquierda">
                                    <div className={`puntoEstado ${healthState.status === 'online' ? 'verde' : healthState.status === 'offline' ? 'rojo' : 'gris'}`}></div>
                                    <span>Servicios API</span>
                                </div>
                                <span className={`badgeEstado ${healthState.status === 'online' ? 'optimo' : healthState.status === 'offline' ? 'critico' : 'estable'}`}>
                                    {healthState.status === 'online' ? 'Conectado' : healthState.status === 'offline' ? 'Sin conexión' : 'Verificando…'}
                                </span>
                            </div>
                            <div className="itemEstado">
                                <div className="estadoIzquierda">
                                    <div className="puntoEstado gris"></div>
                                    <span>Tiempo de respuesta</span>
                                </div>
                                <span className="badgeEstado neutral">
                                    {healthState.responseMs != null ? `${healthState.responseMs} ms` : '—'}
                                </span>
                            </div>
                            <div className="itemEstado">
                                <div className="estadoIzquierda">
                                    <div className="puntoEstado azul"></div>
                                    <span>Ambiente</span>
                                </div>
                                <span className="badgeEstado neutral">
                                    {healthState.environment || envBadge}
                                </span>
                            </div>
                            <div className="itemEstado">
                                <div className="estadoIzquierda">
                                    <div className="puntoEstado gris"></div>
                                    <span>Última verificación</span>
                                </div>
                                <span className="badgeEstado neutral">
                                    {healthState.lastChecked ? healthState.lastChecked.toLocaleTimeString('es-CR') : '—'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Información del Sistema ── */}
                <div className="tarjetaConfiguracion">
                    <div className="tarjetaTitulo">
                        <div className="iconoTituloWrap bg-celeste">
                            <Server size={20} className="iconoCeleste" />
                        </div>
                        <h3>Información del Sistema</h3>
                    </div>
                    <div className="tarjetaCuerpo flexCol">
                        <div className="listaInfo">
                            <div className="filaInfo">
                                <Activity size={14} />
                                <span className="labelInfo">Versión</span>
                                <span className="valorInfo">{appVersion}</span>
                            </div>
                            <div className="filaInfo">
                                <Globe size={14} />
                                <span className="labelInfo">API</span>
                                <span className="valorInfo monoInfo" title={apiBaseUrl}>{apiBaseUrl}</span>
                            </div>
                            <div className="filaInfo">
                                <Cpu size={14} />
                                <span className="labelInfo">Navegador</span>
                                <span className="valorInfo">{detectBrowser()}</span>
                            </div>
                            <div className="filaInfo">
                                <Cpu size={14} />
                                <span className="labelInfo">Sistema operativo</span>
                                <span className="valorInfo">{detectOS()}</span>
                            </div>
                            <div className="filaInfo">
                                <Clock size={14} />
                                <span className="labelInfo">Zona horaria</span>
                                <span className="valorInfo">{timezone}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Temas Visuales ── */}
                <div className="tarjetaConfiguracion">
                    <div className="tarjetaTitulo">
                        <div className="iconoTituloWrap bg-grisClaro">
                            <Palette size={20} className="iconoGris" />
                        </div>
                        <h3>Temas Visuales</h3>
                    </div>
                    <div className="tarjetaCuerpo flexCol">
                        <p className="textoDescriptivo">Personaliza la apariencia de la plataforma. El cambio se aplica al instante.</p>
                        <div className="gridTemas">
                            {TEMAS.map((t) => (
                                <div key={t.id} className="temaOpcion" onClick={() => setTheme(t.id)} role="button" tabIndex={0}>
                                    <div className={`cajaColor bg-tema${t.label} ${theme === t.id ? 'seleccionado' : ''}`}>
                                        {theme === t.id && <Check size={18} className="checkTema" />}
                                    </div>
                                    <span className="nombreTema">{t.label}</span>
                                    <span className="descTema">{t.desc}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Mantenimiento ── */}
                <div className="tarjetaConfiguracion">
                    <div className="tarjetaTitulo">
                        <div className="iconoTituloWrap bg-naranjaClaro">
                            <Wrench size={20} className="iconoNaranja" />
                        </div>
                        <h3>Mantenimiento</h3>
                    </div>
                    <div className="tarjetaCuerpo flexCol">
                        <div className="listaAcciones">
                            <button type="button" className="accionItem" onClick={requestNotifications} disabled={notifPerm === 'granted' || notifPerm === 'unsupported'}>
                                <div className="accionIcono">
                                    {notifPerm === 'granted'
                                        ? <Bell size={18} color="#16A34A" />
                                        : notifPerm === 'denied' || notifPerm === 'unsupported'
                                            ? <BellOff size={18} color="#94A3B8" />
                                            : <Bell size={18} color="#2563EB" />}
                                </div>
                                <div className="accionTexto">
                                    <span className="accionTitulo">Notificaciones del navegador</span>
                                    <span className="accionDesc">
                                        {notifPerm === 'granted'  && 'Activas — recibirás avisos del sistema.'}
                                        {notifPerm === 'denied'   && 'Bloqueadas — habilítalas desde la configuración del sitio en el navegador.'}
                                        {notifPerm === 'default'  && 'Permite que el sistema te avise de eventos importantes.'}
                                        {notifPerm === 'unsupported' && 'Este navegador no soporta notificaciones.'}
                                    </span>
                                </div>
                                <span className="accionCta">
                                    {notifPerm === 'granted' ? 'Activas' : notifPerm === 'denied' || notifPerm === 'unsupported' ? '—' : 'Activar'}
                                </span>
                            </button>

                            <button type="button" className="accionItem" onClick={handleReload}>
                                <div className="accionIcono"><RefreshCcw size={18} color="#2563EB" /></div>
                                <div className="accionTexto">
                                    <span className="accionTitulo">Recargar el panel</span>
                                    <span className="accionDesc">Vuelve a cargar la aplicación desde cero.</span>
                                </div>
                                <span className="accionCta">Recargar</span>
                            </button>

                            <button type="button" className="accionItem accionItem--peligro" onClick={handleClearCache}>
                                <div className="accionIcono"><Trash2 size={18} color="#DC2626" /></div>
                                <div className="accionTexto">
                                    <span className="accionTitulo">Limpiar caché local</span>
                                    <span className="accionDesc">Borra preferencias guardadas en este navegador. No afecta tu cuenta.</span>
                                </div>
                                <span className="accionCta accionCta--peligro">Limpiar</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Soporte Dedicado ── */}
                <div className="tarjetaConfiguracion fullWidth cardSoporteDedicado">
                    <div className="soporteImagenWrap">
                        <img src={SupportImage} alt="Equipo de Soporte SafeRide" />
                    </div>
                    <div className="soporteContenido">
                        <h2>Soporte Dedicado al Staff</h2>
                        <p>Nuestra misión principal es asegurar que cada empleado tenga un viaje seguro y libre de estrés. Si necesitas ayuda con integraciones avanzadas del sistema, nuestro equipo de soporte interno está disponible de 8 AM a 6 PM de Lunes a Viernes.</p>
                        <div className="contactoSoporteList">
                            <div className="contactoItem">
                                <Mail size={18} />
                                <span>saferidefwd@gmail.com</span>
                            </div>
                            <div className="contactoItem">
                                <Phone size={18} />
                                <span>71041281</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Configuracion;
