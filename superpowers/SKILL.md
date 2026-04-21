---
name: superpowers
description: Enforcement of systematic software engineering methodologies including Socratic debugging, strict Test-Driven Development (TDD), granular step-by-step planning, and process-oriented problem solving. Use when starting new complex tasks or debugging hard problems to enforce rigor and avoid guesswork.
---

# Superpowers Skill

This skill provides procedural guidance to execute tasks using rigorous software engineering practices. You MUST enforce the "Process over guessing" philosophy. Stop guessing and start deducing.

## 1. Systematic Debugging (4-Phase Process)

Do not guess fixes. Follow these phases sequentially:

1.  **Identify Symptoms**: Clearly state the failure, error message, and expected behavior.
2.  **Isolate Cause**: Narrow down the location. Which file/function is the exact source? Use empirical reproduction.
3.  **Root Cause Analysis (5-Whys)**: Ask "Why did this fail?" repeatedly until you reach the fundamental flaw (e.g., race condition, incorrect assumption, missing type check).
4.  **Verify Fix (Defense-in-Depth)**: Make the minimal change required. Prove it works via testing. Add safeguards so this specific class of bug doesn't happen again.

## 2. Strict Red-Green-Refactor Protocol (TDD)

Any new feature or bug fix must be accompanied by automated tests.

1.  **Red**: Write the failing test first. Verify that it fails for the correct reason.
2.  **Green**: Write the absolute minimum code required to make the test pass.
3.  **Refactor**: Clean up the code, remove duplication, and ensure it adheres to workspace standards. 

*Rule*: Never write production code without a corresponding test validating its behavior.

## 3. Socratic Design Refinement

Before beginning implementation, pause to refine the design:
- Ask clarification questions to resolve ambiguity.
- Break down complex requests into smaller, highly specific sub-tasks.
- Present a clear, actionable plan to the user for validation before writing code.

## 4. Bite-Sized Task Planning

When executing a complex plan, break it down into granular tasks (2-5 minutes of work each). Each task must include:
- The exact file path (`path/to/file`).
- The specific change or expected output.
- A command or method to verify the change (e.g., running a specific test).

Execute one step at a time, verifying at each boundary.

## 5. Delegation and Sub-Agents

When faced with repetitive tasks or large refactors, offload them to specialized sub-agents.
- Delegate specific, independent tasks.
- Validate the work of sub-agents upon their completion.
