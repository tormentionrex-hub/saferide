const { Ride, Booking, Vehicle } = require('../models');
const monitoringService = require('../services/monitoringService');

jest.mock('../models', () => ({
  Ride: { find: jest.fn() },
  Booking: { aggregate: jest.fn() },
  Vehicle: { find: jest.fn() },
}));

const rideId = '660000000000000000000001';
const driverId = '660000000000000000000002';

const buildRide = (now) => ({
  _id: rideId,
  status: 'in progress',
  createdAt: new Date(now - 5 * 60 * 1000),
  updatedAt: new Date(now - 5 * 60 * 1000),
  startedAt: new Date(now - 4 * 60 * 1000),
  origin: { name: 'San José', coordinates: { lat: 9.9281, lng: -84.0907 } },
  destination: { name: 'Alajuela', coordinates: { lat: 10.0162, lng: -84.2148 } },
  driver_id: {
    _id: driverId,
    name: 'Conductor Real',
    username: 'conductor_real',
    rating: 4.8,
    profileImage: null,
    currentLocation: { lat: 9.93, lng: -84.09, updatedAt: new Date(now - 2000) },
  },
});

const mockRideQuery = (rides) => {
  const query = {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(rides),
  };
  Ride.find.mockReturnValue(query);
  return query;
};

describe('monitoringService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('marca como live una posición reciente y como stale una antigua', () => {
    const now = Date.now();
    expect(monitoringService.toLocation({ lat: 9.9, lng: -84.1, updatedAt: new Date(now - 1000) }, now).isLive).toBe(true);
    expect(monitoringService.toLocation({ lat: 9.9, lng: -84.1, updatedAt: new Date(now - 120000) }, now).isLive).toBe(false);
    expect(monitoringService.toLocation({ lat: null, lng: -84.1 }, now)).toBeNull();
  });

  it('devuelve un snapshot con conductor, vehículo, pasajeros y GPS', async () => {
    const now = Date.now();
    mockRideQuery([buildRide(now)]);
    Vehicle.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([{
        _id: '660000000000000000000003',
        driver_id: driverId,
        brand: 'Toyota',
        model: 'Corolla',
        license_plate: 'ABC123',
      }])
    });
    Booking.aggregate.mockResolvedValue([{ _id: rideId, count: 2 }]);

    const result = await monitoringService.getActiveMonitoringRides();

    expect(result).toHaveLength(1);
    expect(result[0].driver.name).toBe('Conductor Real');
    expect(result[0].vehicle.license_plate).toBe('ABC123');
    expect(result[0].passengerCount).toBe(2);
    expect(result[0].location.isLive).toBe(true);
    expect(result[0].location.lat).toBe(9.93);
    expect(result[0].startedAt).toEqual(new Date(now - 4 * 60 * 1000));
    expect(Ride.find).toHaveBeenCalledWith({
      status: { $in: ['in progress', 'awaiting_payment_verification'] },
    });
  });

  it('muestra el viaje sin GPS cuando el conductor aún no reporta ubicación', async () => {
    const now = Date.now();
    const ride = buildRide(now);
    ride.driver_id.currentLocation = null;
    mockRideQuery([ride]);
    Vehicle.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    Booking.aggregate.mockResolvedValue([]);

    const [result] = await monitoringService.getActiveMonitoringRides();

    expect(result.location).toBeNull();
    expect(result.vehicle).toBeNull();
    expect(result.passengerCount).toBe(0);
  });

  it('no consulta vehículos ni bookings cuando no hay viajes activos', async () => {
    mockRideQuery([]);
    await expect(monitoringService.getActiveMonitoringRides()).resolves.toEqual([]);
    expect(Vehicle.find).not.toHaveBeenCalled();
    expect(Booking.aggregate).not.toHaveBeenCalled();
  });
});
