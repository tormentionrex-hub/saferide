import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { InsertarEnCloudinary } from '../../services/cloudinary';
import DefaultImageUser from '../../imgs/DefaultImageUser.png';
import api from '../../services/api';
import passengerService from '../../services/passengerService';
import COMPANIES from '../../constants/companies';
import { Link } from 'react-router-dom';

// DISEÑOS E ICONOS
import {
    User, FileUser, Mail, Building2, Check, Users,
    ArrowLeft, Camera, X, Phone, Car, Leaf, MapPin,
    Bell, AlertTriangle, Activity, Send,
    Shield, KeyRound, LogOut, Smartphone
} from 'lucide-react';
import './PerfilAdmin.css';
import Swal from 'sweetalert2';

// Clave de localStorage para las preferencias del admin.
const PREFS_STORAGE_KEY = 'saferide-admin-prefs';
const DEFAULT_PREFS = {
    alertasEmergencia: true,
    reportesDiarios: true,
    monitoreoTiempoReal: false,
    notificacionesEmail: true,
};
const loadPrefs = () => {
    try {
        const raw = localStorage.getItem(PREFS_STORAGE_KEY);
        return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
    } catch {
        return DEFAULT_PREFS;
    }
};

const PREF_ITEMS = [
    { key: 'alertasEmergencia',   icon: AlertTriangle, label: 'Alertas de emergencia',     desc: 'Muestra el panel de alertas SOS en el Dashboard.' },
    { key: 'reportesDiarios',     icon: Send,          label: 'Reportes diarios',          desc: 'Resumen automático al final de cada día por correo.' },
    { key: 'monitoreoTiempoReal', icon: Activity,      label: 'Monitoreo en tiempo real',  desc: 'Notificaciones push de cada viaje en curso.' },
    { key: 'notificacionesEmail', icon: Bell,          label: 'Notificaciones por email',  desc: 'Cualquier evento relevante llega a tu correo.' },
];

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// COMPONENTE: PERFIL DE ADMINISTRADOR
// ────────────────────────────────────────────────────────────────────────────────────────────────────

