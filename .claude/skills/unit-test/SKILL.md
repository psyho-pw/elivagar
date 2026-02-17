---
name: unit-test
description: >
  Write unit tests (.spec.ts) for the Elivagar NestJS monorepo following project conventions.
  Uses @suites/unit TestBed, @faker-js/faker factories, and jest mocking patterns.
  Use when the user requests to write unit tests, create spec files, add test coverage,
  or uses phrases like "테스트 작성", "유닛 테스트", "unit test", "spec 작성",
  "테스트 추가", "테스트 코드", "spec 파일 만들어", "test coverage".
---

# Unit Test Writer

Use the `unit-test-writer` agent (`.claude/agents/unit-test.md`) via the Task tool to write unit tests.

## Workflow

1. Identify the target file(s) the user wants to test
2. Spawn the `unit-test-writer` agent with the Task tool:
   - `subagent_type`: `unit-test-writer`
   - Provide the target file path(s) and any specific requirements in the prompt
   - The agent will read the source, write specs, and run tests automatically
3. Report the result to the user

## Example Invocation

When the user says "notification.service.ts 테스트 작성해":

```
Task tool:
  subagent_type: unit-test-writer
  prompt: "Write unit tests for apps/notification/src/notification.service.ts. Read the source file, check existing factories in test/factories/, and create a comprehensive spec file covering all public methods with success and error cases. Run pnpm test to verify."
```

## Notes

- For multiple files, spawn multiple agents in parallel for efficiency
- The agent handles factory creation, spec writing, and test execution
- If tests fail, the agent will fix and re-run automatically
