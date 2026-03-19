import { apiGet, apiPost, apiDelete } from './client';

export function createExerciseLog(data, token) {
  return apiPost('/api/logs', data, token);
}

export function createWorkoutLog(data, token) {
  return apiPost('/api/logs/workout', data, token);
}

export function fetchUserLogs(params, token) {
  const query = new URLSearchParams();
  if (params?.exerciseId) query.set('exerciseId', params.exerciseId);
  if (params?.workoutId) query.set('workoutId', params.workoutId);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiGet(`/api/logs${qs ? `?${qs}` : ''}`, token);
}

export function fetchLogStats(token) {
  return apiGet('/api/logs/stats', token);
}

export function fetchExerciseHistory(exerciseId, token) {
  return apiGet(`/api/logs/exercise-history?exerciseId=${exerciseId}`, token);
}

export function fetchCalendarData(year, month, token) {
  return apiGet(`/api/logs/calendar?year=${year}&month=${month}`, token);
}

export function deleteLogApi(id, token) {
  return apiDelete(`/api/logs/${id}`, token);
}
