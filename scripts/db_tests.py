#!/usr/bin/env python3
"""Database test suite for Kendra.

Boots a real PostgreSQL instance, applies the migrations exactly as Supabase
would, then exercises the schema and every RLS policy by switching into the
`authenticated` role with a forged JWT subject — the same thing PostgREST does.

Run:  python3 scripts/db_tests.py
"""
from __future__ import annotations

import os
import pathlib
import sys
import traceback

import pgserver
import psycopg

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATIONS = sorted((ROOT / "supabase" / "migrations").glob("*.sql"))
PGDATA = os.environ.get("KENDRA_PGDATA", "/scratch/work/pgdata-kendra")

BOOTSTRAP = """
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
"""

OWNER = "11111111-1111-1111-1111-111111111111"
MEMBER = "22222222-2222-2222-2222-222222222222"
OUTSIDER = "33333333-3333-3333-3333-333333333333"
VIEWER = "44444444-4444-4444-4444-444444444444"
NEWCOMER = "55555555-5555-5555-5555-555555555555"

ORG1 = "aaaaaaaa-0000-0000-0000-000000000001"
ORG2 = "bbbbbbbb-0000-0000-0000-000000000002"
LOC1 = "cccccccc-0000-0000-0000-000000000001"
LOC2 = "cccccccc-0000-0000-0000-000000000002"
LOC_OTHER = "cccccccc-0000-0000-0000-000000000009"

results: list[tuple[str, str, str]] = []


def record(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, "PASS" if ok else "FAIL", detail))


def check(name: str, fn) -> None:
    try:
        fn()
        record(name, True)
    except AssertionError as exc:
        record(name, False, str(exc))
    except Exception as exc:  # noqa: BLE001
        record(name, False, f"{type(exc).__name__}: {exc}")


class DB:
    def __init__(self, conn: psycopg.Connection) -> None:
        self.conn = conn

    def sql(self, statement: str, params: tuple = ()) -> list[tuple]:
        with self.conn.cursor() as cur:
            cur.execute(statement, params)
            return cur.fetchall() if cur.description else []

    def as_user(self, uid: str | None, statement: str, params: tuple = (), role: str = "authenticated", persist: bool = False):
        """Run one statement in a transaction as `role` + JWT subject.

        persist=False rolls the transaction back so checks cannot pollute each
        other; persist=True commits, for RPCs whose effects we need afterwards.
        """
        cur = self.conn.cursor()
        cur.execute("begin")
        try:
            cur.execute(f"set local role {role}")
            if uid is not None:
                cur.execute("select set_config('request.jwt.claim.sub', %s, true)", (uid,))
            cur.execute(statement, params)
            rows = cur.fetchall() if cur.description else []
            cur.execute("commit" if persist else "rollback")
            return rows
        except Exception:
            cur.execute("rollback")
            raise
        finally:
            cur.close()

    def denied_or_empty(self, uid: str | None, statement: str, params: tuple = (), role: str = "authenticated"):
        """A user with no grant and no policy may get 0 rows or a privilege error.

        Both are a denial; anything else is a leak.
        """
        try:
            return self.as_user(uid, statement, params, role)
        except psycopg.errors.InsufficientPrivilege:
            return []

    def expect_error(self, uid: str | None, statement: str, params: tuple = (), role: str = "authenticated"):
        try:
            self.as_user(uid, statement, params, role)
        except psycopg.Error as exc:
            return exc
        raise AssertionError("expected the database to reject this, but it succeeded")


def apply_sql_file(conn: psycopg.Connection, path: pathlib.Path) -> None:
    conn.execute(path.read_text())


