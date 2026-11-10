import { describe, it, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Integration tests for the pairing/room security rules, run against the
 * live backend with throwaway accounts. Skipped automatically when no
 * backend URL/key is present (e.g. offline CI).
 */
const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const run = URL && KEY ? describe : describe.skip;

const PASSWORD = "test-pass-123456";

async function makeUser(tag: string): Promise<SupabaseClient> {
  const client = createClient(URL!, KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `justus-test-${Date.now()}-${tag}@example.com`;
  const { error: signUpError } = await client.auth.signUp({ email, password: PASSWORD });
  if (signUpError) throw signUpError;
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return client;
}

async function makeCode(user: SupabaseClient): Promise<string> {
  const { error: roomError } = await user.rpc("create_room");
  if (roomError) throw roomError;
  const { data, error } = await user.rpc("create_invitation");
  if (error) throw error;
  return (data as { code: string }).code;
}

run("database security scenarios", () => {
  it(
    "a one-time code cannot be used by a third account after pairing",
    async () => {
      const a = await makeUser("a");
      const b = await makeUser("b");
      const c = await makeUser("c");

      const code = await makeCode(a);
      const { error: joinError } = await b.rpc("join_room", { _code: code });
      expect(joinError).toBeNull();

      const { error: thirdError } = await c.rpc("join_room", { _code: code });
      expect(thirdError).not.toBeNull();
    },
    30_000,
  );

  it(
    "a revoked code is rejected",
    async () => {
      const a = await makeUser("a");
      const b = await makeUser("b");

      const code = await makeCode(a);
      const { error: revokeError } = await a.rpc("revoke_invitations");
      expect(revokeError).toBeNull();

      const { error: joinError } = await b.rpc("join_room", { _code: code });
      expect(joinError).not.toBeNull();
    },
    30_000,
  );

  it(
    "a full room of two cannot mint a new invitation",
    async () => {
      const a = await makeUser("a");
      const b = await makeUser("b");

      const code = await makeCode(a);
      const { error: joinError } = await b.rpc("join_room", { _code: code });
      expect(joinError).toBeNull();

      const { error: inviteError } = await a.rpc("create_invitation");
      expect(inviteError).not.toBeNull();
    },
    30_000,
  );

  it(
    "a non-member cannot read another room's messages or room row",
    async () => {
      const a = await makeUser("a");
      const b = await makeUser("b");
      const c = await makeUser("c");

      const code = await makeCode(a);
      await b.rpc("join_room", { _code: code });

      const { data: rooms } = await a.from("room_members").select("room_id").limit(1);
      const roomId = (rooms?.[0] as { room_id: string } | undefined)?.room_id;
      expect(roomId).toBeTruthy();

      const { data: messages, error: msgError } = await c.from("messages").select("id").eq("room_id", roomId!);
      expect(msgError).toBeNull();
      expect(messages).toHaveLength(0);

      const { data: roomRows, error: roomError } = await c.from("rooms").select("id").eq("id", roomId!);
      expect(roomError).toBeNull();
      expect(roomRows).toHaveLength(0);
    },
    30_000,
  );
});
