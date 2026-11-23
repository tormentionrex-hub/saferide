import { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Car, MapPin, Activity, RefreshCcw, Navigation,
  Wifi, WifiOff, Users as UsersIcon
} from 'lucide-react';

import { useInProgressRides } from '../../hooks/useInProgressRides';
import DefaultImageUser from '../../imgs/DefaultImageUser.png';
import './Monitoreo.css';

// Costa Rica como centro por defecto (Tres Ríos aprox).
const DEFAULT_CENTER = [9.9281, -84.0907];
const DEFAULT_ZOOM = 9;

// Marker custom para conductores (sin depender del icono PNG default de Leaflet
// que se rompe con los bundlers).
const driverIcon = L.divIcon({
  className: 'monitor-marker',
  html: '<div class="monitor-marker-inner"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg></div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

// Devuelve [lat, lng] o null. La posición live viene de User.currentLocation.
const ridePosition = (r) => {
  if (r.location?.lat != null && r.location?.lng != null) {
    return [r.location.lat, r.location.lng];
  }
  const origin = r.origin?.coordinates;
  if (origin?.lat != null && origin?.lng != null) {
    return [origin.lat, origin.lng];
  }
  return null;
};

const timeAgo = (iso) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)        return `hace ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60)        return `hace ${m} min`;
  const h = Math.floor(m / 60);
  return `hace ${h} h`;
};

// Componente que ajusta el mapa para encuadrar todos los markers o centrar
// uno específico cuando se hace click en la lista.
const MapController = ({ rides, focusId }) => {
  const map = useMap();

  useEffect(() => {
    if (!rides?.length) return;
    if (focusId) {
      const r = rides.find((x) => x._id === focusId);
      const pos = r && ridePosition(r);
      if (pos) map.setView(pos, 14, { animate: true });
      return;
    }
    const positions = rides.map(ridePosition).filter(Boolean);
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 13, { animate: true });
    } else {
      map.fitBounds(positions, { padding: [50, 50], maxZoom: 13, animate: true });
    }
  }, [rides, focusId, map]);

  return null;
};

const RideListItem = ({ ride, selected, onClick }) => {
  const pos = ridePosition(ride);
  const hasLocation = !!ride.location;
  return (
    <button
      type="button"
      className={`monitor-item ${selected ? 'is-selected' : ''}`}
      onClick={onClick}
      disabled={!pos}
      title={pos ? '' : 'Sin ubicación disponible'}
    >
      <div className="monitor-item-top">
        <img
          src={ride.driver?.profileImage || DefaultImageUser}
          alt={ride.driver?.name || 'Conductor'}
          className="monitor-item-avatar"
          loading="lazy"
        />
        <div className="monitor-item-id">
          <span className="monitor-item-name">{ride.driver?.name || 'Sin conductor'}</span>
          <span className="monitor-item-plate">{ride.vehicle?.license_plate || '—'}</span>
        </div>
        <span className={`monitor-item-pulse ${ride.location?.isLive ? 'is-live' : 'is-stale'}`}>
          <span className="pulse-dot" />
          {hasLocation ? (ride.location.isLive ? 'En vivo' : 'Sin señal') : 'Sin GPS'}
        </span>
      </div>

      <div className="monitor-item-route">
        <div className="route-row">
          <MapPin size={12} color="#10B981" />
          <span>{ride.origin?.name || '—'}</span>
        </div>
        <div className="route-row">
          <Navigation size={12} color="#EF4444" />
          <span>{ride.destination?.name || '—'}</span>
        </div>
      </div>

      <div className="monitor-item-footer">
        <span className="monitor-item-vehicle">{ride.vehicle?.brand || ''} {ride.vehicle?.model || ''}</span>
        <span className="monitor-item-time">{timeAgo(ride.location?.updatedAt ?? ride.startedAt)}</span>
      </div>
    </button>
  );
};

const StatCard = ({ icon: Icon, label, value, accent }) => (
  <div className={`monitor-stat-card accent-${accent}`}>
    <div className="monitor-stat-icon"><Icon size={18} /></div>
    <div className="monitor-stat-body">
      <span className="monitor-stat-value">{value}</span>
      <span className="monitor-stat-label">{label}</span>
    </div>
  </div>
);

const MonitoreoPage = () => {
  // En esta página el polling SIEMPRE está activo (independiente del toggle
  // de Preferencias, que solo controla el toast global). Pero NO notificamos
  // — los toasts globales ya los maneja AdminLayout.
  const { rides, loading, error, refresh } = useInProgressRides({
    enabled: true,
    intervalMs: 5000,
    notify: false,
  });

  const [selectedId, setSelectedId] = useState(null);

  // Si el ride seleccionado desaparece (terminó), deseleccionar.
  useEffect(() => {
    if (selectedId && !rides.find((r) => r._id === selectedId)) {
      setSelectedId(null);
    }
  }, [rides, selectedId]);

  const ridesWithPosition = useMemo(
    () => rides.filter((r) => ridePosition(r) != null),
    [rides],
  );

  const stats = useMemo(() => {
    const total = rides.length;
    const withGps = ridesWithPosition.length;
    const passengers = rides.reduce((sum, r) => sum + (r.passengerCount || 0), 0);
    return { total, withGps, withoutGps: total - withGps, passengers };
  }, [rides, ridesWithPosition]);

  return (
    <div className="monitor-container">
      <header className="monitor-header">
        <div className="monitor-header-text">
          <h1>Monitoreo en Tiempo Real</h1>
          <p>Viajes activos y última posición conocida de cada conductor. Actualización cada 5 s.</p>
        </div>
        <div className="monitor-header-actions">
          <div className={`monitor-status ${loading ? 'is-loading' : ''} ${error ? 'is-error' : ''}`}>
            <Activity size={14} />
            <span>{loading ? 'Actualizando…' : error ? 'Sin conexión' : 'En línea'}</span>
          </div>
          <button type="button" className="monitor-refresh" onClick={refresh} disabled={loading}>
            <RefreshCcw size={14} /> Actualizar
          </button>
        </div>
      </header>

      {/* ─── KPIs ─── */}
      <div className="monitor-stats">
        <StatCard icon={Activity}   label="Viajes activos"   value={stats.total}       accent="blue" />
        <StatCard icon={Wifi}       label="Con señal GPS"    value={stats.withGps}     accent="green" />
        <StatCard icon={WifiOff}    label="Sin señal GPS"    value={stats.withoutGps}  accent="amber" />
        <StatCard icon={UsersIcon}  label="Pasajeros en ruta" value={stats.passengers} accent="violet" />
      </div>

      <div className="monitor-body">
        {/* ─── Lista ─── */}
        <aside className="monitor-list-card">
          <div className="monitor-card-header">
            <h2><Car size={15} /> Viajes en curso</h2>
            <span className="monitor-card-badge">{rides.length}</span>
          </div>
          <div className="monitor-list">
            {error && (
              <div className="monitor-error">
                No se pudo cargar la lista de viajes en curso.
              </div>
            )}
            {!error && rides.length === 0 && !loading && (
              <div className="monitor-empty">
                <Car size={32} />
                <h3>Sin viajes en curso</h3>
                <p>Cuando un conductor inicie un viaje, aparecerá aquí.</p>
              </div>
            )}
            {rides.map((r) => (
              <RideListItem
                key={r._id}
                ride={r}
                selected={r._id === selectedId}
                onClick={() => setSelectedId(r._id)}
              />
            ))}
          </div>
        </aside>

        {/* ─── Mapa ─── */}
        <section className="monitor-map-card">
          <div className="monitor-card-header">
            <h2><MapPin size={15} /> Mapa de flota</h2>
            <div className="monitor-legend">
              <span className="legend-item"><span className="legend-dot legend-blue" /> Conductor activo</span>
              <span className="legend-item">Click para detalles</span>
            </div>
          </div>
          <div className="monitor-map-wrap">
            <MapContainer
              center={DEFAULT_CENTER}
              zoom={DEFAULT_ZOOM}
              scrollWheelZoom
              className="monitor-map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapController rides={ridesWithPosition} focusId={selectedId} />
              {ridesWithPosition.map((r) => {
                const pos = ridePosition(r);
                return (
                  <Marker
                    key={r._id}
                    position={pos}
                    icon={driverIcon}
                    eventHandlers={{ click: () => setSelectedId(r._id) }}
                  >
                    <Popup>
                      <div className="monitor-popup">
                        <strong>{r.driver?.name || 'Conductor'}</strong>
                        <span>{r.vehicle?.license_plate || ''} · {r.vehicle?.brand || ''} {r.vehicle?.model || ''}</span>
                        <span className="popup-route">
                          {r.origin?.name || '—'} → {r.destination?.name || '—'}
                        </span>
                        <span className="popup-time">
                          {r.location?.updatedAt
                            ? `Última posición ${timeAgo(r.location.updatedAt)}`
                            : `Iniciado ${timeAgo(r.startedAt)}`}
                        </span>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </section>
      </div>
    </div>
  );
};

export default MonitoreoPage;
