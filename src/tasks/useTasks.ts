import { useContext } from 'react';
import { TasksContext, type TasksValue } from './tasksContext';

export function useTasks(): TasksValue {
  const value = useContext(TasksContext);
  if (!value) throw new Error('useTasks must be used inside TasksProvider');
  return value;
}
