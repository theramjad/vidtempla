# Task Board Workflow

This directory uses a Kanban-style folder structure to track work:

```
tasks/
├── to-do/     # Planned tasks not yet started
├── doing/     # Tasks currently in progress
└── done/      # Completed tasks
```

## Rules

1. **Pick up a task**: Move its `.md` file from `to-do/` to `doing/` before starting work.
2. **Complete a task**: When all work for a task is done (code committed, tests passing, deployed), move its `.md` file from `doing/` to `done/`.
3. **One task at a time**: Only work on tasks that are in `doing/`. Do not start a new task until the current one is moved to `done/`.
4. **Task files are the source of truth**: Each `.md` file contains the full plan, context, and acceptance criteria. Read it before starting.
5. **Update the file as you go**: If the plan changes during implementation, update the task file in `doing/` to reflect the actual approach taken.
6. **Never delete task files**: Completed tasks in `done/` serve as a historical record of what was built and why.
