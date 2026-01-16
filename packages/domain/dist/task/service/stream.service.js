export const STREAMS = {
    TASKS_PENDING: "stream:tasks:pending",
    taskEvents: (taskRunId) => `stream:tasks:${taskRunId}:events`,
    taskInput: (taskRunId) => `stream:tasks:${taskRunId}:input`,
};
//# sourceMappingURL=stream.service.js.map