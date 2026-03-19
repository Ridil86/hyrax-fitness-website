import { apiGet, apiPost, apiPut, apiDelete } from './client';

export function fetchEquipment(token) {
  return apiGet('/api/equipment', token);
}

export function fetchEquipmentById(id, token) {
  return apiGet(`/api/equipment/${id}`, token);
}

export function createEquipmentApi(data, token) {
  return apiPost('/api/equipment', data, token);
}

export function updateEquipmentApi(id, data, token) {
  return apiPut(`/api/equipment/${id}`, data, token);
}

export function deleteEquipmentApi(id, token) {
  return apiDelete(`/api/equipment/${id}`, token);
}
