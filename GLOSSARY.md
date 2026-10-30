# iDesk

iDesk is the ICT/HC service desk: requesters file tickets, agents at each site handle them, and managers read workload and performance reports per site and team.

## Language

### Ticket handling

**PIC**:
The agent a ticket is assigned to and who stays responsible for it until it is closed, including while it waits on a vendor.
_Avoid_: Assignee (in user-facing text), owner, handler

**Waiting vendor**:
A ticket paused because the next step belongs to an outside vendor; its PIC keeps responsibility but cannot work on it.
_Avoid_: Paused, on hold, dijeda (as a status name)

**Cancelled ticket**:
A ticket withdrawn before resolution; it never counts as work done or work owed.
_Avoid_: Batal, voided, deleted

**Agent rating**:
A requester's 1–5 star score for the agent who handled their ticket, optionally with a comment.
_Avoid_: Review, feedback, bintang (as a noun for the record)

### Workload

**Workload points**:
The weighted measure of work an agent can act on right now, used to pick the next PIC; tickets waiting on a vendor carry no points.
_Avoid_: Load, beban (without qualification), capacity

**Owned tickets**:
All tickets an agent is PIC of that are not yet resolved, closed or cancelled, including those waiting on a vendor.
_Avoid_: Active tickets (ambiguous with workload tickets)

**Workload tickets**:
The owned tickets an agent can act on right now, i.e. not waiting on a vendor; only these carry workload points.
_Avoid_: Active tickets, tiket aktif (when waiting-vendor tickets are meant to be excluded)

### Reports

**Site report**:
A performance report scoped to one site's tickets. IT Support work in it belongs to that site's own agents only; dev teams, who serve every site centrally, are listed by where the ticket is.
_Avoid_: Per-site report that lists IT Support agents from other sites

**Cross-site agent**:
An agent whose home site differs from the site of a ticket they handle.
_Avoid_: Guest agent, visiting agent

**Assigned tickets (Tugas)**:
In a performance report, the tickets given to an agent in the period, excluding cancelled tickets.
_Avoid_: Eligible, total assigned (when cancelled tickets are meant to be excluded)
