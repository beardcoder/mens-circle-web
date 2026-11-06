# 0004: No double opt-in for registrations; a cancel link instead

**Status:** accepted (2026-11).

**Context.** Anyone can register with any address. Before, a sign-up could also
overwrite the stored name and phone of that address, and nobody could cancel on
their own.

**Decision.** No double opt-in: a seat is booked at once, as before. A public
sign-up never overwrites stored participant data (it fills empty fields and keeps
differences on the registration for the admin), and every participant mail carries a
signed cancel link that frees the seat for the waitlist. Personal data is anonymised
30 days after the event.

**Why not double opt-in.** It would hold a seat for a confirmation that many people
open late or never, needs a reservation timeout job and a second mail on the most
important path, for a small circle where misuse has not happened. The cancel link
removes the harm a foreign sign-up can do (the owner of the address cancels in one
step) at much lower cost.

**Revisit when** fake registrations show up in practice: then a 15-minute held seat
confirmed by a link.
