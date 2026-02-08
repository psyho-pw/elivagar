---
name: worktree
description: Create a new git worktree with an appropriate branch name using `make worktree-add-branch` from the workspace root Makefile. Use when the user requests to create a new worktree for feature development, such as "워크트리 새로 생성해서 작업 진행해", "새 워크트리 만들어", "worktree 생성", "새 브랜치로 워크트리 추가", "워크트리 추가해줘", "create a new worktree", "add worktree".
---

# Worktree Creator

Create a new git worktree via the workspace root Makefile and prepare the working environment.

## Workflow

1. Confirm the feature/task the user wants to work on
2. Determine branch name using conventional prefixes (`feat/`, `fix/`, `hotfix/`, `refactor/`, `chore/`)
3. Find workspace root: traverse upward from current directory to locate the directory containing both `Makefile` and `.bare/`
4. Run `make -C <workspace-root> worktree-add-branch <branch-name>`
5. Report the created worktree path to the user

## Finding Workspace Root

Search upward from the current working directory for a directory containing both `Makefile` and `.bare/`.

## Branch Naming

| Prefix      | Use Case              | Example                   |
| ----------- | --------------------- | ------------------------- |
| `feat/`     | New feature           | `feat/user-auth`          |
| `fix/`      | Bug fix               | `fix/login-error`         |
| `hotfix/`   | Production hotfix     | `hotfix/critical-crash`   |
| `refactor/` | Code restructuring    | `refactor/auth-module`    |
| `chore/`    | Maintenance, config   | `chore/update-deps`       |

- Use lowercase English and hyphens (`-`)
- Slashes (`/`) are automatically converted to hyphens in the worktree directory name

## Rules

- Always confirm the branch name with the user before creating
- If workspace root is not found, inform the user
- After creation, report the worktree directory path and suggest next steps
