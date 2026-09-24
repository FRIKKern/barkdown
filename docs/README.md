# Barkdown documentation

**Current phase: one note engine.** Profile isolation is accepted for the Windows source prototype. P2 has verified disposable Paper staging, native editing, links/media, backup restore, navigation preview and retained-history reading. Legacy authority remains in place. Owned discovery and Archive classification are verified. The next product slice is ordinary draft-note creation/editing/restart; see the [migration contract](migration/README.md) and [current handoff](NEXT-AGENT.md). Portability, optional sync and ordinary installation follow.

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

## Everyday delivery

[Delivery cycles](CYCLES.md) define planning, checkpoints and the closing truth pass. [The current cycle](cycle.json) links its working handoff. Run `npm run cycle`; planned work is never reported as demonstrated capability.

## Inspect the app without reading its implementation

[Visual health](visual/README.md) provides area-specific screenshots, GIFs, review reports and changelogs. [Visual rules](visual/RULES.md) explain change tripwires and how agent review protects the approved baseline.
