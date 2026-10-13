const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Script } = require("node:vm");
const test = require("node:test");

function load(file, dependencies, clock = Date) {
  const filename = path.resolve(__dirname, "../src", file);
  const module = { exports: {} };
  new Script(`(function(require,module,Date){${fs.readFileSync(filename, "utf8")}\n})`, { filename })
    .runInThisContext()((name) => {
      assert.ok(Object.hasOwn(dependencies, name), `Dependencia inesperada: ${name}`);
      return dependencies[name];
    }, module, clock);
  return module.exports;
}

function cache(fetchProfile) {
  const time = { value: 100000, now() { return this.value; } };
  const api = load("modules/conversations/instagram-profile-cache.js", {
    "node:crypto": require("node:crypto"),
    "../instagram/instagram-api.client": { getUserProfile: fetchProfile },
  }, time);
  return { ...api, time };
}
const input = { accountId: "account-a", instagramUserId: "123", accessToken: "fake-token" };

test("Exclusao de escopo remove todas as credenciais sem remover outras contas/perfis", async () => {
  let calls=0;
  const api=cache(async()=>({name:`Perfil ${++calls}`}));
  await api.lookupProfile(input);
  await api.lookupProfile({...input,accessToken:"another"});
  await api.lookupProfile({...input,accountId:"account-b"});
  assert.equal(api.forgetScope(input),2);
  await api.lookupProfile({...input,accountId:"account-b"});
  assert.equal(calls,3);
  await api.lookupProfile(input);
  assert.equal(calls,4);
});

test("Resposta de perfil em voo nao repovoa cache nem devolve perfil apos invalidacao", async () => {
  let release;
  const api=cache(async()=>{await new Promise(resolve=>{release=resolve;});return {name:"Deleted"};});
  const pending=api.lookupProfile(input);
  await Promise.resolve();
  assert.equal(api.forgetScope(input),1);
  release();
  assert.equal(await pending,null);
  assert.equal(api.forgetScope(input),0);
});

test("Cache deduplica consultas concorrentes, normaliza dados e expira em uma hora", async () => {
  let calls = 0;
  let release;
  const api = cache(async () => { calls++; if (calls === 1) await new Promise(resolve => { release = resolve; }); return { name: " Ana ", username: " ana ", accessToken: "discard" }; });
  const first = api.lookupProfile(input);
  const second = api.lookupProfile(input);
  await Promise.resolve();
  assert.equal(calls, 1);
  release();
  assert.deepEqual(await first, { name: "Ana", username: "ana" });
  assert.deepEqual(await second, await first);
  await api.lookupProfile(input);
  assert.equal(calls, 1);
  api.time.value += 3600001;
  await api.lookupProfile(input);
  assert.equal(calls, 2);
});

test("Falha/perfil vazio tem backoff cinco minutos e nao expoe erro/token", async () => {
  let calls = 0;
  const api = cache(async () => { calls++; if (calls === 1) throw Error("fake-token provider error"); return {}; });
  assert.equal(await api.lookupProfile(input), null);
  assert.equal(await api.lookupProfile(input), null);
  assert.equal(calls, 1);
  api.time.value += 300001;
  assert.equal(await api.lookupProfile(input), null);
  await api.lookupProfile(input);
  assert.equal(calls, 2);
});

test("Cache isolado por conta, destinatario e rotacao de credencial", async () => {
  let calls = 0;
  const api = cache(async () => ({ name: `Perfil ${++calls}` }));
  await api.lookupProfile(input);
  await api.lookupProfile({ ...input, accountId: "account-b" });
  await api.lookupProfile({ ...input, instagramUserId: "456" });
  await api.lookupProfile({ ...input, accessToken: "new-fake-token" });
  assert.equal(calls, 4);
  await api.lookupProfile(input);
  assert.equal(calls, 4);
});

test("Sem credencial/ID real nao consulta; falha transitoria preserva perfil anterior", async () => {
  let calls = 0;
  const api = cache(async () => { if (++calls > 1) throw Error("Unavailable"); return { username: "ana" }; });
  for (const invalid of [{ ...input, accessToken: null }, { ...input, instagramUserId: "USER_TEST_123" }, { ...input, accountId: null }]) {
    assert.equal(await api.lookupProfile(invalid), null);
  }
  assert.equal(calls, 0);
  assert.deepEqual(await api.lookupProfile(input), { name: null, username: "ana" });
  api.time.value += 3600001;
  assert.deepEqual(await api.lookupProfile(input), { name: null, username: "ana" });
  await api.lookupProfile(input);
  assert.equal(calls, 2);
});

test("Limita cinco chamadas simultaneas e dez inicios por minuto", async () => {
  let calls = 0;
  const releases = [];
  const api = cache(async () => { calls++; await new Promise(resolve => releases.push(resolve)); return { name: "Tester" }; });
  const first = Array.from({ length: 20 }, (_, i) => api.lookupProfile({ ...input, instagramUserId: String(i + 100) }));
  await Promise.resolve();
  assert.equal(calls, 5);
  releases.splice(0).forEach(resolve => resolve());
  await Promise.all(first);
  const next = Array.from({ length: 5 }, (_, i) => api.lookupProfile({ ...input, instagramUserId: String(i + 200) }));
  await Promise.resolve();
  releases.splice(0).forEach(resolve => resolve());
  await Promise.all(next);
  assert.equal(await api.lookupProfile({ ...input, instagramUserId: "999" }), null);
  assert.equal(calls, 10);
  api.time.value += 60001;
  const retry = api.lookupProfile({ ...input, instagramUserId: "999" });
  await Promise.resolve();
  releases.splice(0).forEach(resolve => resolve());
  assert.deepEqual(await retry, { name: "Tester", username: null });
  assert.equal(calls, 11);
});

test("Cache tem capacidade limitada e remove entradas antigas", async () => {
  let calls = 0;
  const api = cache(async () => { calls++; return { name: "Tester" }; });
  for (let i = 0; i < 501; i++) {
    if (i % 10 === 0) api.time.value += 60001;
    await api.lookupProfile({ ...input, instagramUserId: String(i + 1000) });
  }
  const before = calls;
  await api.lookupProfile({ ...input, instagramUserId: "1000" });
  assert.equal(calls, before + 1);
  await api.lookupProfile({ ...input, instagramUserId: "1500" });
  assert.equal(calls, before + 1);
});

test("Listagem enriquece sem substituir dados salvos/expor token ou payload", async () => {
  let calls = 0;
  const api = load("modules/conversations/instagram-conversations.service.js", {
    "../../lib/db": { query: async () => ({ rows: [
      { id: "c1", accountId: "a1", instagramUserId: "123", instagramName: "Salvo", instagramUsername: null, _accessToken: "fake-token", _lastMessagePayload: {}, lastMessageText: "Mensagem", unreadCount: 2 },
      { id: "c2", instagramName: "Completo", instagramUsername: "completo", _accessToken: "fake-token", unreadCount: 0 },
    ] }) },
    "./instagram-profile-cache": { lookupProfile: async ({ accountId, accessToken }) => {
      assert.equal(accountId, "a1"); assert.equal(accessToken, "fake-token"); calls++;
      return { name: "Meta", username: "ana" };
    } },
  });
  const result = await api.listConversations({});
  assert.equal(result.items[0].instagramName, "Salvo");
  assert.equal(result.items[0].instagramUsername, "ana");
  assert.equal(result.items[0].unreadCount, 2);
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(result).includes("fake-token"));
  assert.ok(!JSON.stringify(result).includes("_lastMessagePayload"));
});
