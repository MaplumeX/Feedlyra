from __future__ import annotations

from datetime import datetime, timezone

from app.services.feed_worker import JobProgressTracker


class TestJobProgressTrackerSnapshot:
    def test_snapshot_has_all_fields(self) -> None:
        tracker = JobProgressTracker()
        snap = tracker.snapshot()
        assert set(snap.keys()) == {
            "total",
            "pending",
            "running",
            "done",
            "failed",
            "last_updated_at",
        }
        for key in ("total", "pending", "running", "done", "failed"):
            assert snap[key] == 0

    def test_last_updated_at_is_iso_string(self) -> None:
        tracker = JobProgressTracker()
        snap = tracker.snapshot()
        # Should parse back to a datetime.
        parsed = datetime.fromisoformat(snap["last_updated_at"])  # type: ignore[arg-type]
        assert parsed.tzinfo is not None


class TestLifecycle:
    def test_reset_sets_total_and_pending(self) -> None:
        tracker = JobProgressTracker()
        tracker.reset(total=5)
        assert tracker.total == 5
        assert tracker.pending == 5
        assert tracker.running == 0
        assert tracker.done == 0
        assert tracker.failed == 0

    def test_reset_negative_total_clamped_to_zero(self) -> None:
        tracker = JobProgressTracker()
        tracker.reset(total=-3)
        assert tracker.total == 0
        assert tracker.pending == 0

    def test_enqueue_adds_to_pending(self) -> None:
        tracker = JobProgressTracker()
        tracker.reset(total=2)
        tracker.enqueue(["a", "b", "c"])
        assert tracker.total == 5
        assert tracker.pending == 5
        assert tracker.running == 0

    def test_enqueue_empty_list_is_noop_state_but_touches(self) -> None:
        tracker = JobProgressTracker()
        before = tracker.last_updated_at
        # ensure timestamp moves forward
        import time

        time.sleep(0.001)
        tracker.enqueue([])
        assert tracker.total == 0
        assert tracker.pending == 0
        assert tracker.last_updated_at > before

    def test_start_moves_pending_to_running(self) -> None:
        tracker = JobProgressTracker()
        tracker.reset(total=2)
        tracker.on_start("f1")
        assert tracker.pending == 1
        assert tracker.running == 1
        assert tracker.done == 0

    def test_done_moves_running_to_done(self) -> None:
        tracker = JobProgressTracker()
        tracker.reset(total=2)
        tracker.on_start("f1")
        tracker.on_done("f1")
        assert tracker.running == 0
        assert tracker.done == 1
        assert tracker.pending == 1

    def test_fail_moves_running_to_failed(self) -> None:
        tracker = JobProgressTracker()
        tracker.reset(total=2)
        tracker.on_start("f1")
        tracker.on_fail("f1")
        assert tracker.running == 0
        assert tracker.failed == 1
        assert tracker.done == 0

    def test_full_batch_to_completion(self) -> None:
        tracker = JobProgressTracker()
        tracker.reset(total=3)
        for fid in ("f1", "f2", "f3"):
            tracker.on_start(fid)
        assert tracker.running == 3
        assert tracker.pending == 0
        tracker.on_done("f1")
        tracker.on_done("f2")
        tracker.on_fail("f3")
        assert tracker.done == 2
        assert tracker.failed == 1
        assert tracker.running == 0
        snap = tracker.snapshot()
        assert snap["done"] == 2  # type: ignore[index]
        assert snap["failed"] == 1  # type: ignore[index]

    def test_reset_clears_previous_state(self) -> None:
        tracker = JobProgressTracker()
        tracker.reset(total=5)
        tracker.on_start("f1")
        tracker.on_done("f1")
        tracker.on_fail("f2")
        # new batch — everything resets
        tracker.reset(total=2)
        assert tracker.total == 2
        assert tracker.pending == 2
        assert tracker.running == 0
        assert tracker.done == 0
        assert tracker.failed == 0


class TestDefensiveClamping:
    def test_done_without_running_clamps_running(self) -> None:
        tracker = JobProgressTracker()
        tracker.reset(total=0)
        tracker.on_done("ghost")  # nothing running
        # running must not go negative
        assert tracker.running == 0
        assert tracker.done == 1

    def test_start_without_pending_clamps_pending(self) -> None:
        tracker = JobProgressTracker()
        tracker.reset(total=0)
        tracker.on_start("ghost")
        assert tracker.pending == 0
        assert tracker.running == 1


class TestUpdatedAt:
    def test_operations_update_timestamp(self) -> None:
        import time

        tracker = JobProgressTracker()
        t0 = tracker.last_updated_at
        time.sleep(0.001)
        tracker.reset(total=1)
        assert tracker.last_updated_at > t0
        t1 = tracker.last_updated_at
        time.sleep(0.001)
        tracker.on_start("f1")
        assert tracker.last_updated_at > t1
        t2 = tracker.last_updated_at
        time.sleep(0.001)
        tracker.on_done("f1")
        assert tracker.last_updated_at > t2


class TestDonePlusFailedEqualsTotal:
    def test_completion_invariant(self) -> None:
        tracker = JobProgressTracker()
        tracker.reset(total=4)
        tracker.on_start("f1")
        tracker.on_done("f1")
        tracker.on_start("f2")
        tracker.on_fail("f2")
        tracker.on_start("f3")
        tracker.on_done("f3")
        tracker.on_start("f4")
        tracker.on_fail("f4")
        assert tracker.done + tracker.failed == tracker.total
        assert tracker.pending == 0
        assert tracker.running == 0
