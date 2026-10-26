# Full List of SafeRide API Endpoints
Base URL: `http://localhost:8080/api/v1`

## Authentication (`/auth`)
- `POST /auth/register` - Create a new user (admin, conductor, pasajero)
- `POST /auth/login` - Authenticate user and get tokens
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout user (requires token)
- `GET /auth/me` - Get current authenticated user details (requires token)
- `PUT /auth/password` - Change password (requires token)

## Users (`/users`) *[Requires Token]*
- `GET /users` - Get all paginated users (only for administrators)
- `GET /users/:id` - Get specific user by ID
- `PUT /users/:id` - Update user details
- `POST /users/:id/image` - Upload a profile image
- `DELETE /users/:id` - Delete user (only for administrators)
- `GET /users/:id/stats` - Get user statistics

## Vehicles (`/vehicles`) *[Requires Token]*
- `POST /vehicles` - Register a vehicle (requires conductor role)
- `GET /vehicles/driver/:driverId` - Get vehicles by driver
- `GET /vehicles/:id` - Get specific vehicle
- `PUT /vehicles/:id` - Update specific vehicle (requires conductor role)
- `POST /vehicles/:id/image` - Upload a vehicle image (requires conductor role)
- `DELETE /vehicles/:id` - Delete a vehicle

## Rides (`/rides`) 
- `GET /rides` - Search for available rides (public/optional auth)
- `GET /rides/:id` - Get specific ride details (public/optional auth)
- `POST /rides` - Create a new ride (requires conductor role)
- `PUT /rides/:id` - Update scheduled ride (requires conductor role)
- `DELETE /rides/:id` - Cancel scheduled ride (requires conductor role)
- `GET /rides/driver/:driverId` - Get rides history for a driver
- `PATCH /rides/:id/start` - Mark ride as in progress (requires conductor role)
- `PATCH /rides/:id/complete` - Mark ride as completed (requires conductor role)

## Bookings (`/bookings`) *[Requires Token]*
- `POST /bookings` - Book seats for a ride
- `GET /bookings` - Get user's bookings (Admins see all)
- `GET /bookings/:id` - Get specific booking
- `GET /bookings/passenger/:passengerId` - Get all bookings for a passenger
- `GET /bookings/ride/:rideId` - Get all bookings for a ride
- `DELETE /bookings/:id` - Cancel a booking
- `PATCH /bookings/:id/status` - Update booking status (requires conductor or admin)

## Notifications (`/notifications`) *[Requires Token]*
- `GET /notifications` - Get all notifications for current user
- `PATCH /notifications/:id/read` - Mark specific notification as read
- `PATCH /notifications/read-all` - Mark all as read
- `DELETE /notifications/:id` - Delete a notification
- `POST /notifications` - Create a manual notification (only for administrators)

## Reviews (`/reviews`)
- `GET /reviews/user/:userId` - Get reviews for a user (public/optional auth)
- `GET /reviews/ride/:rideId` - Get reviews for a ride 
- `POST /reviews` - Create a review for a completed ride (requires token)
- `DELETE /reviews/:id` - Delete a review (requires author or admin token)

## Metrics (`/metrics`)
- `GET /metrics/leaderboard` - Get sustainability leaderboard (public/optional auth)
- `GET /metrics/user/:userId` - Get sustainability metrics for specific user (requires token)
- `POST /metrics/calculate/:userId` - Force metrics calculation (requires admin token)
- `GET /metrics/global` - Get global system metrics (requires admin token)

## System (`/`)
- `GET /health` - API Health check status (always public)
- `POST /jobs/run/:jobName` - Manual trigger for cron jobs (only available in `development` environment)
