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

// ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────────────────────────


// ────────────── Función para imagen por defecto de Cloudinary ────────────────────────
const getDefaultImagen = (url) => (url && url.trim() !== '') ? url : DefaultImageUser;

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
    const [metricas, setMetricas] = useState({});
    const [vehiculos, setVehiculos] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [totalAdmins, setTotalAdmins] = useState(0);
    const [payments, setPayments] = useState({ paid: 0, pending: 0, waived: 0 });
    const [bookingsList, setBookingsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [alertasSOS, setAlertasSOS] = useState([]);
    const alertasEnabled = useAdminPref('alertasEmergencia', true);

    useEffect(() => {
        const CargarDatos = async () => {
            try {
                const [metricasRes, vehiculosRes, usuariosRes, adminsRes, bookingsRes, quejasRes] = await Promise.all([
                    api.get('/metrics/global').catch(() => ({ data: { data: {} } })),
                    api.get('/vehicles?limit=5').catch(() => ({ data: { data: [] } })),
                    api.get('/users?limit=5').catch(() => ({ data: { data: [] } })),
                    api.get('/users?type=admin&limit=1').catch(() => ({ data: { pagination: { total: 0 } } })),
                    api.get('/bookings?limit=1000').catch(() => ({ data: { data: [] } })),
                    api.get('/complaints?status=Pendiente&limit=5').catch(() => ({ data: { data: [] } })),
                ]);

                setMetricas(metricasRes.data?.data || {});
                setVehiculos(vehiculosRes.data?.data?.docs || vehiculosRes.data?.data || []);
                setUsuarios(usuariosRes.data?.data || usuariosRes.data?.data?.docs || []);
                setTotalAdmins(adminsRes.data?.pagination?.total || 0);

                const bookings = bookingsRes.data?.data?.docs || bookingsRes.data?.data || [];
                setBookingsList(bookings);
                const paymentCounts = bookings.reduce((acc, b) => {
                    const s = b.payment_status;
                    if (s === 'paid' || s === 'pending' || s === 'waived') acc[s] += 1;
                    return acc;
                }, { paid: 0, pending: 0, waived: 0 });
                setPayments(paymentCounts);

                const quejas = quejasRes.data?.data || [];
                setAlertasSOS(quejas.map((q) => {
                    const minutes = Math.max(0, Math.floor((Date.now() - new Date(q.createdAt).getTime()) / 60000));
                    const tiempo = minutes < 60 ? `Hace ${minutes} min` : `Hace ${Math.floor(minutes / 60)} hr`;
                    return {
                        id: q._id,
                        tipo: q.category === 'Seguridad' ? 'critica' : 'advertencia',
                        titulo: q.subject,
                        descripcion: q.fullMessage || q.message || '',
                        tiempo,
                        atendida: false,
                    };
                }));

                setLoading(false);
            } catch (error) {
                console.error("Error al cargar datos del Panel:", error);
                setLoading(false);
            }
        };
        CargarDatos();
    }, []);

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
                setAlertasSOS(prev => prev.filter(a => a.id !== alerta.id));
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
    // Los pasajeros son el residuo: total activos − conductores − admins.
    // Antes se calculaba como total − conductores, lo que metía a los admins
    // dentro de "Pasajeros" y dejaba "Moderadores" siempre en 0 → caía al
    // fallback hardcodeado de 14.
    const totalPasajeros = Math.max(0, totalUsuarios - totalConductores - totalAdmins);
    const totalViajes = Number(metricas.totalRides) || 0;
    // Denominador real para el gráfico de roles: usa la suma de los tres
    // segmentos (no metricas.totalUsers) para garantizar que los % siempre
    // sumen 100, incluso si totalUsers viene con un valor inconsistente
    // (p.ej. drivers+admins+pasajeros calculado da 0 → evita NaN%).
    const totalRoles = totalPasajeros + totalConductores + totalAdmins;

    const pieDataRoles = useMemo(() => [
        { name: 'Pasajeros',   value: totalPasajeros,   color: '#3B82F6' },
        { name: 'Conductores', value: totalConductores, color: '#10B981' },
        { name: 'Moderadores', value: totalAdmins,      color: '#8B5CF6' },
    ], [totalPasajeros, totalConductores, totalAdmins]);

    // Backend usa payment_status ∈ {paid, pending, waived}. No existe 'failed'
    // como tal; mapeamos 'waived' (cortesía/exonerado) al slot rojo "Eximidos".
    const pieDataPagos = useMemo(() => [
        { name: 'Pagados',    value: payments.paid,    color: '#10B981' },
        { name: 'Pendientes', value: payments.pending, color: '#F59E0B' },
        { name: 'Eximidos',   value: payments.waived,  color: '#EF4444' },
    ], [payments]);

    const totalPagos = payments.paid + payments.pending + payments.waived;

    const lineData = useMemo(() => {
        const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - (6 - i));
            return d;
        });
        const keyFor = (d) => d.toISOString().slice(0, 10);
        const counts = new Map(days.map((d) => [keyFor(d), 0]));
        bookingsList.forEach((b) => {
            const raw = b.createdAt || b.timestamp;
            if (!raw) return;
            const key = new Date(raw).toISOString().slice(0, 10);
            if (counts.has(key)) counts.set(key, counts.get(key) + 1);
        });
        return days.map((d) => ({
            name: d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short' }).replace('.', ''),
            value: counts.get(keyFor(d)),
        }));
    }, [bookingsList]);

    const fechaActual = new Date().toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' });
    const metaCarbono = 50;
    const carbonoActual = Number(metricas.totalCarbonSaved) || 0;
    const progresoCarbono = Math.min(100, Math.round((carbonoActual / metaCarbono) * 100));
    const carbonoFaltante = Math.max(0, metaCarbono - carbonoActual).toFixed(1);



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

                            <div className="selectorMini">Últimos 7 días <ChevronDown size={14} /></div>
                        </div>

                        <div className="graficoBody">

                            <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={0}>

                                <LineChart data={lineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>

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
                            <p className="descripcionMeta">Faltan <strong>{carbonoFaltante} kg</strong> de CO₂ para alcanzar la meta de sostenibilidad institucional.</p>
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
                                        <div className="tiempoPrecio">{new Date(item.createdAt || Date.now()).toLocaleDateString()}</div>
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

                                        {new Date(item.createdAt || Date.now()).toLocaleDateString()}
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
