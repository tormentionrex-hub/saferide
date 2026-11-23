import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import Swal from 'sweetalert2';
import { toast, Toaster } from 'react-hot-toast';
import {
    Users, Car, Calendar, AlertCircle, ShieldCheck, BellOff,
    ArrowUpRight, ArrowDownRight, ChevronDown, Zap
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import './Dashboard.css';
import DefaultImageUser from '../../imgs/DefaultImageUser.png';
import { useAdminPref } from '../../hooks/useAdminPref';
import { useMonthlyGoal } from '../../hooks/useMonthlyGoal';

// ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────────────────────────


// ────────────── Función para imagen por defecto de Cloudinary ────────────────────────
const getDefaultImagen = (url) => (url && url.trim() !== '') ? url : DefaultImageUser;
const formatearFecha = (valor) => (valor ? new Date(valor).toLocaleDateString('es-CR') : '—');

const CACHE_METRICAS = 'saferide.dashboard.metricas';
const CACHE_RESERVAS = 'saferide.dashboard.reservas';
const CACHE_ALERTAS = 'saferide.dashboard.alertas';

const leerCache = (clave, fallback) => {
    if (typeof window === 'undefined') return fallback;
    try {
        const raw = window.localStorage.getItem(clave);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
};

const guardarCache = (clave, valor) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(clave, JSON.stringify(valor));
    } catch {
        return;
    }
};

const ETIQUETAS_METODO_PAGO = {
    cash: 'Efectivo',
    sinpe: 'SINPE',
    paypal: 'PayPal',
    card: 'Tarjeta',
    google_pay: 'Google Pay',
    apple_pay: 'Apple Pay',
    sin_method: 'Sin método',
};

