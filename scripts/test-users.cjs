const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const source = path.resolve(__dirname, '../src/lib/users.ts');
const compiled = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tafel-users-test-'));
const original = process.cwd();
process.chdir(temporary);
const loaded = new Module(source, module);
loaded.filename = source;
loaded.paths = Module._nodeModulePaths(path.dirname(source));
loaded._compile(compiled, source);
const users = loaded.exports;
(async () => {
  try {
    assert.deepEqual(await users.getUsers(), []);
    assert.equal(fs.existsSync('data/users.json'), false, 'anonymous read must not bootstrap');
    const user = { id: 'synthetic-1', username: 'synthetic', passwordHash: 'synthetic',
      role: 'admin', createdAt: new Date().toISOString(), bootstrapExpiresAt: Date.now() + 60000 };
    await users.saveUsers([user]);
    const results = await Promise.all([users.consumeBootstrap(user), users.consumeBootstrap(user)]);
    assert.equal(results.filter(Boolean).length, 1, 'bootstrap is single-use under concurrency');
    assert.equal(await users.consumeBootstrap({ ...user, id: 'expired', bootstrapExpiresAt: 0 }), false);
    assert.equal((fs.statSync('data/users.json').mode & 0o777), 0o600);
    assert.deepEqual(await users.getUsers(), [user]);
    fs.writeFileSync('data/users.json', '{invalid');
    await assert.rejects(users.getUsers(), SyntaxError, 'corruption must not become an empty user list');
    console.log('PASS: no default account, single-use/expired bootstrap, private atomic file, corrupt store rejected');
  } finally {
    process.chdir(original);
    fs.rmSync(temporary, { recursive: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
