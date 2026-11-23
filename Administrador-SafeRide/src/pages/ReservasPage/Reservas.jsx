import BookingsTable from '../../components/BookingsTable';
import '../VehiculosPage/Vehiculos.css';

// Todas las reservas de la plataforma (GET /bookings como admin), con filtros
// por estado, pago, método y fechas. Solo lectura: las decisiones sobre una
// reserva las toman el conductor y el pasajero en la app.
const Reservas = () => (
  <div className="vehiculos-container">
    <div className="vehiculos-header">
      <div>
        <h1>Gestión de Reservas</h1>
        <p>Todas las solicitudes de asiento, su estado y su cobro.</p>
      </div>
    </div>
    <BookingsTable mode="reservas" />
  </div>
);

export default Reservas;
