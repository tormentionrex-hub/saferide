const { Ride, Booking, Vehicle } = require('../models');

const ACTIVE_STATUSES = ['in progress', 'awaiting_payment_verification'];
const BOOKING_STATUSES = ['pending', 'confirmed'];

const liveWindowMs = () => {
  const configured = Number(process.env.MONITORING_LIVE_WINDOW_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 60000;
};

const toLocation = (currentLocation, now = Date.now()) => {
  if (currentLocation?.lat == null || currentLocation?.lng == null) return null;
  const lat = Number(currentLocation.lat);
  const lng = Number(currentLocation?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const timestamp = new Date(currentLocation?.updatedAt).getTime();
  return {
    lat,
    lng,
    updatedAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null,
    isLive: Number.isFinite(timestamp) && now - timestamp <= liveWindowMs(),
  };
};

const mapVehicle = (vehicle) => {
  if (!vehicle) return null;
  return {
    _id: String(vehicle._id),
    brand: vehicle.brand || null,
    model: vehicle.model || null,
    license_plate: vehicle.license_plate || null,
    color: vehicle.color || null,
    year: vehicle.year || null,
    vehicleImage: vehicle.vehicleImage || null,
  };
};

const mapDriver = (driver) => {
  if (!driver) return null;
  return {
    _id: String(driver._id),
    name: driver.name || null,
    username: driver.username || null,
    rating: driver.rating ?? null,
    phone: driver.phone || null,
    company: driver.company || null,
    profileImage: driver.profileImage || null,
  };
};

const mapMonitoringRide = (ride, vehicle, passengerCount = 0, now = Date.now()) => ({
  _id: String(ride._id),
  status: ride.status,
  origin: ride.origin || null,
  destination: ride.destination || null,
  fecha: ride.fecha || null,
  hora: ride.hora || null,
  startedAt: ride.startedAt || ride.createdAt || null,
  createdAt: ride.createdAt || null,
  updatedAt: ride.updatedAt || null,
  driver: mapDriver(ride.driver_id),
  vehicle: mapVehicle(vehicle),
  location: toLocation(ride.driver_id?.currentLocation, now),
  passengerCount: Number(passengerCount) || 0,
});

const getActiveMonitoringRides = async () => {
  const rides = await Ride.find({ status: { $in: ACTIVE_STATUSES } })
    .populate(
      'driver_id',
      'name username rating profileImage phone company currentLocation isActive'
    )
    .sort({ createdAt: -1 })
    .lean();

  if (rides.length === 0) return [];

  const driverIds = rides.map((ride) => ride.driver_id?._id).filter(Boolean);
  const rideIds = rides.map((ride) => ride._id);

  const [vehicles, bookingGroups] = await Promise.all([
    Vehicle.find({ driver_id: { $in: driverIds }, isActive: true }).lean(),
    Booking.aggregate([
      {
        $match: {
          ride_id: { $in: rideIds },
          status: { $in: BOOKING_STATUSES },
        },
      },
      { $group: { _id: '$ride_id', count: { $sum: 1 } } },
    ]),
  ]);

  const vehiclesByDriver = new Map(
    vehicles.map((vehicle) => [String(vehicle.driver_id), vehicle])
  );
  const bookingsByRide = new Map(
    bookingGroups.map((group) => [String(group._id), group.count])
  );
  const now = Date.now();

  return rides.map((ride) => mapMonitoringRide(
    ride,
    vehiclesByDriver.get(String(ride.driver_id?._id)),
    bookingsByRide.get(String(ride._id)) || 0,
    now
  ));
};

module.exports = {
  ACTIVE_STATUSES,
  toLocation,
  mapMonitoringRide,
  getActiveMonitoringRides,
};