def seed(conn: psycopg.Connection) -> None:
    conn.execute(
        """
        insert into auth.users (id, email, raw_user_meta_data) values
          (%s, 'owner@kendra.test', '{"full_name":"Aarti Rao"}'),
          (%s, 'member@kendra.test', '{"full_name":"Mihir Shah"}'),
          (%s, 'outsider@kendra.test', '{"full_name":"Nikhil Verma"}'),
          (%s, 'viewer@kendra.test', '{"full_name":"Priya Iyer"}'),
          (%s, 'newcomer@kendra.test', '{"full_name":"Rhea Kapoor"}')
        """,
        (OWNER, MEMBER, OUTSIDER, VIEWER, NEWCOMER),
    )
    conn.execute(
        """
        insert into organizations (id, name, slug, created_by) values
          (%s, 'Blue Tokai Retail', 'blue-tokai-retail', %s),
          (%s, 'Competitor Group', 'competitor-group', %s)
        """,
        (ORG1, OWNER, ORG2, OUTSIDER),
    )
    conn.execute(
        """
        insert into memberships (org_id, user_id, role) values
          (%s, %s, 'owner'), (%s, %s, 'member'), (%s, %s, 'viewer'), (%s, %s, 'owner')
        """,
        (ORG1, OWNER, ORG1, MEMBER, ORG1, VIEWER, ORG2, OUTSIDER),
    )
    conn.execute(
        """
        insert into locations (id, org_id, name, city, gbp_location_id, audit_score) values
          (%s, %s, 'Indiranagar', 'Bengaluru', 'gbp-loc-1', 82),
          (%s, %s, 'Bandra West', 'Mumbai', 'gbp-loc-2', 64),
          (%s, %s, 'Rival Outlet', 'Pune', 'gbp-loc-9', 40)
        """,
        (LOC1, ORG1, LOC2, ORG1, LOC_OTHER, ORG2),
    )
    conn.execute(
        """
        insert into reviews (org_id, location_id, gbp_review_id, author_name, rating, comment, sentiment)
        values (%s, %s, 'rev-1', 'Kavya N', 2, 'Waited 40 minutes for a flat white.', 'negative')
        """,
        (ORG1, LOC1),
    )