const PerfilAdmin = () => {
    const { user, setUser, cerrarSesion } = useAuth();
    // Default: lista hardcodeada de empresas conocidas. Si el endpoint
    // /users/companies responde con más, las mergeamos (dedup).
    const [empresas, setEmpresas] = useState(COMPANIES);
    const [cargando, setCargando] = useState(false);
    const [EditActivo, setEditActivo] = useState(false);
    const [nuevaFoto, setNuevaFoto] = useState(null);
    const [previewFoto, setPreviewFoto] = useState(null);
    // Métricas globales (null mientras no se hayan cargado, para distinguir
    // "todavía no respondió el backend" de "el backend devolvió 0").
    const [estadisticas, setEstadisticas] = useState(null);
    // Conteo real de pasajeros registrados (no viene en /metrics/global).
    const [totalPassengers, setTotalPassengers] = useState(null);

    // Estado para los datos del perfil
    const [datosPerfil, setDatosPerfil] = useState({
        name: '',
        username: '',
        email: '',
        phone: '',
        company: '',
        status: ''
    });

    // Preferencias persistidas en localStorage.
    const [ajustes, setAjustes] = useState(loadPrefs);

    useEffect(() => {
        if (user) {
            setDatosPerfil({
                name: user.name || '',
                username: user.username || '',
                email: user.email || '',
                phone: user.phone ? `${String(user.phone).slice(0, 4)}-${String(user.phone).slice(4, 8)}` : '',
                company: user.company || '',
                status: user.isActive || ''
            });
            setPreviewFoto(user.profileImage || DefaultImageUser);
        }
    }, [user]);

    useEffect(() => {
        api.get('/users/companies')
            .then(res => {
                const raw = Array.isArray(res.data?.data) ? res.data.data : [];
                // Acepta strings o { name }. Filtra vacíos y mergea con la lista base.
                const fromApi = raw
                    .map(x => (typeof x === 'string' ? x : x?.name))
                    .filter(Boolean);
                if (fromApi.length > 0) {
                    setEmpresas([...new Set([...COMPANIES, ...fromApi])]);
                }
            })
            .catch(() => { /* sin endpoint: queda la lista hardcodeada */ });

        api.get('/metrics/global')
            .then(res => {
                if (res.data.success && res.data.data) {
                    setEstadisticas(res.data.data);
                }
            })
            .catch(err => console.error("Error al cargar estadísticas:", err));

        // Pasajeros registrados: traemos la primera página con limit=1 y leemos
        // el total de la paginación. Más barato que pedir el listado completo.
        passengerService.getAllPassengers({ page: 1, limit: 1 })
            .then(res => {
                const t = res?.stats?.total ?? res?.pagination?.total ?? null;
                setTotalPassengers(typeof t === 'number' ? t : null);
            })
            .catch(err => console.error("Error al cargar conteo de pasajeros:", err));
    }, []);

    // Formateador para las cards de estadísticas: muestra '—' si el valor es
    // null/undefined (no hay datos aún) y formatea el número si existe.
    const fmtStat = (val, { decimals = 0, locale = true } = {}) => {
        if (val === null || val === undefined) return '—';
        const num = Number(val);
        if (Number.isNaN(num)) return '—';
        return locale ? num.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals }) : num.toFixed(decimals);
    };

    // Persistencia de preferencias + aviso a otros componentes de la misma tab
    // (el evento 'storage' nativo solo dispara en otras tabs).
    useEffect(() => {
        try {
            localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(ajustes));
            window.dispatchEvent(new CustomEvent('saferide-prefs-changed'));
        } catch { /* sin storage */ }
    }, [ajustes]);

    const manejarSeleccionFoto = (e) => {
        const file = e.target.files[0];
        if (file) {
            setNuevaFoto(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewFoto(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const manejarCambioPerfil = (e) => {
        const { name, value } = e.target;

        if (name === 'phone') {
            // Eliminar cualquier caracter que no sea dígito
            const soloNumeros = value.replace(/\D/g, '');
            let valorFormateado = soloNumeros;

            // Aplicar formato 0000-0000
            if (soloNumeros.length > 4) {
                valorFormateado = `${soloNumeros.slice(0, 4)}-${soloNumeros.slice(4, 8)}`;
            }

            setDatosPerfil({
                ...datosPerfil,
                [name]: valorFormateado
            });
        } else {
            setDatosPerfil({
                ...datosPerfil,
                [name]: value
            });
        }
    };

    // -----------------------------------------------
    const toggleAjuste = (key) => {
        setAjustes({
            ...ajustes,
            [key]: !ajustes[key]
        });
    };
    // -----------------------------------------------

    const guardarCambios = async () => {
        setCargando(true);

        try {
            let profileImageUrl = user.profileImage;

            // ───────────────── VALIDACIONES PREVIAS ─────────────────
            // Validar si hubo algún cambio real
            const phoneVal = user.phone ? `${String(user.phone).slice(0, 4)}-${String(user.phone).slice(4, 8)}` : '';
            if (datosPerfil.name === user.name && datosPerfil.phone === phoneVal && datosPerfil.company === (user.company || '') && !nuevaFoto) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Sin Cambios',
                    text: 'No se han realizado cambios en el perfil.',
                    confirmButtonText: 'De acuerdo',
                    confirmButtonColor: '#2563EB'
                });
                setCargando(false);
                return;
            }

            if (datosPerfil.name.trim() === '') {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'El nombre no puede estar vacío',
                    confirmButtonText: 'De acuerdo',
                    confirmButtonColor: '#2563EB'
                });
                setCargando(false);
                return;
            }

            if (!/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s.\-']+$/.test(datosPerfil.name)) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'El nombre solo puede contener letras.',
                    confirmButtonText: 'De acuerdo',
                    confirmButtonColor: '#2563EB'
                });
                setCargando(false);
                return;
            }

            const phoneLimpio = (datosPerfil.phone || '').replace(/-/g, '');
            if (phoneLimpio && !/^\d+$/.test(phoneLimpio)) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'El teléfono solo puede contener números.',
                    confirmButtonText: 'De acuerdo',
                    confirmButtonColor: '#2563EB'
                });
                setCargando(false);
                return;
            }

            // 1. Subir a Cloudinary si hay una nueva foto
            if (nuevaFoto) {
                profileImageUrl = await InsertarEnCloudinary(nuevaFoto);
            }

            // 2. Guardar en el backend (Limpiamos el teléfono de guiones antes de enviar)
            const datosParaEnviar = {
                name: datosPerfil.name,
                profileImage: profileImageUrl
            };
            
            // Solo enviar phone si tiene valor válido (8 dígitos)
            if (phoneLimpio && /^\d{8}$/.test(phoneLimpio)) {
                datosParaEnviar.phone = phoneLimpio;
            }
            // Solo enviar company si tiene valor
            if (datosPerfil.company && datosPerfil.company.trim() !== '') {
                datosParaEnviar.company = datosPerfil.company;
            }

            const response = await api.put('/users/profile', datosParaEnviar);

            if (response.data.success) {

                if (setUser) setUser(response.data.data);

                Swal.fire({
                    icon: 'success',
                    title: '¡Actualizado!',
                    text: 'Tu perfil se ha actualizado correctamente.',
                    timer: 2000,
                    showConfirmButton: false,
                    background: '#ffffff',
                    color: '#0F172A',
                    iconColor: '#2563EB'
                });
                setEditActivo(false);
                setNuevaFoto(null);
            }
        } catch (error) {
            console.error('Error al guardar cambios:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'No se pudieron guardar los cambios',
                confirmButtonColor: '#2563EB'
            });
        } finally {
            setCargando(false);
        }
    };

    // ─── Seguridad ─────────────────────────────────────────
    const handleCambiarPassword = async () => {
        const { value: pwds } = await Swal.fire({
            title: 'Cambiar contraseña',
            html: `
                <input id="cur-pwd" type="password" placeholder="Contraseña actual"  class="swal2-input" autocomplete="current-password" />
                <input id="new-pwd" type="password" placeholder="Nueva contraseña"     class="swal2-input" autocomplete="new-password" />
                <input id="cnf-pwd" type="password" placeholder="Confirmar nueva"      class="swal2-input" autocomplete="new-password" />
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Cambiar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#2563EB',
            cancelButtonColor: '#64748B',
            preConfirm: () => {
                const cur = document.getElementById('cur-pwd').value;
                const nu  = document.getElementById('new-pwd').value;
                const cnf = document.getElementById('cnf-pwd').value;
                if (!cur || !nu || !cnf)  { Swal.showValidationMessage('Todos los campos son obligatorios'); return false; }
                if (nu.length < 8)        { Swal.showValidationMessage('La nueva contraseña debe tener al menos 8 caracteres'); return false; }
                if (nu === cur)           { Swal.showValidationMessage('La nueva contraseña debe ser distinta a la actual'); return false; }
                if (nu !== cnf)           { Swal.showValidationMessage('Las contraseñas no coinciden'); return false; }
                return { currentPassword: cur, newPassword: nu };
            },
        });
        if (!pwds) return;
        try {
            await api.patch('/auth/change-password', pwds);
            Swal.fire({ icon: 'success', title: 'Contraseña actualizada', timer: 2000, showConfirmButton: false });
        } catch (err) {
            const msg = err.response?.status === 404
                ? 'El endpoint /auth/change-password todavía no existe en el backend.'
                : (err.response?.data?.message || err.message);
            Swal.fire({ icon: 'error', title: 'No se pudo cambiar', text: msg, confirmButtonColor: '#EF4444' });
        }
    };

    const handleCerrarSesionTodos = async () => {
        const r = await Swal.fire({
            icon: 'warning',
            title: '¿Cerrar todas las sesiones?',
            text: 'Tu sesión se cerrará en todos los dispositivos. Tendrás que volver a iniciar sesión aquí también.',
            showCancelButton: true,
            confirmButtonText: 'Sí, cerrar todo',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#EF4444',
            cancelButtonColor: '#64748B',
        });
        if (!r.isConfirmed) return;
        try {
            await api.post('/auth/logout-all');
            cerrarSesion();
        } catch (err) {
            const msg = err.response?.status === 404
                ? 'El endpoint /auth/logout-all todavía no existe en el backend.'
                : (err.response?.data?.message || err.message);
            Swal.fire({ icon: 'error', title: 'No se pudo cerrar todas las sesiones', text: msg, confirmButtonColor: '#EF4444' });
        }
    };

    const handleCerrarSesion = async () => {
        const r = await Swal.fire({
            icon: 'question',
            title: '¿Cerrar sesión?',
            text: 'Volverás a la pantalla de inicio de sesión.',
            showCancelButton: true,
            confirmButtonText: 'Sí, cerrar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#2563EB',
            cancelButtonColor: '#64748B',
        });
        if (!r.isConfirmed) return;
        cerrarSesion();
    };

    if (!user) return <div className="contenedorPerfil">Cargando...</div>;


    // ─────────────────────────────────────────────────────────────────────────────────────────────────
    // ────────────────────────────────────────────

    /* ==================================================
    *  INFORMACIÓN DEL USUARIO
    *  ================================================== */

    return (
        <div className="contenedorPerfil">

            {/* ENLACE PARA REGRESAR AL PANEL */}
            <Link to="/inicio" className="enlaceVolver">
                <ArrowLeft size={18} />
                Volver al Panel
            </Link>

            {/* INFORMACIÓN DEL USUARIO */}
            <div className="tarjetaPrincipal">

                <div className="contenedorIzquierdo">

                    <div className="contenedorUser">
                        <img
                            src={user.profileImage || DefaultImageUser}
                            alt="Avatar"
                            className="imagenUser"
                        />
                        <div className="checkVerificado">
                            <Check size={14} />
                        </div>
                    </div>

                    <div className="conteinerInfo">

                        <h1 id="nombreAdmin">
                            {datosPerfil.name}
                            {datosPerfil.status === false ? (
                                <span className="insigniaEstado" style={{ background: '#ffcbcbff', color: '#832e2eff' }}>Inactivo</span>
                            ) : (
                                <span className="insigniaEstado" style={{ background: '#cbffddff', color: '#2e834eff' }}>Activo</span>
                            )}
                        </h1>

                        <p className="PuestoAdmin">Administrador Senior</p>

                        <div className="DetallesInfo">

                            <div className="detalleItem">
                                <FileUser size={16} />
                                <span>{datosPerfil.username}</span>
                            </div>

                            <div className="detalleItem">
                                <Mail size={16} />
                                <span>{datosPerfil.email}</span>

                            </div>

                            <div className="detalleItem">
                                <Phone size={16} />
                                <span>{datosPerfil.phone || "Sin teléfono"}</span>
                            </div>
                            <div className="detalleItem">
                                <Building2 size={18} />
                                <span>{datosPerfil.company || "Sin empresa"}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => setEditActivo(true)}
                    className="botonEditPerfil"
                >
                    Editar Perfil
                </button>
            </div>

            {/* MODAL DE EDICIÓN */}
            {/* ─────────────────────────────────────────────────────────────── */}

            {EditActivo && (
                <div className="overlayModal" onClick={(e) => e.target.id === 'modalEdicion' && setEditActivo(false)}>

                    <div className="modalContenido">

                        <div className="encabezadoTarjeta">
                            <div>

                                <h2>Editar Perfil</h2>
                                <p>Actualiza tu información personal y foto de perfil</p>
                            </div>

                            <button onClick={() => setEditActivo(false)}>
                                <X size={24} />
                            </button>
                        </div>

                        <div className="contenidoTarjeta">

                            {/* Sección de Foto */}
                            <div className="seccionFotoModal">

                                <div className="contenedorFoto">

                                    <img
                                        src={previewFoto || DefaultImageUser}
                                        alt="Preview"
                                        className="foto"
                                    />
                                    <label htmlFor="inputFoto" className="btnCambiarFoto">
                                        <Camera size={18} />
                                        <input
                                            type="file"
                                            id="inputFoto"
                                            style={{ display: 'none' }}
                                            onChange={manejarSeleccionFoto}
                                            accept="image/jpeg, image/png, image/jpg, image/gif, image/webp, image/avif"
                                        />
                                    </label>
                                </div>

                                <p>Formatos permitidos: JPEG, JPG, PNG, GIF, WEBP, AVIF.</p>
                            </div>

                            {/* Campos del Formulario */}

                            <div className="contenedorUsername">

                                <div className="grupoInput">
                                    <label className="labelInput">Nombre de Usuario (no editable)</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            name="username"
                                            className="inputEstilizado"
                                            value={datosPerfil.username}
                                            readOnly
                                            style={{ paddingLeft: '40px', width: '100%', background: '#F1F5F9', color: '#64748B', cursor: 'not-allowed' }}
                                        />
                                        <FileUser size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: '#94A3B8' }} />
                                    </div>
                                </div>
                            </div>

                            <div className="cuadriculaCampos">

                                <div className="grupoInput">
                                    <label className="labelInput">Nombre Completo</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            name="name"
                                            className="inputEstilizado"
                                            value={datosPerfil.name}
                                            onChange={manejarCambioPerfil}
                                            style={{ paddingLeft: '40px', width: '100%' }}
                                        />
                                        <User size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: '#94A3B8' }} />
                                    </div>
                                </div>

                                <div className="grupoInput">
                                    <label className="labelInput">Teléfono</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            name="phone"
                                            className="inputEstilizado"
                                            value={datosPerfil.phone}
                                            onChange={manejarCambioPerfil}
                                            maxLength={9}
                                            placeholder="0000-0000"
                                            style={{ paddingLeft: '40px', width: '100%' }}
                                        />
                                        <Phone size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: '#94A3B8' }} />
                                    </div>
                                </div>

                                <div className="grupoInput">
                                    <label className="labelInput">Empresa</label>
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            name="company"
                                            className="inputEstilizado"
                                            value={datosPerfil.company}
                                            onChange={manejarCambioPerfil}
                                            style={{ paddingLeft: '40px', width: '100%', appearance: 'none', cursor: 'pointer' }}
                                        >
                                            <option value="">Sin empresa</option>
                                            {datosPerfil.company && !empresas.includes(datosPerfil.company) && (
                                                <option value={datosPerfil.company}>{datosPerfil.company} (actual)</option>
                                            )}
                                            {empresas.map(e => (
                                                <option key={e} value={e}>{e}</option>
                                            ))}
                                        </select>
                                        <Building2 size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: '#94A3B8', pointerEvents: 'none' }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pieTarjeta">
                            <button className="botonCancelar" onClick={() => setEditActivo(false)}>
                                Cancelar
                            </button>
                            <button className="botonGuardar" onClick={guardarCambios} disabled={cargando}>
                                {cargando ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* FILA DE ESTADÍSTICAS */}
            <div className="filaEstadisticas">

                <div className="tarjetaEstadistica">

                    <div className="estadisticaEncabezado">

                        <div className="iconoEstadistica"><MapPin size={20} /></div>
                    </div>

                    <p className="estadisticaEtiqueta">Viajes Corporativos</p>
                    <h3 className="estadisticaValor">{fmtStat(estadisticas?.totalRides)}</h3>
                </div>

                <div className="tarjetaEstadistica">

                    <div className="estadisticaEncabezado">

                        <div className="iconoEstadistica"><Car size={20} /></div>
                    </div>

                    <p className="estadisticaEtiqueta">Conductores Registrados</p>
                    <h3 className="estadisticaValor">{fmtStat(estadisticas?.totalDrivers)}</h3>
                </div>

                <div className="tarjetaEstadistica">

                    <div className="estadisticaEncabezado">

                        <div className="iconoEstadistica"><Users size={20} /></div>
                    </div>

                    <p className="estadisticaEtiqueta">Funcionarios Beneficiados</p>
                    <h3 className="estadisticaValor">{fmtStat(totalPassengers)}</h3>
                </div>

                <div className="tarjetaEstadistica">

                    <div className="estadisticaEncabezado">

                        <div className="iconoEstadistica" style={{ background: '#ecfdf5', color: '#10b981' }}><Leaf size={20} /></div>
                    </div>

                    <p className="estadisticaEtiqueta">CO₂ Ahorrado (kg)</p>
                    <h3 className="estadisticaValor">{fmtStat(estadisticas?.totalCarbonSaved, { decimals: 1 })}</h3>
                </div>
            </div>

            {/* ─── PREFERENCIAS ──────────────────────────────────── */}
            <section className="tarjetaConfig">
                <div className="tituloSeccion">
                    <Bell size={18} />
                    <div>
                        <h2>Preferencias de Notificación</h2>
                        <p>Controla qué tipo de alertas recibís y por qué medio.</p>
                    </div>
                </div>
                <div className="listaPreferencias">
                    {PREF_ITEMS.map(({ key, icon: Icon, label, desc }) => (
                        <div key={key} className="itemPreferencia">
                            <div className="iconoPreferencia"><Icon size={18} /></div>
                            <div className="textoPreferencia">
                                <span className="labelPreferencia">{label}</span>
                                <span className="descPreferencia">{desc}</span>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={ajustes[key]}
                                aria-label={label}
                                className={`switch ${ajustes[key] ? 'is-on' : ''}`}
                                onClick={() => toggleAjuste(key)}
                            />
                        </div>
                    ))}
                </div>
            </section>

            {/* ─── SEGURIDAD ─────────────────────────────────────── */}
            <section className="tarjetaConfig">
                <div className="tituloSeccion">
                    <Shield size={18} />
                    <div>
                        <h2>Seguridad</h2>
                        <p>Gestiona tu contraseña y las sesiones activas.</p>
                    </div>
                </div>
                <div className="listaSeguridad">
                    <button type="button" className="itemSeguridad" onClick={handleCambiarPassword}>
                        <div className="iconoSeguridad"><KeyRound size={18} /></div>
                        <div className="textoSeguridad">
                            <span className="labelSeguridad">Cambiar contraseña</span>
                            <span className="descSeguridad">Recomendamos hacerlo cada 90 días.</span>
                        </div>
                        <span className="ctaSeguridad">Cambiar</span>
                    </button>

                    <button type="button" className="itemSeguridad" onClick={handleCerrarSesionTodos}>
                        <div className="iconoSeguridad"><Smartphone size={18} /></div>
                        <div className="textoSeguridad">
                            <span className="labelSeguridad">Cerrar sesión en todos los dispositivos</span>
                            <span className="descSeguridad">Útil si perdiste un equipo o sospechás de acceso no autorizado.</span>
                        </div>
                        <span className="ctaSeguridad">Cerrar todo</span>
                    </button>

                    <button type="button" className="itemSeguridad itemSeguridad--danger" onClick={handleCerrarSesion}>
                        <div className="iconoSeguridad iconoSeguridad--danger"><LogOut size={18} /></div>
                        <div className="textoSeguridad">
                            <span className="labelSeguridad">Cerrar sesión aquí</span>
                            <span className="descSeguridad">Salir de la sesión actual en este navegador.</span>
                        </div>
                        <span className="ctaSeguridad ctaSeguridad--danger">Salir</span>
                    </button>
                </div>
            </section>

        </div>
    );
};

export default PerfilAdmin;
