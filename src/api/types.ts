export type TaskStatus = 'pending' | 'completed';

/** One task as the API returns it (shared contract, section 8 of the plan). */
export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
}
