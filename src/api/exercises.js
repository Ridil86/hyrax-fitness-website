import { apiGet, apiPost, apiPut, apiDelete } from './client';

export function fetchExercises(token) {
  return apiGet('/api/exercises', token);
}

export function fetchExerciseById(id, token) {
  return apiGet(`/api/exercises/${id}`, token);
}

export function createExerciseApi(data, token) {
  return apiPost('/api/exercises', data, token);
}

export function updateExerciseApi(id, data, token) {
  return apiPut(`/api/exercises/${id}`, data, token);
}

export function deleteExerciseApi(id, token) {
  return apiDelete(`/api/exercises/${id}`, token);
}
