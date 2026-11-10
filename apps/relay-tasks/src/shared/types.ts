export type Task = Readonly<{
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
}>;

export type TaskState = Readonly<{ tasks: readonly Task[] }>;

export type TaskAction =
  | Readonly<{ type: 'task/add'; task: Task }>
  | Readonly<{ type: 'task/setCompleted'; id: string; completed: boolean }>
  | Readonly<{ type: 'task/rename'; id: string; title: string }>
  | Readonly<{ type: 'task/delete'; id: string }>;
