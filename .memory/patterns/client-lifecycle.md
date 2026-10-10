# Client lifecycle and server authority

CraterCrew uses monotonically increasing session and animation generations. Increment them before destroying a Phaser game or replacing its animation. Every callback after an await checks both its captured generation and its captured arena identity. Canceling an animation resolves its callback; that callback becomes harmless through its generation check.

Animation results are visual snapshots, not the latest authority. At completion, select the current server room match when its revision is equal or newer. Rematches also increase revisions. A newer authoritative snapshot cancels an obsolete visual effect immediately.

Send socket identity before the first lobby snapshot; refresh lobby controls after identity too. A host may ready before a guest joins. Dispose the old Phaser game before any new local/solo match or rematch.
