import { http, HttpResponse } from 'msw';
import type { Task } from '../../api/types';

/** Backend refusal bodies exactly as the API sends them (plan section 3). */
export const serverErrorBody = { error: { code: 'INTERNAL', message: 'Something went wrong.' } };

export const listTasksEmpty = http.get('/api/tasks', () => HttpResponse.json({ tasks: [] }));

/** The list as the API sends it: newest first, wrapped. */
export const listTasksWith = (tasks: Task[]) =>
  http.get('/api/tasks', () => HttpResponse.json({ tasks }));

export const listTasksFails = (status = 500) =>
  http.get('/api/tasks', () => HttpResponse.json(serverErrorBody, { status }));

export const createTaskReturning = (task: Task) =>
  http.post('/api/tasks', () => HttpResponse.json({ task }, { status: 201 }));

export const createTaskFails = (status = 500) =>
  http.post('/api/tasks', () => HttpResponse.json(serverErrorBody, { status }));

export const deleteTaskNoContent = http.delete(
  '/api/tasks/:id',
  () => new HttpResponse(null, { status: 204 }),
);

export const deleteTaskFails = (status = 500) =>
  http.delete('/api/tasks/:id', () => HttpResponse.json(serverErrorBody, { status }));
