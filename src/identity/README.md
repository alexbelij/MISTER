# Identity

Local-first ed25519 identity for MISTER. One keypair per device generates a portable `user_id` (public key hex) that is used across every team the user joins.

## Files

- `keypair.js` — generate / load / sign / verify. Zero deps. Runs in Node and the browser (Web Crypto).
- `team_manifest.js` — signed team membership + role scopes. Signed by the team owner, verified by every peer that opens team data.

## Storage

| Runtime | Where |
|--------|-------|
| Node | `~/mister/data/identity/{prefix}.json` (0600) |
| Browser | IndexedDB `mister-identity → keys` |

The private key never leaves the device. It signs manifest entries and P2P handshakes; peers verify with the public key alone.

## API

```js
const { loadOrCreate } = require('./src/identity/keypair');
const id = await loadOrCreate();
id.publicKey;                       // hex user_id, portable
const sig = id.sign('message');
id.verify(id.publicKey, 'message', sig);  // true
```

## Test

```
node -e "require('./src/identity/keypair').loadOrCreate().then(k => console.log(k.publicKey))"
```
