# Barkdown documentation

**Current phase: dependable workspaces.** Prove a local profile can hold notes and agent work, survive restart, and move to another machine. The desktop and Paper editor are the foundation; profile isolation is next.

## Find your starting point

| I want to… | Read |
|---|---|
| Understand the product and run it | [Repository overview](../README.md) |
| Start a change | [Contributing](../CONTRIBUTING.md) |
| Choose the next task | [Active plan](PLAN.md) · `npm run plan` |
| Continue implementation | [Next-agent handoff](NEXT-AGENT.md) |
| Understand state ownership | [Architecture](ARCHITECTURE.md) |
| Know what must pass | [Acceptance scenarios](ACCEPTANCE.md) |
| Check what actually passed | [Validation](VALIDATION.md) · [Editor matrix](EDITOR-PARITY.md) |
| Preserve product behavior | [Design decisions](DESIGN-DECISIONS.md) |
| Run the private local server | [Local Barkpark](LOCAL-BARKPARK.md) |
| Find implementation modules | [Desktop guide](../app/README.md) |

## Which source wins?

User direction and accepted decisions guide behavior. [PLAN.md](PLAN.md) and [plan.json](plan.json) define current delivery stages; [ACCEPTANCE.md](ACCEPTANCE.md) defines their proof. `app/` records what is implemented, and actual Barkpark contracts govern upstream operations.

The original [PRD](PRD.md), [sizing review](TIPTAP-REVIEW.md), [typed sketch](contracts/workspace.ts), and [archived handoffs](archive/README.md) preserve context. They do not replace the active roadmap or constitute current API guarantees. The [source map](SOURCE-MAP.md) and [third-party notices](../THIRD-PARTY.md) preserve provenance.

## Maintain this phase

Keep planned, implemented, tested and merged states distinct. Update the plan, handoff and evidence when a milestone changes. Preserve old evidence with its source commit. G1 (upstream integration) and G2 (cross-repository regression enforcement) remain explicit in the plan until verified.
