# REKT INK(CUBATOR) — State Legibility / Action Causality Matrix V1

**Status:** implementation evidence for the state-trust pass
**Scope:** shared shell, WORLD participation, COMMAND controls, PROJECT inspection and SHIP submission
**Authority:** Product Contract MVP, Signal Grammar V1, Surface Purpose V1 and the active frontend implementation

This matrix records the behavior that is actually enabled in the launch candidate. A request acknowledgement is not treated as a canonical outcome; the UI keeps the control, request state, server response, projected consequence and next action distinguishable.

## Connection state projection

The private `GET /v1/me/connection` projection is the sole source for the shared shell context. `github.user_id` is the immutable provider identity authority. `github.login` and repository full name are verified display metadata and may change after provider reconciliation.

| Context label | Canonical source | Visible states | Meaning |
| --- | --- | --- | --- |
| `SIGNED IN` | server session → Player | `SIGNED IN` / anonymous WORLD context | The browser has a server-owned Player session; it does not grant repository access. |
| `APP ACCESS` | GitHub installation rows + revocation | `GRANTED` / `NOT GRANTED` / `REVOKED` | The read-only GitHub App installation is available to the Player. |
| `REPOSITORY AUTHORIZED` | active repository bindings | `AUTHORIZED` / `NOT AUTHORIZED` / `REVOKED` | At least one repository is currently selectable for this Player. |
| `PROJECT LINKED` | Project repository binding | `LINKED` / `NOT LINKED` / `ACCESS REVOKED` | The current private Project has a source binding; revoked/removed access does not disappear as a false “unlinked” state. |
| `OBSERVING` | linked source availability + Project evidence history | `OBSERVING` / `NOT OBSERVING` / `UNAVAILABLE` | The server-side source watcher can receive observations. This label does not escalate a source event to PROVEN. |

WORLD is publicly readable without a session. When no session exists, the shell shows `PLAYER / ANONYMOUS`, `GITHUB / NOT CONNECTED`, `SOURCE / PUBLIC WORLD`, and `RX / ANONYMOUS`; no private source object is requested or rendered.

## Control consequence matrix

| Control | Pending | Response | Canonical consequence | Visible confirmation | Next action |
| --- | --- | --- | --- | --- | --- |
| `ENTER WITH GITHUB` | OAuth state/verifier cookies and provider redirect | Callback establishes/reuses one Player by numeric GitHub ID | Server session plus verified login metadata; return to COMMAND | `auth=github` return and shared `SIGNED IN` / GitHub context | Declare a Mission or inspect source access |
| `AUTHORIZE REPOSITORIES` / `CHANGE REPOSITORY ACCESS` | One-time GitHub App setup state; provider page | Setup callback verifies installation, permissions, installation owner and repository IDs | Installation/repository bindings are reconciled; revoked bindings stay unavailable | `source=authorized` return, repository list and `APP ACCESS` / `REPOSITORY AUTHORIZED` states | Choose and link a repository, or `CHECK NOW` |
| `LINK AUTHORIZED REPOSITORY` | Button/form disabled until an authorized choice exists | Server validates Player ownership and repository authority | Project’s current repository binding is written; an unavailable old binding may be replaced | Form success plus `PROJECT LINKED` and `SOURCE` update after invalidation | Wait for `OBSERVING`, then inspect PROJECT/COMMAND evidence |
| `CHECK NOW` / retry source | Repository projection request | HTTP response is retained as data/error | No local source state is invented; only a fresh server projection changes context | `CHECKING`, list/error, or explicit unavailable state | Retry on focus/reconnect or authorize/link |
| `SAVE WORK STATE` | Form disabled while mutation is pending | Mission mutation response or domain error | Current focus/Next Move/blocker changes only through the canonical Mission mutation | Success/error copy; COMMAND remains the sole Next Move owner | Follow the single displayed `NEXT MOVE` |
| `OPEN HELP BEACON` | Idempotent request pending | Help Beacon response | Public help declaration is created; no progress/proof grant | Success copy and open beacon state after reconciliation | Wait for an accepted Assist or close the beacon |
| `CLOSE HELP BEACON` | Close mutation pending | Close response or conflict | Help Beacon becomes closed | Pending/response/error status | Open a new bounded request if a blocker remains |
| `ACCEPT ASSIST` | Accept mutation pending | Assist acceptance response | Party/collaboration becomes canonical OBSERVED state | Offer disappears; acceptance status and downstream projections reconcile | Continue the build; Ship attribution happens only at Ship time |
| `REQUEST EXTERNAL TEST` | Idempotent tester request pending | Request response | An OPEN test request exists | Success plus PROJECT/WORLD request state | Wait for another Player’s result |
| `RECORD TEST RESULT` | Result mutation pending | Result response | External observation is recorded as `OBSERVED` | `TEST RESULT RECORDED / OBSERVED` | Read the result; it is not automatically PROVEN |
| `SUBMIT FOR VERIFICATION` | Ship form disabled while submission is pending | Submission response or verifier/domain error | A Ship claim is queued; verifier owns the next transition | `SUBMISSION RECORDED`, then `SUBMITTED`/`OBSERVED`/`ATTENTION` projection | Inspect verifier observation; only accepted receipt is `PROVEN` |
| `RETRY` controls | Request pending | Fresh response/error | Snapshot may refresh; no event is inferred from polling | `READING`, `STALE`, `UNAVAILABLE`, or recovered projection | Continue only from the state actually returned |
| Mode rail / record selection / `Open …` links | Immediate browser/UI response | No server mutation | Navigation/selection changes locus only; it is not an event | Focus/pressed state and destination mode | Use the destination instrument; no proof or activity implication |

## Review notes

- `CLAIMED`, `OBSERVED`, and `PROVEN` remain separate in labels and explanatory copy. A successful HTTP response is not itself proof.
- The shell inspector is progressive disclosure: it exposes provider IDs, source IDs and last observation only when requested, rather than creating a second dashboard.
- The generated client still uses compile-time casts for the pre-existing operation set. The new connection boundary has a bounded runtime discriminant guard in the web client. Broader response validation remains a High follow-up unless a repository-wide validation strategy is authorized.
- Private repository contents, commit text and contributor metadata are not included in the connection projection or public WORLD context.
