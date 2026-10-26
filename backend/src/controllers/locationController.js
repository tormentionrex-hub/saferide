const { User, Ride, Booking } = require('../models');

exports.updateLocation = async (req, res) => {
    const { lat, lng, inTrip } = req.body;
    try {
        if (!lat || !lng) {
            return res.status(400).json({ success: false, message: 'Coordinates are required' });
        }

        if (typeof lat !== 'number' || typeof lng !== 'number' || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
            return res.status(400).json({ success: false, message: 'Invalid coordinates' });
        }
        // Solo un conductor con un viaje en curso publica su posición: así un
        // pasajero (o un conductor sin viaje) no puede escribir una ubicación
        // que después leen los demás.
        if (req.user.type !== 'conductor') {
            return res.status(403).json({ success: false, message: 'Only drivers share their location' });
        }
        if (inTrip) {
            const active = await Ride.exists({ driver_id: req.user._id, status: 'in progress' });
            if (!active) {
                return res.status(403).json({ success: false, message: 'No ride in progress' });
            }
            await User.findByIdAndUpdate(req.user._id, {
                currentLocation: { lat, lng, updatedAt: new Date() }
            });
        }
        res.status(200).json({ success: true, message: 'Location updated' });
    } catch (error) {
        console.error('Error updating location:', error);
        res.status(500).json({ success: false, message: 'Server error updating location' });
    }
};

exports.getDriverLocation = async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.rideId).populate('driver_id', 'currentLocation name');
        
        if (!ride) {
            return res.status(404).json({ success: false, message: 'Ride not found' });
        }

        // La posición del conductor es un dato sensible: solo la ven el propio
        // conductor, un administrador o un pasajero con reserva en ese viaje.
        const isDriver = ride.driver_id && ride.driver_id._id.toString() === req.user._id.toString();
        if (!isDriver && req.user.type !== 'admin') {
            const hasBooking = await Booking.exists({
                ride_id: ride._id,
                passenger_id: req.user._id,
                status: { $in: ['pending', 'confirmed'] },
            });
            if (!hasBooking) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }
        }

        if (!ride.driver_id || !ride.driver_id.currentLocation) {
            return res.status(404).json({ success: false, message: 'Driver location not available' });
        }

        res.status(200).json({ 
            success: true, 
            location: ride.driver_id.currentLocation 
        });
    } catch (error) {
        console.error('Error fetching driver location:', error);
        res.status(500).json({ success: false, message: 'Server error fetching location' });
    }
};
