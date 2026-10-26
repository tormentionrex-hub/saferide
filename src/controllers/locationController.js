const { User, Ride } = require('../models');

exports.updateLocation = async (req, res) => {
    const { lat, lng, inTrip } = req.body;
    try {
        if (!lat || !lng) {
            return res.status(400).json({ success: false, message: 'Coordinates are required' });
        }

        if (inTrip) {
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
