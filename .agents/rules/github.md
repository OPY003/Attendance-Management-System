---
trigger: always_on
---

# Workspace Rules — Git & GitHub

## 1. Automatic Git Workflow

Whenever you create, modify, delete, rename, or move code or project files, you MUST manage the Git workflow after completing the requested task.

After the code changes are complete:

1. Check the current Git status.
2. Review the changes with `git diff`.
3. Identify all files affected by the task.
4. Run appropriate build, lint, type-check, and/or test commands available for the project.
5. Fix errors caused by your changes before committing.
6. Stage only the files relevant to the completed task.
7. Create a clear, meaningful commit.
8. Push the commit to the current GitHub branch.
9. Verify that the push was successful.

Do not wait for me to separately ask you to commit or push.

## 2. Default Behavior

After successfully completing a coding task, automatically:

```bash
git status
git diff
# run project validation
git add <relevant-files>
git commit -m "<meaningful commit message>"
git push
git status
```

Use the existing branch unless I explicitly request another branch.

Do NOT automatically commit or push if I explicitly say:

* don't push
* don't commit
* local only
* don't use git
* just show the changes

## 3. Commit Messages

Use clear conventional commit messages when appropriate:

```text
feat: add new feature
fix: fix application issue
refactor: improve code structure
style: update UI styling
docs: update documentation
test: add or update tests
chore: update configuration
perf: improve performance
```

The commit message must describe the actual changes.

## 4. Security

Before staging or committing files, ALWAYS check for sensitive information.

NEVER commit:

* `.env` files
* API keys
* passwords
* access tokens
* private keys
* database credentials
* authentication secrets
* cloud credentials
* personal credentials
* other confidential configuration

If necessary, update `.gitignore` before committing.

Never expose secrets in source code, logs, commits, or terminal output.

## 5. Staging Rules

Do NOT blindly run:

```bash
git add .
```

unless you have first verified that every changed file belongs to the current task and contains no sensitive information.

Prefer staging specific relevant files.

Do not commit unrelated changes that were already present before the task.

Do not overwrite or discard my existing uncommitted work.

## 6. Validation Before Push

Before committing and pushing, perform the project's appropriate checks.

Depending on the project, use:

* Build
* Unit tests
* Integration tests
* Lint
* Type checking
* Static analysis
* Database/schema validation
* Other available project checks

If a failure is caused by your changes, fix it before pushing.

If a failure is clearly an existing unrelated problem, do not modify unrelated code just to make the check pass. Report it.

## 7. Pulling Remote Changes

Before pushing, make sure the local branch is reasonably synchronized with its remote branch.

If necessary:

```bash
git pull --rebase
```

Resolve conflicts carefully.

NEVER:

```bash
git push --force
```

unless I explicitly authorize it.

Never use destructive Git commands to remove or overwrite my work.

Do not reset, checkout, clean, or discard existing user changes without explicit permission.

## 8. Conflict Handling

If a merge or rebase conflict occurs:

1. Inspect the conflicting files.
2. Preserve the user's existing work.
3. Resolve conflicts carefully when the correct resolution is obvious.
4. Re-run relevant tests/build checks.
5. Continue the Git workflow only after the repository is in a valid state.

If the conflict cannot be safely resolved, STOP before pushing and explain the conflict.

Never choose a destructive resolution simply to make Git succeed.

## 9. Commit Strategy

Prefer one logical commit for one completed task.

If a task contains clearly independent features or fixes, separate them into logical commits when appropriate.

Do not create unnecessary commits for every individual file edit.

Do not create empty commits.

## 10. GitHub Push

After the task is successfully validated and committed:

```bash
git push
```

Verify that the push completed successfully.

If authentication, permissions, branch protection, network problems, or another GitHub issue prevents the push:

* Do not use destructive workarounds.
* Do not force push.
* Do not change GitHub settings without permission.
* Clearly report the exact problem.

## 11. Final Report

After completing the task, provide a concise summary:

```text
Git Summary
-----------
Branch: <current branch>
Files changed: <files>
Validation: <tests/build/lint performed>
Commit: <commit message>
Commit Hash: <hash>
Push: <successful/failed>
```

If the push failed, clearly explain why.

## 12. Important Priority

The requested coding task comes first.

Do not make unrelated changes simply to satisfy these Git rules.

Keep the repository clean, safe, and synchronized with GitHub.

The goal is:

CODE CHANGE → VALIDATE → REVIEW → COMMIT → PUSH → VERIFY