// ────────────── Tarjeta de estadísticas con iconos ───────────────────────────────────
const TarjetaEstadistica = React.memo(({ icon, title, value, change, isPositive, subtitle, loading }) => (
    <div className="tarjetaEstadistica">
        {loading ? (
            <div className="skeleton-pulse" style={{ height: '100%', width: '100%', borderRadius: '16px', background: '#f1f5f9' }} />
        ) : (
            <>
                <div className="estadisticaHeader">
                    <div className="estadisticaIcono">{icon}</div>
                    <div className="estadisticaValor" style={{ color: '#0F172A' }}>{value ?? '—'}</div>
                </div>
                <div className="estadisticaTitulo">{title}</div>
                <div className="estadisticaFooter">
                    <span className={"estadisticaCambio " + (isPositive ? 'positive' : 'negative')}>
                        {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {change}
                    </span>
                    <span className="estadisticaSubtitulo">{subtitle}</span>
                </div>
            </>
        )}
    </div>
));


// ──────────────────────────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────────


const Dashboard = () => {
    const navigate = useNavigate();
    const [metricas, setMetricas] = useState(() => leerCache(CACHE_METRICAS, {}));
    const [vehiculos, setVehiculos] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [reservasPorDia, setReservasPorDia] = useState(() => leerCache(CACHE_RESERVAS, {}));
    const [rangoReservas, setRangoReservas] = useState(7);
    const [loading, setLoading] = useState(true);
    const [alertasSOS, setAlertasSOS] = useState(() => leerCache(CACHE_ALERTAS, []));
    const alertasEnabled = useAdminPref('alertasEmergencia', true);
    const { goal: metaCarbono } = useMonthlyGoal();

    useEffect(() => {
        const CargarDatos = async () => {
            try {
                const [metricasRes, vehiculosRes, usuariosRes, quejasRes] = await Promise.all([
                    api.get('/metrics/global').catch(() => ({ data: { data: null } })),
                    api.get('/vehicles?limit=5').catch(() => ({ data: { data: [] } })),
                    api.get('/users?limit=5').catch(() => ({ data: { data: [] } })),
                    api.get('/complaints?status=Pendiente&category=Seguridad&limit=5').catch(() => ({ data: { data: null } })),
                ]);

                const datosGlobales = metricasRes.data?.data;
                if (datosGlobales) {
                    setMetricas(datosGlobales);
                    guardarCache(CACHE_METRICAS, datosGlobales);
                }
                setVehiculos(vehiculosRes.data?.data?.docs || vehiculosRes.data?.data || []);
                setUsuarios(usuariosRes.data?.data || usuariosRes.data?.data?.docs || []);

                const quejas = quejasRes.data?.data;
                if (Array.isArray(quejas)) {
                    const alertas = quejas.map((q) => {
                        const minutos = Math.max(0, Math.floor((Date.now() - new Date(q.createdAt).getTime()) / 60000));
                        const tiempo = minutos < 60 ? `Hace ${minutos} min` : `Hace ${Math.floor(minutos / 60)} hr`;
                        return {
                            id: q._id,
                            tipo: q.category === 'Seguridad' ? 'critica' : 'advertencia',
                            titulo: q.subject,
                            descripcion: q.fullMessage || q.message || '',
                            tiempo,
                            atendida: false,
                        };
                    });
                    guardarCache(CACHE_ALERTAS, alertas);
                    setAlertasSOS(alertas);
                }

                setLoading(false);
            } catch (error) {
                console.error("Error al cargar datos del Panel:", error);
                setLoading(false);
            }
        };
        CargarDatos();
    }, []);

    useEffect(() => {
        let activo = true;
        api.get(`/metrics/bookings-by-day?days=${rangoReservas}`)
            .then((res) => {
                const datos = res.data?.data;
                if (!activo || !Array.isArray(datos)) return;
                const anterior = leerCache(CACHE_RESERVAS, {});
                const siguiente = { ...anterior, [rangoReservas]: datos };
                guardarCache(CACHE_RESERVAS, siguiente);
                setReservasPorDia(siguiente);
            })
            .catch(() => {});
        return () => { activo = false; };
    }, [rangoReservas]);

    const datosReservas = reservasPorDia[rangoReservas] || [];

    const handleAtenderAlerta = async (alerta) => {
        const result = await Swal.fire({
            title: '¿Atender esta alerta?',
            text: `${alerta.titulo} — ${alerta.descripcion}`,
            icon: alerta.tipo === 'critica' ? 'warning' : 'info',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonColor: '#10B981',
            denyButtonColor: '#3B82F6',
            cancelButtonColor: '#94A3B8',
            confirmButtonText: '✓ Marcar como atendida',
            denyButtonText: '↗ Ir a Quejas',
            cancelButtonText: 'Cancelar',
        });

        if (result.isConfirmed) {
            try {
                await api.patch(`/complaints/${alerta.id}/resolve`);
                setAlertasSOS(prev => {
                    const restantes = prev.filter(a => a.id !== alerta.id);
                    guardarCache(CACHE_ALERTAS, restantes);
                    return restantes;
                });
                toast.success(`Alerta "${alerta.titulo}" marcada como atendida`, {
                    duration: 3000,
                    icon: '✅',
                    style: { background: '#ECFDF5', color: '#065F46', border: '1px solid #6EE7B7' }
                });
            } catch (error) {
                console.error('Error al atender la queja:', error);
                toast.error('No se pudo actualizar la queja');
            }
        } else if (result.isDenied) {
            navigate('/quejas');
        }
    };

    const totalUsuarios = Number(metricas.totalUsers) || 0;
    const totalConductores = Number(metricas.totalDrivers) || 0;
    const totalAdmins = Number(metricas.totalAdmins) || 0;
    const totalPasajeros = Number(metricas.totalPassengers) || 0;
    const totalRoles = totalPasajeros + totalConductores + totalAdmins;

    const pieDataRoles = useMemo(() => [
        { name: 'Pasajeros',   value: totalPasajeros,   color: '#3B82F6' },
        { name: 'Conductores', value: totalConductores, color: '#10B981' },
        { name: 'Moderadores', value: totalAdmins,      color: '#8B5CF6' },
    ], [totalPasajeros, totalConductores, totalAdmins]);

    const pagos = useMemo(() => metricas.payments || {}, [metricas.payments]);
    const metodosPago = useMemo(() => metricas.paymentMethods || {}, [metricas.paymentMethods]);
    const pieDataPagos = useMemo(() => {
        const datos = [
            { name: 'Pagados',    value: Number(pagos.paid) || 0,    color: '#10B981' },
            { name: 'Pendientes', value: Number(pagos.pending) || 0, color: '#F59E0B' },
            { name: 'Eximidos',   value: Number(pagos.waived) || 0,  color: '#EF4444' },
        ];
        if (Number(pagos.other) > 0) datos.push({ name: 'Otros', value: Number(pagos.other), color: '#94A3B8' });
        return datos;
    }, [pagos]);
    const totalPagos = Number(pagos.total) || pieDataPagos.reduce((suma, item) => suma + item.value, 0);


    const fechaActual = new Date().toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' });
    const carbonoActual = Number(metricas.monthlyCarbonSaved) || 0;
    const metaCarbonoNumero = Number(metaCarbono) > 0 ? Number(metaCarbono) : 200;
    const progresoCarbono = Math.min(100, Math.round((carbonoActual / metaCarbonoNumero) * 100));
    const carbonoFaltante = Math.max(0, metaCarbonoNumero - carbonoActual).toFixed(1);



    // ===================================================================
    // DASHBOARD PRINCIPAL
    // ===================================================================
    return (
        <>
            <Toaster position="top-right" />
            <div className="TituloPagina">

                    <div>
                        <h1>Panel Principal</h1>
                        <p>Resumen general de SafeRide</p>
                    </div>
                    <div className="botonFecha">
                        <Calendar size={16} />
                        <span>{fechaActual}</span>
                        <ChevronDown size={14} />
                    </div>
                </div>


                {/*  1. ESTADISTICAS PRINCIPALES */}
                <div className="graficosGrid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    <TarjetaEstadistica loading={loading} icon={<Users size={20} className="color-purple" />} title="Usuarios Totales" value={metricas.totalUsers != null ? metricas.totalUsers.toLocaleString() : null} change="—" isPositive={true} subtitle="Datos reales" />
                    <TarjetaEstadistica loading={loading} icon={<Calendar size={20} className="color-blue" />} title="Viajes Completados" value={metricas.totalRides != null ? metricas.totalRides.toLocaleString() : null} change="—" isPositive={true} subtitle="Datos reales" />
                    <TarjetaEstadistica loading={loading} icon={<Car size={20} className="color-yellow" />} title="KM Totales" value={metricas.totalKilometers != null ? `${metricas.totalKilometers.toLocaleString()} km` : null} change="—" isPositive={true} subtitle="Datos reales" />
                    <TarjetaEstadistica loading={loading} icon={<AlertCircle size={20} className="color-green" />} title="Carbono Ahorrado" value={metricas.totalCarbonSaved != null ? `${metricas.totalCarbonSaved.toFixed(1)} kg` : null} change="—" isPositive={true} subtitle="Datos reales" />
                </div>


                {/*  2. GRAFICOS  */}
                <div className="graficoGrid">

                    <div className="graficos graficoFilaCompleta">

                        <div className="graficoHeader">

                            <h3>Reservas por día</h3>

                            <div className="selectorMini">
                                <select value={rangoReservas} onChange={(e) => setRangoReservas(Number(e.target.value))} aria-label="Periodo de reservas por día">
                                    <option value={7}>Últimos 7 días</option>
                                    <option value={14}>Últimas 2 semanas</option>
                                    <option value={21}>Últimas 3 semanas</option>
                                </select>
                                <ChevronDown size={14} />
                            </div>
                        </div>

                        <div className="graficoBody">

                            <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={0}>

                                <LineChart data={datosReservas} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>

                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />

                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} dy={10} />

                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />

                                    <Tooltip />
                                    <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="graficos">

                        <div className="graficoHeader">
                            <h3>Distribución de pagos</h3>
                        </div>

                        <div className="graficoBody contenedorTorta">

                            <div className="envolturaTorta">

                                <ResponsiveContainer width="100%" height={180} minWidth={0} minHeight={0}>

                                    <PieChart>

                                        <Pie data={pieDataPagos} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                                            {pieDataPagos.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>

                                <div className="textoCentroTorta">

                                    <span className="etiquetaTotal" style={{ color: '#64748B' }}>Total</span>

                                    <span className="valorTotal" style={{ color: '#0F172A' }}>{totalPagos.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="leyendaTorta">

                                {pieDataPagos.map((item, i) => (

                                    <div key={i} className="elementoLeyenda">

                                        <div className="indicadorLeyenda" style={{ backgroundColor: item.color }}></div>

                                        <div className="detallesLeyenda">

                                            <span className="nombreLeyenda" style={{ color: '#475569' }}>{item.name}</span>
                                            <span className="valorLeyenda" style={{ color: '#0F172A' }}>{item.value.toLocaleString()} <span className="porcentajeLeyenda" style={{ color: '#94A3B8' }}>({totalPagos > 0 ? ((item.value / totalPagos) * 100).toFixed(1) : '0.0'}%)</span></span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="metodosPago">
                                <span className="etiquetaMetodos">Formas de pago</span>
                                {Object.entries(metodosPago).map(([metodo, cantidad]) => (
                                    <span key={metodo} className="metodoPagoItem">{ETIQUETAS_METODO_PAGO[metodo] || metodo}: {cantidad.toLocaleString()}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="graficos">

                        <div className="graficoHeader">

                            <h3>Usuarios por rol</h3>
                        </div>

                        <div className="graficoBody contenedorTorta">

                            <div className="envolturaTorta">

                                <ResponsiveContainer width="100%" height={180} minWidth={0} minHeight={0}>

                                    <PieChart>

                                        <Pie data={pieDataRoles} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                                            {pieDataRoles.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>

                                <div className="textoCentroTorta">

                                    <span className="valorTotal" style={{ color: '#0F172A' }}>{totalUsuarios.toLocaleString()}</span>
                                    <span className="etiquetaTotal" style={{ color: '#64748B' }}>Total</span>
                                </div>
                            </div>

                            <div className="leyendaTorta">

                                {pieDataRoles.map((item, i) => (

                                    <div key={i} className="elementoLeyenda">

                                        <div className="indicadorLeyenda" style={{ backgroundColor: item.color }}></div>

                                        <div className="detallesLeyenda">

                                            <span className="nombreLeyenda" style={{ color: '#475569' }}>{item.name}</span>
                                            <span className="valorLeyenda" style={{ color: '#0F172A' }}>{item.value.toLocaleString()} <span className="porcentajeLeyenda" style={{ color: '#94A3B8' }}>({totalRoles > 0 ? ((item.value / totalRoles) * 100).toFixed(1) : '0.0'}%)</span></span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. ALERTAS Y METAS */}
                <div className="graficoGrid">
                    <div id="panelAlertasCriticas" className="graficos tarjetaAlertas">
                        <div className="graficoHeader">
                            <div className="tituloConIcono">
                                <AlertCircle size={20} className="color-red" />
                                <h3>Alertas de Seguridad (SOS)</h3>
                                <span className="contadorAlertas">{alertasSOS.length}</span>
                            </div>
                            <Link to="/quejas" className="botonVerTodos" style={{fontSize:'12px'}}>Ver quejas</Link>
                        </div>
                        <div className="cuerpoAlertas">
                            {!alertasEnabled ? (
                                <div style={{ textAlign: 'center', padding: '24px 0', color: '#94A3B8' }}>
                                    <BellOff size={32} style={{ marginBottom: '8px', opacity: 0.6 }} />
                                    <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Alertas de emergencia desactivadas</p>
                                    <p style={{ fontSize: '0.78rem' }}>Actívalas desde tu perfil para verlas aquí</p>
                                </div>
                            ) : alertasSOS.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '24px 0', color: '#10B981' }}>
                                    <ShieldCheck size={32} style={{ marginBottom: '8px', opacity: 0.7 }} />
                                    <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Sin alertas activas</p>
                                    <p style={{ fontSize: '0.78rem', color: '#94A3B8' }}>Todo en orden</p>
                                </div>
                            ) : (
                                alertasSOS.map((alerta) => (
                                    <div key={alerta.id} className={`alertaItem ${alerta.tipo}`}>
                                        <div className="alertaIcono">
                                            {alerta.tipo === 'critica' ? <Zap size={16} /> : <AlertCircle size={16} />}
                                        </div>
                                        <div className="alertaInfo">
                                            <h4>{alerta.titulo}</h4>
                                            <p>{alerta.descripcion}</p>
                                            <span className="tiempoAlerta">{alerta.tiempo}</span>
                                        </div>
                                        {alerta.tipo === 'critica' && (
                                            <button
                                                className="botonAtender"
                                                onClick={() => handleAtenderAlerta(alerta)}
                                            >
                                                Atender
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div id="panelMetasVerdes" className="graficos tarjetaMetas">
                        <div className="graficoHeader">
                            <div className="tituloConIcono">
                                <ShieldCheck size={20} className="color-green" />
                                <h3>Meta Mensual SafeRide</h3>
                            </div>
                        </div>
                        <div className="cuerpoMeta">
                            <div className="progresoMeta">
                                <div className="barraProgreso">
                                    <div className="progresoLleno" style={{ width: `${progresoCarbono}%` }}></div>
                                </div>
                                <span className="porcentajeMeta">{progresoCarbono}%</span>
                            </div>
                            <p className="descripcionMeta">Este mes: <strong>{carbonoActual.toFixed(1)} kg</strong> de {metaCarbonoNumero} kg. {Number(carbonoFaltante) > 0 ? `Faltan ${carbonoFaltante} kg de CO₂.` : '¡Meta alcanzada!'}</p>
                        </div>
                    </div>
                </div>

                <div className="cuadriculaListas">

                    <div className="tarjetaLista">

                        <div className="encabezadoLista">

                            <h3>Vehículos registrados</h3>

                            <Link to="/vehiculos" className='botonVerTodos'><span>Ver todos</span></Link>
                        </div>

                        <div className="cuerpoLista">

                            {vehiculos.slice(0, 4).map((item, i) => (

                                <div className="filaElemento" key={item._id || i}>

                                    <div className="avatarIcono">
                                        <Car size={20} className="color-blue" />
                                    </div>

                                    <div className="infoElemento">

                                        <div className="tituloElemento fuenteNegrita">{item.brand} {item.model}</div>
                                        <div className="descripcionElemento textoGris">
                                            {item.license_plate} &bull; {item.color} &bull; {item.year}
                                        </div>
                                    </div>

                                    <div className="estadoElemento">
                                        <span className={`insigniaEstado ${item.isActive ? 'status-green' : 'status-red'}`}>
                                            {item.isActive ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </div>

                                    <div className="precioElemento">
                                        <div className="valorPrecio">{item.capacity} <span className="textoGris" style={{fontSize:'11px'}}>asientos</span></div>
                                        <div className="tiempoPrecio">{formatearFecha(item.createdAt)}</div>
                                    </div>
                                </div>
                            ))}
                            {vehiculos.length === 0 && <div className="textoGris">No hay vehículos registrados</div>}

                        </div>
                    </div>

                    <div className="tarjetaLista">

                        <div className="encabezadoLista">

                            <h3>Usuarios recientes</h3>

                            <Link to="/usuarios" className='botonVerTodos'><span>Ver todas</span></Link>
                        </div>

                        <div className="cuerpoLista">

                            {usuarios.slice(0, 4).map((item, i) => (

                                <div className="filaElemento" key={item._id || i}>

                                    <img src={getDefaultImagen(item.profileImage)} alt={item.name} className="avatarPequeno" />

                                    <div className="infoElemento">

                                        <div className="tituloElemento fuenteNegrita">{item.name}</div>
                                        <div className="descripcionElemento textoGris">{item.email}</div>
                                    </div>

                                    <div className="prioridadElemento">

                                        <span className={`textoPrioridad prioridadBaja`}>{item.type}</span>
                                    </div>

                                    <div className="tiempoElemento textoGris textoChico">

                                        {formatearFecha(item.createdAt)}
                                    </div>
                                </div>
                            ))}
                            {usuarios.length === 0 && <div className="textoGris">No hay usuarios recientes</div>}
                        </div>
                    </div>
                </div>
            </>
    );
};

export default Dashboard;