def run_checks(db: DB) -> None:
    # ---------------- isolation ----------------
    def outsider_sees_no_locations():
        rows = db.as_user(OUTSIDER, "select id from locations where org_id = %s", (ORG1,))
        assert rows == [], f"expected 0 rows, got {len(rows)}"

    def outsider_sees_no_org():
        rows = db.as_user(OUTSIDER, "select id from organizations where id = %s", (ORG1,))
        assert rows == [], "outsider read another tenant's organization"

    def outsider_cannot_insert_location():
        db.expect_error(
            OUTSIDER,
            "insert into locations (org_id, name) values (%s, 'Sneaky Outlet')",
            (ORG1,),
        )

    def outsider_sees_own_org():
        rows = db.as_user(OUTSIDER, "select id from organizations where id = %s", (ORG2,))
        assert len(rows) == 1, "owner cannot read their own organization"

    def anon_sees_nothing():
        rows = db.denied_or_empty(None, "select id from locations", (), role="anon")
        assert rows == [], "anon role can read locations"

    # ---------------- member role ----------------
    def member_reads_locations():
        rows = db.as_user(MEMBER, "select id from locations where org_id = %s", (ORG1,))
        assert len(rows) == 2, f"member expected 2 locations, saw {len(rows)}"

    def member_creates_location():
        rows = db.as_user(
            MEMBER,
            "insert into locations (org_id, name) values (%s, 'Koramangala') returning id",
            (ORG1,),
        )
        assert len(rows) == 1, "member could not create a location"

    def member_updates_location():
        rows = db.as_user(
            MEMBER,
            "update locations set city = 'Bengaluru' where id = %s returning id",
            (LOC1,),
        )
        assert len(rows) == 1, "member could not update a location"

    def member_cannot_delete_location():
        rows = db.as_user(MEMBER, "delete from locations where id = %s returning id", (LOC2,))
        assert rows == [], "member was able to delete a location"

    def member_cannot_change_roles():
        rows = db.as_user(
            MEMBER,
            "update memberships set role = 'owner' where org_id = %s and user_id = %s returning role",
            (ORG1, MEMBER),
        )
        assert rows == [], "member escalated their own role"

    def member_cannot_write_other_org():
        db.expect_error(
            MEMBER,
            "insert into locations (org_id, name) values (%s, 'Cross tenant')",
            (ORG2,),
        )

    # ---------------- viewer role ----------------
    def viewer_reads_but_cannot_write():
        rows = db.as_user(VIEWER, "select id from locations where org_id = %s", (ORG1,))
        assert len(rows) == 2, "viewer should read locations"
        db.expect_error(
            VIEWER,
            "insert into locations (org_id, name) values (%s, 'Viewer outlet')",
            (ORG1,),
        )

    # ---------------- owner role ----------------
    def owner_deletes_location():
        rows = db.as_user(OWNER, "delete from locations where id = %s returning id", (LOC2,))
        assert len(rows) == 1, "owner could not delete a location"

    def owner_updates_org():
        rows = db.as_user(
            OWNER,
            "update organizations set name = 'Blue Tokai' where id = %s returning id",
            (ORG1,),
        )
        assert len(rows) == 1, "owner could not update their organization"

    def viewer_cannot_update_org():
        rows = db.as_user(
            VIEWER,
            "update organizations set name = 'Hijacked' where id = %s returning id",
            (ORG1,),
        )
        assert rows == [], "viewer updated the organization"

    # ---------------- secrets ----------------
    def secrets_are_invisible():
        db.sql(
            "insert into connections (org_id, provider, status) values (%s, 'google_business_profile', 'connected')",
            (ORG1,),
        )
        db.sql(
            """
            insert into connection_secrets (connection_id, org_id, access_token)
            select id, org_id, 'ya29.secret' from connections where org_id = %s
            """,
            (ORG1,),
        )
        rows = db.denied_or_empty(OWNER, "select access_token from connection_secrets")
        assert rows == [], "OAuth token is readable by an authenticated user"
        rows = db.sql("select access_token from connection_secrets")
        assert len(rows) == 1, "service role lost access to the token store"

    # ---------------- profiles ----------------
    def profiles_shared_org_only():
        rows = db.as_user(MEMBER, "select id from profiles where id = %s", (OWNER,))
        assert len(rows) == 1, "teammate profile should be visible"
        rows = db.as_user(OUTSIDER, "select id from profiles where id = %s", (OWNER,))
        assert rows == [], "profile leaked across tenants"

    def profile_autocreated():
        rows = db.sql("select count(*) from profiles")
        assert rows[0][0] == 5, f"expected 5 profiles from trigger, got {rows[0][0]}"

    # ---------------- rpc ----------------
    def create_org_rpc():
        rows = db.as_user(OUTSIDER, "select id, slug from create_organization('Nikhil Coffee Co')", persist=True)
        assert len(rows) == 1, "create_organization returned nothing"
        new_id = rows[0][0]
        visible = db.as_user(OUTSIDER, "select id from organizations where id = %s", (new_id,))
        assert len(visible) == 1, "creator cannot read the org they just created"
        role = db.as_user(OUTSIDER, "select my_role(%s)", (new_id,))
        assert role[0][0] == "owner", f"creator role is {role[0][0]}"

    def create_org_requires_auth():
        db.expect_error(None, "select create_organization('Anon Corp')", (), role="anon")

    def add_member_by_email():
        rows = db.as_user(
            OWNER,
            "select user_id, role from add_member_by_email(%s, 'newcomer@kendra.test', 'member')",
            (ORG1,),
        )
        assert len(rows) == 1, "owner could not add a member"

    def member_cannot_add_member():
        db.expect_error(
            MEMBER,
            "select add_member_by_email(%s, 'newcomer@kendra.test', 'admin')",
            (ORG1,),
        )

    def cannot_remove_owner():
        db.expect_error(OWNER, "select remove_member(%s, %s)", (ORG1, OWNER))

    # ---------------- constraints ----------------
    def duplicate_review_rejected():
        db.expect_error(
            OWNER,
            "insert into reviews (org_id, location_id, gbp_review_id, author_name, rating) values (%s, %s, 'rev-1', 'Dupe', 5)",
            (ORG1, LOC1),
        )

    def rating_range_enforced():
        db.expect_error(
            OWNER,
            "insert into reviews (org_id, location_id, gbp_review_id, author_name, rating) values (%s, %s, 'rev-9', 'Bad', 7)",
            (ORG1, LOC1),
        )

    def audit_score_range_enforced():
        db.expect_error(OWNER, "update locations set audit_score = 140 where id = %s", (LOC1,))

    def slug_format_enforced():
        db.expect_error(
            OWNER, "insert into organizations (name, slug, created_by) values ('Bad', 'Not A Slug', %s)", (OWNER,)
        )

    # ---------------- views ----------------
    def location_health_view():
        rows = db.as_user(OWNER, "select open_reviews, avg_rating from v_location_health where id = %s", (LOC1,))
        assert rows and rows[0][0] == 1, f"open review count wrong: {rows}"

    def health_view_respects_rls():
        rows = db.as_user(OUTSIDER, "select id from v_location_health where org_id = %s", (ORG1,))
        assert rows == [], "view bypassed RLS"

    def rollup_view():
        rows = db.as_user(OWNER, "select locations_total, open_reviews from v_portfolio_rollup where org_id = %s", (ORG1,))
        assert rows and rows[0][0] >= 1, f"rollup wrong: {rows}"

    # ---------------- lifecycle ----------------
    def cascade_delete():
        db.sql("insert into organizations (id, name, slug, created_by) values ('dddddddd-0000-0000-0000-00000000000d', 'Temp', 'temp-org', %s)", (OWNER,))
        db.sql("insert into locations (org_id, name) values ('dddddddd-0000-0000-0000-00000000000d', 'Temp loc')")
        db.sql("delete from organizations where id = 'dddddddd-0000-0000-0000-00000000000d'")
        rows = db.sql("select count(*) from locations where name = 'Temp loc'")
        assert rows[0][0] == 0, "deleting an org left orphan locations"

    checks = [
        ("outsider cannot read another tenant's locations", outsider_sees_no_locations),
        ("outsider cannot read another tenant's organization", outsider_sees_no_org),
        ("outsider cannot insert into another tenant", outsider_cannot_insert_location),
        ("outsider can read their own organization", outsider_sees_own_org),
        ("anon role reads nothing", anon_sees_nothing),
        ("member reads all org locations", member_reads_locations),
        ("member creates a location", member_creates_location),
        ("member updates a location", member_updates_location),
        ("member cannot delete a location", member_cannot_delete_location),
        ("member cannot escalate their own role", member_cannot_change_roles),
        ("member cannot write to another org", member_cannot_write_other_org),
        ("viewer reads but cannot write", viewer_reads_but_cannot_write),
        ("owner deletes a location", owner_deletes_location),
        ("owner updates organization settings", owner_updates_org),
        ("viewer cannot update organization", viewer_cannot_update_org),
        ("OAuth tokens invisible to users", secrets_are_invisible),
        ("profiles visible only within a tenant", profiles_shared_org_only),
        ("signup trigger creates a profile", profile_autocreated),
        ("create_organization bootstraps owner membership", create_org_rpc),
        ("create_organization rejects anon", create_org_requires_auth),
        ("owner adds a member by email", add_member_by_email),
        ("member cannot add members", member_cannot_add_member),
        ("owner cannot be removed", cannot_remove_owner),
        ("duplicate reviews rejected", duplicate_review_rejected),
        ("rating range enforced", rating_range_enforced),
        ("audit score range enforced", audit_score_range_enforced),
        ("slug format enforced", slug_format_enforced),
        ("location health view aggregates reviews", location_health_view),
        ("location health view respects RLS", health_view_respects_rls),
        ("portfolio rollup aggregates", rollup_view),
        ("deleting an org cascades to locations", cascade_delete),
    ]
    for name, fn in checks:
        check(name, fn)


def main() -> int:
    print("Kendra — database & RLS test suite")
    print(f"postgres data dir: {PGDATA}")
    server = pgserver.get_server(PGDATA)
    uri = server.get_uri()
    conn = psycopg.connect(uri, autocommit=True)
    try:
        conn.execute("drop schema if exists public cascade; create schema public;")
        conn.execute("drop schema if exists auth cascade;")
        conn.execute(BOOTSTRAP)
        for path in MIGRATIONS:
            apply_sql_file(conn, path)
            print(f"  applied {path.name}")
        seed(conn)
        print()
        run_checks(DB(conn))
    except Exception:
        traceback.print_exc()
        return 1
    finally:
        conn.close()
        server.cleanup()

    width = max(len(n) for n, _, _ in results)
    for name, status, detail in results:
        mark = "ok  " if status == "PASS" else "FAIL"
        line = f"  {mark} {name.ljust(width)}"
        if detail:
            line += f"  -> {detail}"
        print(line)

    failed = [r for r in results if r[1] == "FAIL"]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
