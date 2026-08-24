import { assertEquals } from "jsr:@std/assert@1";
import { buildPushMessages } from "./push-logic.ts";

Deno.test("buildPushMessages - un message par token valide", () => {
  const msgs = buildPushMessages(["ExponentPushToken[aaa]", "ExponentPushToken[bbb]"], "Titre", "Corps");
  assertEquals(msgs.length, 2);
  assertEquals(msgs[0], { to: "ExponentPushToken[aaa]", title: "Titre", body: "Corps", sound: "default" });
});

Deno.test("buildPushMessages - ignore les tokens mal formés", () => {
  const msgs = buildPushMessages(["not-a-token", "ExponentPushToken[ccc]"], "Titre", "Corps");
  assertEquals(msgs.length, 1);
  assertEquals(msgs[0].to, "ExponentPushToken[ccc]");
});

Deno.test("buildPushMessages - déduplique les tokens identiques", () => {
  const msgs = buildPushMessages(["ExponentPushToken[aaa]", "ExponentPushToken[aaa]"], "Titre", "Corps");
  assertEquals(msgs.length, 1);
});

Deno.test("buildPushMessages - inclut data quand fourni", () => {
  const msgs = buildPushMessages(["ExponentPushToken[aaa]"], "Titre", "Corps", { screen: "planning" });
  assertEquals(msgs[0].data, { screen: "planning" });
});

Deno.test("buildPushMessages - liste vide", () => {
  assertEquals(buildPushMessages([], "Titre", "Corps"), []);
});
