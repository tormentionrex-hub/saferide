import api from './api';

let _driversCache = { data: [], pagination: null, stats: null };

export const getAllDrivers = async (params = {}) => {
  const res = await api.get('/users', { params: { ...params, type: 'conductor' } });
  _driversCache = { 
    data: res.data.data, 
    pagination: res.data.pagination,
    stats: res.data.stats
  };
  return res.data;
};

export const getCachedDrivers = () => _driversCache;

export const getVehicleByDriver = async (driverId) => {
  try {
    const res = await api.get(`/vehicles/driver/${driverId}`);
    // El backend devuelve un objeto directo { success: true, data: { ... } }
    return res.data.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      return null; // El conductor no tiene vehículo asignado
    }
    console.error(`Error fetching vehicle for driver ${driverId}:`, err);
    return null;
  }
};

export const createDriver = async (userData) => {
  const res = await api.post('/auth/register', { ...userData, type: 'conductor' });
  return res.data.data;
};

export const updateDriver = async (id, userData) => {
  const res = await api.put(`/users/${id}`, userData);
  return res.data.data;
};

export const deleteDriver = async (id) => {
  const res = await api.delete(`/users/${id}`);
  return res.data;
};

export const activateDriver = async (id) => {
  const res = await api.patch(`/users/${id}/activate`);
  return res.data;
};

// Actualiza el trustScore. action: 'increment' (+1, cap 4) | 'reset' (= 4). Admin only.
export const updateTrust = async (id, action) => {
  const res = await api.patch(`/users/${id}/trust`, { action });
  return res.data;
};

// Hard delete: elimina al conductor permanentemente. Irrecuperable.
export const hardDeleteDriver = async (id) => {
  const res = await api.delete(`/users/${id}/hard`);
  return res.data;
};

export const uploadImage = async (id, file) => {
  const formData = new FormData();
  formData.append('image', file);
  const res = await api.post(`/users/${id}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
};

export default {
  getAllDrivers,
  getCachedDrivers,
  getVehicleByDriver,
  createDriver,
  updateDriver,
  deleteDriver,
  activateDriver,
  updateTrust,
  hardDeleteDriver,
  uploadImage
};
