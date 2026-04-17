<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Verification Rules

- Only use `bun run lint` and `bun run build` for verification.
- Do not add new automated tests for this project.
- Do not run `bun test` or any other test runner.

# UI Rules

- Destructive icon actions such as delete/remove buttons should use a white or neutral resting background with destructive text, and switch to a soft reddish hover background rather than a fully solid red fill. Do not use neutral ghost styling for delete actions.
