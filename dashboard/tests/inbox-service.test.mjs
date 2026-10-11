import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import axios from "axios";
import { createServer } from "vite";

test("Inbox envia cookies e CSRF atual sem alterar erros da API", async () => {
  const originalStorage = globalThis.sessionStorage;
  const originalAdapter = axios.defaults.adapter;
  const requests = [];
  let csrfToken = "csrf-first";
  let apiError;
  const server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("http://127.0.0.1:1") },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: "custom",
  });

  try {
    globalThis.sessionStorage = {
      getItem(key) {
        assert.equal(key, "socialbot.admin.csrf");
        return csrfToken;
      },
    };
    axios.defaults.adapter = async (config) => {
      requests.push(config);
      if (apiError) throw apiError;
      return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config };
    };

    const service = await server.ssrLoadModule(
      "/src/modules/inbox/services/inbox.service.ts",
    );
    await service.listConversations();
    await service.listMessages("conversation-test");
    await service.listTesterConversations();
    await service.sendMessage({ messageText: "test" });
    await service.markConversationAsRead("conversation-test");
    await service.sendInstagramMessage("conversation-test", "test", "account-test", "recipient-test");
    await service.sendTesterDm({ conversationId: "conversation-test", message: "test" });
    await service.hideTesterConversation("conversation-test");

    assert.equal(requests.length, 8);
    assert.equal(requests.at(-1).method, "delete");
    assert.equal(requests.at(-1).url, "/api/internal/testers-dm/conversations/conversation-test");
    for (const request of requests) {
      assert.equal(request.withCredentials, true);
      assert.equal(
        request.headers.get("X-CSRF-Token"),
        request.method === "get" ? undefined : "csrf-first",
      );
    }

    csrfToken = "csrf-renewed";
    await service.markConversationAsRead("conversation-test");
    assert.equal(requests.at(-1).headers.get("X-CSRF-Token"), "csrf-renewed");
    await service.markConversationAsRead("conversation-test", ["message-test"]);
    assert.deepEqual(JSON.parse(requests.at(-1).data), { messageIds: ["message-test"] });
    await service.markConversationAsRead("conversation-test", []);
    assert.deepEqual(JSON.parse(requests.at(-1).data), { messageIds: [] });
    const image = new File(["fake-image"], "foto.png", { type: "image/png" });
    await service.sendImage("conversation-test", image);
    assert.equal(requests.at(-1).headers.get("X-CSRF-Token"), "csrf-renewed");
    assert.equal(requests.at(-1).withCredentials, true);
    assert.ok(requests.at(-1).data instanceof FormData);
    assert.equal(requests.at(-1).data.get("image").name, "foto.png");

    csrfToken = null;
    await service.markConversationAsRead("conversation-test");
    assert.equal(requests.at(-1).headers.get("X-CSRF-Token"), undefined);

    apiError = new axios.AxiosError("Request failed", "ERR_BAD_REQUEST");
    apiError.response = { status: 403, data: { message: "Sem permissao" } };
    await assert.rejects(service.sendTesterDm({}), (error) => {
      assert.equal(error, apiError);
      assert.equal(error.response.data.message, "Sem permissao");
      return true;
    });
  } finally {
    axios.defaults.adapter = originalAdapter;
    if (originalStorage === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = originalStorage;
    await server.close();
  }
});
